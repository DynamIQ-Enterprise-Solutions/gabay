'use strict';

// OA-2 / spec/OA-2.md r1 AC-38, AC-39, DC-13, EC-10, EC-36, EC-37 (plan/OA-2-map-storage.md 1.0 sections 4.3 and 8):
// readImageHeader(bytes), the in-house reader of an uploaded image's type and pixel size. Pure: no I/O, no decoding.
//
//   { type, mimeType, width, height }   a readable header (png, jpeg, webp)
//   { error: 'unknownType' }            not the magic bytes of PNG, JPEG or WebP (the route answers 415)
//   { error: 'damaged' }                the right magic bytes and an unreadable header (the route answers 400)
//
// The images are header-only and invented (imageFixtures.js). The reader reports the size the header CLAIMS: the pixel
// limits (50 to 10,000 a side, 50 megapixels) are the route's (venueMaps.backdrops.test.js), so a 60,000 x 60,000 header in
// a few dozen bytes is read, not refused, here (EC-37).

const test = require('node:test');
const assert = require('node:assert/strict');
const { readImageHeader } = require('../src/utils/imageHeader');
const img = require('./imageFixtures');
const { mulberry32 } = require('./fixtures/mapBuilder');

const png = (type, width, height) => ({ type, mimeType: `image/${type}`, width, height });

test('PNG: the size comes from IHDR, and a huge claim in a tiny file is read from the header alone (EC-37)', () => {
  assert.deepEqual(readImageHeader(img.pngBytes(100, 80)), png('png', 100, 80));
  assert.deepEqual(
    readImageHeader(img.pngBytes(10000, 5000)),
    png('png', 10000, 5000),
    'EC-10: 50 megapixels exactly',
  );
  assert.deepEqual(readImageHeader(img.pngBytes(50, 50)), png('png', 50, 50));
  const huge = img.pngBytes(60000, 60000);
  assert.ok(huge.length < 100, 'the file is a few dozen bytes');
  assert.deepEqual(readImageHeader(huge), png('png', 60000, 60000));
  assert.deepEqual(
    readImageHeader(img.pngBytes(2147483647, 1)),
    png('png', 2147483647, 1),
    'the largest 31-bit size',
  );
});

test('JPEG: the size comes from an SOF frame header, found after other markers and fill bytes: SOF0 and SOF2', () => {
  for (const progressive of [false, true]) {
    for (const leadingSegments of [true, false]) {
      assert.deepEqual(
        readImageHeader(img.jpegBytes(640, 480, { progressive, leadingSegments })),
        { type: 'jpeg', mimeType: 'image/jpeg', width: 640, height: 480 },
        `progressive ${progressive}, leading segments ${leadingSegments}`,
      );
    }
  }
  assert.deepEqual(readImageHeader(img.jpegBytes(10000, 5000)), {
    type: 'jpeg',
    mimeType: 'image/jpeg',
    width: 10000,
    height: 5000,
  });
  assert.deepEqual(readImageHeader(img.jpegBytes(65535, 65535)), {
    type: 'jpeg',
    mimeType: 'image/jpeg',
    width: 65535,
    height: 65535,
  });
});

test('JPEG: other frame types (SOF1, SOF3, SOF5 to SOF7, SOF9 to SOF11, SOF13 to SOF15) are frame headers too; DHT, JPG and DAC are not', () => {
  const base = img.jpegBytes(321, 123, { leadingSegments: false });
  const at = base.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(at > 0);
  for (const marker of [0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
    const bytes = Buffer.from(base);
    bytes[at + 1] = marker;
    assert.deepEqual(
      readImageHeader(bytes),
      { type: 'jpeg', mimeType: 'image/jpeg', width: 321, height: 123 },
      `SOF marker 0x${marker.toString(16)}`,
    );
  }
  for (const marker of [0xc4, 0xc8, 0xcc]) {
    const bytes = Buffer.from(base);
    bytes[at + 1] = marker; // a table or reserved marker where the frame header was: there is no frame header to read
    assert.deepEqual(
      readImageHeader(bytes),
      { error: 'damaged' },
      `0x${marker.toString(16)} is not a frame header`,
    );
  }
});

test('WebP: the size comes from a VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk, each in its own layout', () => {
  const webp = (width, height) => ({ type: 'webp', mimeType: 'image/webp', width, height });
  assert.deepEqual(
    readImageHeader(img.webpLossyBytes(640, 480)),
    webp(640, 480),
    'VP8: 14-bit sizes',
  );
  assert.deepEqual(
    readImageHeader(img.webpLossyBytes(16383, 16383)),
    webp(16383, 16383),
    'VP8: the largest 14-bit size',
  );
  assert.deepEqual(
    readImageHeader(img.webpLosslessBytes(640, 480)),
    webp(640, 480),
    'VP8L: width - 1 and height - 1',
  );
  assert.deepEqual(readImageHeader(img.webpLosslessBytes(1, 1)), webp(1, 1));
  assert.deepEqual(readImageHeader(img.webpLosslessBytes(10000, 5000)), webp(10000, 5000), 'EC-10');
  assert.deepEqual(
    readImageHeader(img.webpExtendedBytes(640, 480)),
    webp(640, 480),
    'VP8X: the canvas',
  );
  assert.deepEqual(
    readImageHeader(img.webpExtendedBytes(20000, 30000)),
    webp(20000, 30000),
    'VP8X: 24-bit canvas sizes',
  );
  assert.deepEqual(
    readImageHeader(img.webpExtendedBytes(16777216, 16777216)),
    webp(16777216, 16777216),
    'VP8X: the largest canvas',
  );
});

test('unknown type: a PDF, a GIF, plain text, an empty file and a short file are unknownType, whatever their name (EC-36)', () => {
  for (const [label, bytes] of [
    ['pdf', img.pdfBytes()],
    ['gif', img.gifBytes()],
    ['renamed text', img.textBytes()],
    ['empty', Buffer.alloc(0)],
    ['one byte', Buffer.from([0x89])],
    ['zeros', Buffer.alloc(64)],
    ['BMP', Buffer.concat([Buffer.from('BM'), Buffer.alloc(60)])],
    ['TIFF', Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(60)])],
    [
      'RIFF that is not WebP',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WAVEfmt '),
        Buffer.alloc(20),
      ]),
    ],
    [
      'PNG signature with one byte wrong',
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]),
        Buffer.alloc(40),
      ]),
    ],
  ]) {
    assert.deepEqual(readImageHeader(bytes), { error: 'unknownType' }, label);
  }
});

