// The key-status loader (spec/OA-3.md r2 AC-11, H-7; plan/OA-3a-migration-rekey.md 1.1 section 6, DC-B): the ONE reader of
// the element indexes every writer of a keyed row compares its keys with, through OA-1's keyStatus (spec/OA-1.md AC-41,
// AC-42). The save's key check (AC-9) uses it now; the import (OA-3d, AC-42), OA-4's stores, FF-11's beacons and P1-01's
// closures use it later. There is no second reader of the indexes (a scan test checks that only this file builds them).
//
//   loadKeyIndexes(q, tenantId, venueId, { draft, published = true }) -> { draftIndex, publishedIndex }
//     draft      a canonical map to index as the draft (the save's incoming draft, the import's file map); when it is not
//                given, the stored draft is indexed (VenueMap.DraftJson), or none when there is no draft or no map row
//     published  false skips the published layout (the save needs the draft index only, DC-5, DC-B: a save never reads a
//                layout of up to MAX_MAP_BYTES and an unreadable published layout cannot refuse it)
//   The published index is built from VenueVersion.LayoutJson of VenueMap.PublishedVersion through readMap, never
//   re-validated (OA-1 AC-36; invariant 3), or null when the venue was never published. A layout of a spec this code does not
//   know refuses with OA-2 AC-31's 409 text. Each index is OA-1's elementIndex(map), or null.
//   `q` is anything with query(text, params): the db, or a transaction's tx. The tenant is the request's (rule 2).
'use strict';

const { elementIndex, readMap } = require('../venueMap');
const { httpError } = require('../../utils/errors');
const maps = require('./venueMap.repository');
const versions = require('./venueVersion.repository');

/** OA-2 AC-31's refusal for a published layout made by a newer or unknown version of Gabay. */
const unreadableVersion = (version) =>
  httpError(409, `Version ${version} was made by a newer or unknown version of Gabay`);

async function publishedIndexOf(q, tenantId, venueId, row) {
  const version = row?.publishedVersion ?? null;
  if (version === null) return null;
  const stored = await versions.publishedLayout(q, tenantId, venueId, version);
  if (stored === undefined) return null;
  const read = readMap(stored);
  if (!read.ok) throw unreadableVersion(version);
  return elementIndex(read.map);
}

/**
 * @param {{ query: Function }} q
 * @param {number} tenantId  req.tenantCompanyID
 * @param {number} venueId
 * @param {{ draft?: object, published?: boolean }} [options]
 * @returns {Promise<{ draftIndex: object|null, publishedIndex: object|null }>}
 */
async function loadKeyIndexes(q, tenantId, venueId, { draft, published = true } = {}) {
  const needsRow = draft === undefined || published;
  const row = needsRow ? await maps.readMapRow(q, tenantId, venueId) : null;
  const draftMap = draft === undefined ? (row?.draft ?? null) : draft;
  return {
    draftIndex: draftMap === null ? null : elementIndex(draftMap),
    publishedIndex: published ? await publishedIndexOf(q, tenantId, venueId, row) : null,
  };
}

module.exports = { loadKeyIndexes };
