// Test support for OA-2's backdrop tests (spec/OA-2.md r1 AC-38, AC-39, EC-10, EC-36, EC-37; plan 1.0 section 8). Not a test
// file. INVENTED, HEADER-ONLY images: each builder writes the bytes a reader needs for the type and the pixel size, and
// nothing a decoder would want, so a 60,000 x 60,000 header is a few dozen bytes (EC-37). The layouts are the ones the
// reader's own header comment names (imageHeader.js): PNG signature then IHDR; JPEG SOI, marker segments, an SOFn frame
// header; WebP RIFF with a 'VP8 ' (lossy), 'VP8L' (lossless) or 'VP8X' (extended) chunk.
'use strict';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32be = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const u32le = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const u16le = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff);
  return b;
};
const u16be = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n & 0xffff);
  return b;
};
const u24le = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);

// ------------------------------------------------------------------------------------------------------------- PNG

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  return Buffer.concat([u32be(data.length), body, u32be(crc32(body))]);
}

/** A PNG whose IHDR says width x height (8-bit RGB): the signature, IHDR and IEND, with valid checksums. */
function pngBytes(width, height) {
  const ihdr = Buffer.concat([u32be(width), u32be(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------------------------------------------------ JPEG

/**
 * A JPEG with a frame header of width x height.
 * @param {object} [options]
 * @param {boolean} [options.progressive]  SOF2 instead of SOF0
 * @param {boolean} [options.leadingSegments]  APP0, a DQT and a DHT before the frame header, and fill bytes (FF FF)
 */
function jpegBytes(width, height, { progressive = false, leadingSegments = true } = {}) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0', 'ascii'),
    Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]),
  ]);
  const dqt = Buffer.concat([Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]), Buffer.alloc(64, 16)]);
  const dht = Buffer.concat([Buffer.from([0xff, 0xc4, 0x00, 0x14, 0x00]), Buffer.alloc(17, 0)]);
  const fill = Buffer.from([0xff, 0xff]); // fill bytes before a marker are allowed (T.81 B.1.1.2)
  const sof = Buffer.concat([
    Buffer.from([0xff, progressive ? 0xc2 : 0xc0, 0x00, 0x11, 0x08]),
    u16be(height),
    u16be(width),
    Buffer.from([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
  ]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat(
    leadingSegments ? [soi, app0, dqt, fill, dht, sof, sos, eoi] : [soi, sof, sos, eoi],
  );
}

// ------------------------------------------------------------------------------------------------------------ WebP

function riffChunk(fourCC, data) {
  const pad = data.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(fourCC, 'ascii'), u32le(data.length), data, pad]);
}

function riff(...chunks) {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), u32le(body.length), body]);
}

/** A lossy WebP: a 'VP8 ' chunk holding a key frame (start code 9D 01 2A, 14-bit sizes). */
function webpLossyBytes(width, height) {
  const firstPartSize = 10;
  const tag = (0 << 0) | (0 << 1) | (1 << 4) | (firstPartSize << 5); // key frame, version 0, shown
  const frame = Buffer.concat([
    Buffer.from([tag & 0xff, (tag >> 8) & 0xff, (tag >> 16) & 0xff]),
    Buffer.from([0x9d, 0x01, 0x2a]),
    u16le(width & 0x3fff),
    u16le(height & 0x3fff),
  ]);
  return riff(riffChunk('VP8 ', frame));
}

/** A lossless WebP: a 'VP8L' chunk (signature 2F, then width - 1 and height - 1 in 14 bits each). */
function webpLosslessBytes(width, height) {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return riff(riffChunk('VP8L', Buffer.concat([Buffer.from([0x2f]), u32le(bits)])));
}

/** An extended WebP: a 'VP8X' chunk with the canvas (24-bit width - 1 and height - 1), then a lossless chunk. */
function webpExtendedBytes(width, height) {
  const vp8x = Buffer.concat([Buffer.from([0, 0, 0, 0]), u24le(width - 1), u24le(height - 1)]);
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return riff(
    riffChunk('VP8X', vp8x),
    riffChunk('VP8L', Buffer.concat([Buffer.from([0x2f]), u32le(bits)])),
  );
}

// ------------------------------------------------------------------------------------------------------- not images

const pdfBytes = () =>
  Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n', 'ascii');
const gifBytes = (width = 100, height = 100) =>
  Buffer.concat([
    Buffer.from('GIF89a', 'ascii'),
    u16le(width),
    u16le(height),
    Buffer.from([0, 0, 0, 0x3b]),
  ]);
const textBytes = () => Buffer.from('This is plain text that was renamed plan.png.\n', 'utf8');

/** A body of `size` bytes that starts with a valid PNG header and is padded after IEND (for the size limit). */
function paddedPng(size, width = 100, height = 100) {
  const head = pngBytes(width, height);
  if (size < head.length) throw new Error('paddedPng: size is below the header');
  return Buffer.concat([head, Buffer.alloc(size - head.length, 0x20)]);
}

module.exports = {
  crc32,
  pngBytes,
  jpegBytes,
  webpLossyBytes,
  webpLosslessBytes,
  webpExtendedBytes,
  pdfBytes,
  gifBytes,
  textBytes,
  paddedPng,
  PNG_SIGNATURE,
};
