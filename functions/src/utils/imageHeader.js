// readImageHeader (spec/OA-2.md r1 AC-38, AC-39, DC-13, EC-37; plan/OA-2-map-storage.md 1.0 section 4.3): the type of
// an uploaded image from its magic bytes only (never its name or Content-Type), and its pixel size from its header
// only, with no decoding, so a header claiming 60,000 x 60,000 in a tiny file is refused from the header alone (the
// pixel limits are the upload service's). Pure: it reads the bytes it is given and nothing else, and it never throws on
// any input (the bytes are untrusted).
//
//   { type: 'png' | 'jpeg' | 'webp', mimeType, width, height }   a readable header
//   { error: 'unknownType' }                                     not PNG, JPEG or WebP magic bytes (the route: 415)
//   { error: 'damaged' }                                         the right magic bytes, an unreadable header (400)
//
// Layouts (checked at OA-2 step 0 against the specifications, quoted in phase-reports/feature-first/OA-2.md):
//   PNG   W3C PNG, Third Edition: the signature 89 50 4E 47 0D 0A 1A 0A, then the IHDR chunk first (4-byte length,
//         'IHDR', then width and height as 4-byte big-endian integers; "Zero is an invalid value").
//   JPEG  ITU-T T.81 Annex B: SOI FF D8, then marker segments (B.1.1.4: a 2-byte big-endian length that counts itself;
//         B.1.1.2: any marker may be preceded by FF fill bytes; TEM, RSTm, SOI and EOI stand alone) up to an SOFn frame
//         header (Table B.1: FF C0 to FF CF except C4 DHT, C8 JPG and CC DAC), which holds Lf, P, then Y (lines) and X
//         (samples per line), 16 bits each (B.2.2). Y = 0 (lines defined later by DNL) gives no size: damaged.
//   WebP  the WebP container: 'RIFF', a 4-byte size, 'WEBP', then the first chunk (FourCC, 4-byte little-endian size):
//         'VP8 ' holds a key frame (RFC 6386 section 9.1: a 3-byte frame tag, the start code 9D 01 2A, then 14-bit
//         width and height, little-endian, the top 2 bits a scale); 'VP8L' holds the signature 2F, then width - 1 and
//         height - 1 in 14 bits each, least significant bit first (WebP lossless bitstream section 3); 'VP8X' holds 4
//         bytes of flags and reserved bits, then the canvas width - 1 and height - 1 in 24 bits each, little-endian.
'use strict';

const UNKNOWN = Object.freeze({ error: 'unknownType' });
const DAMAGED = Object.freeze({ error: 'damaged' });

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF = Buffer.from('RIFF', 'ascii');
const WEBP = Buffer.from('WEBP', 'ascii');
/** Where the first chunk's data starts in a WebP file: 'RIFF' (4), size (4), 'WEBP' (4), FourCC (4), size (4). */
const WEBP_DATA = 20;

/** The SOFn markers of T.81 Table B.1: FF C0 to FF CF, but C4 (DHT), C8 (JPG) and CC (DAC) are not frame headers. */
const isFrameMarker = (m) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
/** Markers with no length (T.81 Table B.1, the starred entries): TEM, RSTm, SOI, EOI. */
const standsAlone = (m) => m === 0x01 || (m >= 0xd0 && m <= 0xd9);
const EOI = 0xd9;
const SOS = 0xda;

const startsWith = (bytes, prefix, at = 0) =>
  bytes.length >= at + prefix.length && bytes.subarray(at, at + prefix.length).equals(prefix);

const sized = (type, width, height) =>
  width > 0 && height > 0 ? { type, mimeType: `image/${type}`, width, height } : DAMAGED;

function readPng(bytes) {
  // IHDR is the first chunk: its length (4), 'IHDR' (4), width (4), height (4).
  if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') return DAMAGED;
  if (bytes.readUInt32BE(8) < 8) return DAMAGED;
  return sized('png', bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

function readJpeg(bytes) {
  let at = 2; // after SOI
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return DAMAGED; // a marker must come next
    while (at < bytes.length && bytes[at] === 0xff) at += 1; // the marker's FF, and any fill bytes before it
    if (at >= bytes.length) return DAMAGED;
    const marker = bytes[at];
    at += 1;
    if (marker === 0x00 || marker === EOI || marker === SOS) return DAMAGED; // no frame header came first
    if (standsAlone(marker)) continue;
    if (at + 2 > bytes.length) return DAMAGED;
    const length = bytes.readUInt16BE(at);
    if (length < 2 || at + length > bytes.length) return DAMAGED;
    if (isFrameMarker(marker)) {
      // Lf (2), P (1), Y (2), X (2)
      if (length < 7) return DAMAGED;
      return sized('jpeg', bytes.readUInt16BE(at + 5), bytes.readUInt16BE(at + 3));
    }
    at += length;
  }
  return DAMAGED;
}

function readWebp(bytes) {
  if (bytes.length < WEBP_DATA) return DAMAGED;
  const fourCC = bytes.toString('latin1', 12, 16);
  const available = Math.min(bytes.readUInt32LE(16), bytes.length - WEBP_DATA);
  const at = WEBP_DATA;
  if (fourCC === 'VP8 ') {
    if (available < 10) return DAMAGED;
    if (bytes[at + 3] !== 0x9d || bytes[at + 4] !== 0x01 || bytes[at + 5] !== 0x2a) return DAMAGED;
    return sized('webp', bytes.readUInt16LE(at + 6) & 0x3fff, bytes.readUInt16LE(at + 8) & 0x3fff);
  }
  if (fourCC === 'VP8L') {
    if (available < 5 || bytes[at] !== 0x2f) return DAMAGED;
    const bits = bytes.readUInt32LE(at + 1);
    return sized('webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (fourCC === 'VP8X') {
    if (available < 10) return DAMAGED;
    return sized('webp', bytes.readUIntLE(at + 4, 3) + 1, bytes.readUIntLE(at + 7, 3) + 1);
  }
  return DAMAGED;
}

/**
 * @param {Buffer} bytes  the uploaded file
 * @returns {{ type: 'png'|'jpeg'|'webp', mimeType: string, width: number, height: number }
 *   | { error: 'unknownType' } | { error: 'damaged' }}
 */
function readImageHeader(bytes) {
  if (!Buffer.isBuffer(bytes)) return UNKNOWN;
  if (startsWith(bytes, PNG_SIGNATURE)) return readPng(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes);
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return readWebp(bytes);
  return UNKNOWN;
}

module.exports = { readImageHeader };