test('damaged: the right magic bytes and a header that cannot be read (truncated, wrong first chunk, zero size, no frame header, bad start code)', () => {
  const damaged = { error: 'damaged' };
  const pngFull = img.pngBytes(100, 80);
  for (const [label, bytes] of [
    ['PNG cut inside IHDR', pngFull.subarray(0, 20)],
    ['PNG signature only', pngFull.subarray(0, 8)],
    [
      'PNG whose first chunk is not IHDR',
      Buffer.concat([
        img.PNG_SIGNATURE,
        Buffer.from([0, 0, 0, 13]),
        Buffer.from('IDAT'),
        Buffer.alloc(17),
      ]),
    ],
    ['PNG with zero width', img.pngBytes(0, 80)],
    ['PNG with zero height', img.pngBytes(100, 0)],
    ['JPEG with nothing after SOI', Buffer.from([0xff, 0xd8])],
    ['JPEG cut inside the first segment', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    ['JPEG with no frame header', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ['JPEG with zero width', img.jpegBytes(0, 480)],
    ['JPEG with zero height', img.jpegBytes(640, 0)],
    [
      'JPEG whose segment length runs past the end',
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x00]),
    ],
    [
      'WebP with no chunk',
      Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]),
    ],
    ['WebP cut inside its chunk', img.webpLosslessBytes(640, 480).subarray(0, 22)],
    [
      'WebP VP8 with a bad start code',
      (() => {
        const bytes = Buffer.from(img.webpLossyBytes(640, 480));
        bytes[23] = 0x00;
        return bytes;
      })(),
    ],
    [
      'WebP VP8L with a bad signature byte',
      (() => {
        const bytes = Buffer.from(img.webpLosslessBytes(640, 480));
        bytes[20] = 0x00;
        return bytes;
      })(),
    ],
    [
      'WebP with an unknown first chunk',
      (() => {
        const bytes = Buffer.from(img.webpLosslessBytes(640, 480));
        bytes.write('ABCD', 12, 'ascii');
        return bytes;
      })(),
    ],
  ]) {
    assert.deepEqual(readImageHeader(bytes), damaged, label);
  }
});

test('the reader never throws and always answers one of the three shapes, for any bytes (untrusted input)', () => {
  const rng = mulberry32(20261013);
  const seeds = [
    img.pngBytes(100, 80),
    img.jpegBytes(100, 80),
    img.webpLossyBytes(100, 80),
    img.webpLosslessBytes(100, 80),
    img.webpExtendedBytes(100, 80),
  ];
  const valid = (r) =>
    r.error === 'unknownType' ||
    r.error === 'damaged' ||
    (['png', 'jpeg', 'webp'].includes(r.type) &&
      r.mimeType === `image/${r.type}` &&
      Number.isInteger(r.width) &&
      Number.isInteger(r.height) &&
      r.width > 0 &&
      r.height > 0);
  for (let i = 0; i < 400; i += 1) {
    let bytes;
    if (i % 4 === 0) {
      bytes = Buffer.alloc(Math.floor(rng() * 80));
      for (let k = 0; k < bytes.length; k += 1) bytes[k] = Math.floor(rng() * 256);
    } else {
      bytes = Buffer.from(seeds[i % seeds.length]);
      for (let m = 0; m < 1 + Math.floor(rng() * 4); m += 1)
        bytes[Math.floor(rng() * bytes.length)] = Math.floor(rng() * 256);
      if (i % 3 === 0) bytes = bytes.subarray(0, Math.floor(rng() * bytes.length));
    }
    let result;
    assert.doesNotThrow(() => {
      result = readImageHeader(bytes);
    }, `case ${i}`);
    assert.ok(valid(result), `case ${i}: ${JSON.stringify(result)}`);
  }
});
