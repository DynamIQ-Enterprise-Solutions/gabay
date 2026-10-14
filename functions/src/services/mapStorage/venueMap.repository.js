// VenueMap SQL, and the venue row the map routes check first (spec/OA-2.md r1 sections 2.1, 3.3, 3.4, 3.7; plan/OA-2-
// map-storage.md 1.0 section 4.2). Every statement binds TenantId = $1 from the request tenant (rule 2) and every value
// is a parameter (rule 3). A draft is written as the canonical copy's JSON text cast to jsonb (OA-1 AC-24). Writes stamp
// UpdatedAt with clock_timestamp() (on the first insert too, so updatedAt is never null after a save: DC-A26).
'use strict';

const { notFound } = require('./mapErrors');

/** The venue as the load shows it, or null when the tenant has no such venue. No lock. */
async function readVenue(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT VenueId AS id, Code AS code, Name AS name, IsActive AS "isActive"
       FROM gabay.Venue
      WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId],
  );
  return rows[0] ?? null;
}

/**
 * The venue, or 404 when the tenant has no such venue (AC-8). No lock: the checks before a write run without it, and the
 * write's transaction takes lockVenue (DC-A5).
 */
async function requireVenue(q, tenantId, venueId) {
  const venue = await readVenue(q, tenantId, venueId);
  if (!venue) throw notFound();
  return venue;
}

/** The venue's map row: { draft, draftVersion, publishedVersion, updatedAt }, or null when it has none. */
async function readMapRow(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT DraftJson AS draft, DraftVersion AS "draftVersion", PublishedVersion AS "publishedVersion",
            UpdatedAt AS "updatedAt"
       FROM gabay.VenueMap
      WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId],
  );
  return rows[0] ?? null;
}

/**
 * The first write of a venue's map: a new row at draftVersion 1 (a save, or a rollback of a venue with no row).
 * @returns {Promise<{ draftVersion: number, updatedAt: Date }>}
 */
async function insertMap(q, tenantId, venueId, { draft, publishedVersion = null, actor }) {
  const { rows } = await q.query(
    `INSERT INTO gabay.VenueMap (TenantId, VenueId, DraftJson, DraftVersion, PublishedVersion, CreatedBy, UpdatedBy, UpdatedAt)
     VALUES ($1, $2, $3::jsonb, 1, $4, $5, $5, clock_timestamp())
     RETURNING DraftVersion AS "draftVersion", UpdatedAt AS "updatedAt"`,
    [tenantId, venueId, JSON.stringify(draft), publishedVersion, actor],
  );
  return rows[0];
}

/**
 * The conditional write of a draft (AC-17): only when the stored DraftVersion is still `base`. `draft` null clears it.
 * @returns {Promise<{ draftVersion: number, updatedAt: Date } | null>} null when no row matched (a stale base)
 */
async function writeDraft(q, tenantId, venueId, base, { draft, actor }) {
  const { rows } = await q.query(
    `UPDATE gabay.VenueMap
        SET DraftJson = $4::jsonb, DraftVersion = DraftVersion + 1, UpdatedBy = $5, UpdatedAt = clock_timestamp()
      WHERE TenantId = $1 AND VenueId = $2 AND DraftVersion = $3
     RETURNING DraftVersion AS "draftVersion", UpdatedAt AS "updatedAt"`,
    [tenantId, venueId, base, draft === null ? null : JSON.stringify(draft), actor],
  );
  return rows[0] ?? null;
}

/** Points the venue's map at the version shown live. The draft and its UpdatedAt are left alone. */
async function setPublishedVersion(q, tenantId, venueId, versionNo) {
  await q.query(
    `UPDATE gabay.VenueMap SET PublishedVersion = $3 WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId, versionNo],
  );
}

module.exports = {
  readVenue,
  requireVenue,
  readMapRow,
  insertMap,
  writeDraft,
  setPublishedVersion,
};
