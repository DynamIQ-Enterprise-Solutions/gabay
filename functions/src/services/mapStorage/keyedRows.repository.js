// The relational rows of a venue that name an element of its map document by key (spec/OA-3.md r2 AC-9, AC-10; plan/
// OA-3a-migration-rekey.md 1.1 section 6, DC-D): stores and their status history name a unit, beacons, beacon plans,
// sentinels and closures name a level, and a closure may name a connector. Read for the key check of a draft save, inside
// and outside its transaction (DC-C).
//
// Seven literal statements, one per key column, each bound to the request's tenant and the path's venue
// (WHERE TenantId = $1 AND VenueId = $2; rule 2), so the tenant-predicate lint reads every one; no table or column name is
// built from text (rule 3). Keys are unique only within a venue (AC-10, EC-10), so another venue's rows, even of the same
// tenant, are never read. Active and inactive rows both count (DC-5): an old row must not end up naming another kind.
//
//   readKeyedRows(q, tenantId, venueId) -> [{ key, kind, holder }] in the order of KEYED below, then by key; each key once
//   per holder. `kind` is the element kind the row expects (the schema file's kind name); `holder` names the row for a
//   person ("a store", "a beacon", ...). `q` is anything with query(text, params): the db, or a transaction's tx.
'use strict';

/** Each key column: its statement, the kind of element it names, and how a problem names the row. */
const KEYED = Object.freeze([
  Object.freeze({
    kind: 'unit',
    holder: 'a store',
    text: `SELECT DISTINCT UnitKey AS key FROM gabay.Occupant WHERE TenantId = $1 AND VenueId = $2 ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'unit',
    holder: "a store's status history",
    text: `SELECT DISTINCT UnitKey AS key FROM gabay.StoreStatusChange WHERE TenantId = $1 AND VenueId = $2 ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'level',
    holder: 'a beacon',
    text: `SELECT DISTINCT LevelKey AS key FROM gabay.Beacon WHERE TenantId = $1 AND VenueId = $2 ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'level',
    holder: 'a beacon plan',
    text: `SELECT DISTINCT LevelKey AS key FROM gabay.BeaconPlan WHERE TenantId = $1 AND VenueId = $2 ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'level',
    holder: 'a sentinel',
    text: `SELECT DISTINCT LevelKey AS key FROM gabay.Sentinel WHERE TenantId = $1 AND VenueId = $2 ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'level',
    holder: 'a closure',
    text: `SELECT DISTINCT LevelKey AS key FROM gabay.Closure
            WHERE TenantId = $1 AND VenueId = $2 AND LevelKey IS NOT NULL ORDER BY 1`,
  }),
  Object.freeze({
    kind: 'connector',
    holder: 'a closure',
    text: `SELECT DISTINCT ConnectorKey AS key FROM gabay.Closure
            WHERE TenantId = $1 AND VenueId = $2 AND ConnectorKey IS NOT NULL ORDER BY 1`,
  }),
]);

/**
 * @param {{ query: Function }} q  the db or a transaction
 * @param {number} tenantId  req.tenantCompanyID
 * @param {number} venueId  the path's venue
 * @returns {Promise<{ key: string, kind: string, holder: string }[]>}
 */
async function readKeyedRows(q, tenantId, venueId) {
  const out = [];
  for (const { kind, holder, text } of KEYED) {
    const { rows } = await q.query(text, [tenantId, venueId]);
    for (const row of rows) out.push({ key: row.key, kind, holder });
  }
  return out;
}

module.exports = { readKeyedRows, KEYED };
