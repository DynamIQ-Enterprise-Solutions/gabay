// The builder port (spec/OA-2.md r1 AC-26, AC-27, AC-30, section 11 "For FF-3'"; plan/OA-2-map-storage.md 1.0
// section 4.4, DC-A7, DC-A8): what publish and rollback call, outside the venue lock, to turn a frozen layout into a
// package. FF-3' fills it with the publish engine; until then createApp gets null and both routes answer 501 after
// their checks (AC-30). The tests use a fake builder.
//
//   mapBuilder: null, or
//   {
//     formatVersion: <integer>,        written on the BUILDING row (VenueVersion.PackageFormatVersion is NOT NULL)
//     async build({ tenantId, venueId, versionNo, layout }) {
//       // layout: publishable(canonical draft), frozen. The builder reads its own Occupant and Beacon rows (A2').
//       return { ok: true, bytes, mimeType, extension, nodeCount, edgeCount, warnings };   // warnings: string[]
//       // or { ok: false, problems }   a refusal: L170 Q2's blocking set beyond the validator (AC-27)
//       // or it throws                 a failure (AC-27)
//     },
//   }
//
// OA-2 owns the package file's whole life (DC-A7): it writes `bytes` through the FileStore under
// packages/<tenantId>/<venueId>/v<versionNo>-<sha256>.<extension>, inserts the StoredFile row, and removes the file if
// anything after the write fails.
//
// CONTRACT ONLY (plan section 13 step 3): assertMapBuilder accepts anything until OA-2 step 5, which makes it refuse a
// builder that is not null and lacks an integer formatVersion or a build function, so a malformed builder fails when
// the app is built, not at the first publish.
'use strict';

/**
 * @param {null|{ formatVersion: number, build: Function }} builder
 * @returns {null|{ formatVersion: number, build: Function }} the same builder
 */
function assertMapBuilder(builder) {
  return builder;
}

module.exports = { assertMapBuilder };
