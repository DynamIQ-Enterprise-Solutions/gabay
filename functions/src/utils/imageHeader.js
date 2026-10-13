// readImageHeader (spec/OA-2.md r1 AC-38, AC-39, DC-13, EC-37; plan/OA-2-map-storage.md 1.0 section 4.3): the type of
// an uploaded image from its magic bytes only (never its name or Content-Type), and its pixel size from its header
// only, with no decoding, so a header claiming 60,000 x 60,000 in a tiny file is refused from the header alone. Pure:
// it reads the bytes it is given and nothing else.
//
//   { type: 'png' | 'jpeg' | 'webp', mimeType, width, height }   a readable header
//   { error: 'unknownType' }                                     not PNG, JPEG or WebP magic bytes (the route: 415)
//   { error: 'damaged' }                                         the right magic bytes, an unreadable header (400)
//
// Layouts (checked at OA-2 step 0 against the specifications, pasted in the PR): PNG signature 89 50 4E 47 0D 0A 1A 0A,
// then the IHDR chunk first (width, height: 4-byte big-endian, zero invalid; W3C PNG, Third Edition); JPEG SOI FF D8,
// then marker segments (2-byte big-endian lengths, optional FF fill bytes) up to an SOFn frame header (FF C0 to FF CF,
// except C4 DHT, C8 JPG and CC DAC) holding P, then Y lines and X samples per line (ITU-T T.81 Annex B, B.1.1, B.2.2,
// Table B.1); WebP RIFF....WEBP, then a 'VP8 ' chunk (key frame start code 9D 01 2A, then 14-bit width and height,
// little-endian; RFC 6386 section 9.1), a 'VP8L' chunk (signature 2F, then 14-bit width - 1 and height - 1, least
// significant bit first; WebP lossless bitstream section 3) or a 'VP8X' chunk (24-bit canvas width - 1 and height - 1,
// little-endian; WebP container specification).
//
// CONTRACT ONLY (plan section 13 step 3): built in OA-2 step 5.
'use strict';

/**
 * @param {Buffer} _bytes  the uploaded file
 * @returns {{ type: 'png'|'jpeg'|'webp', mimeType: string, width: number, height: number }
 *   | { error: 'unknownType' } | { error: 'damaged' }}
 */
function readImageHeader(_bytes) {
  throw new Error('readImageHeader: not built yet (OA-2 step 5)');
}

module.exports = { readImageHeader };
