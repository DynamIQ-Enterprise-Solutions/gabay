// VenueVersion SQL for publish and rollback (spec/OA-2.md r1 sections 3.3, 3.5, 3.6; P0-03 AC-3, AC-7, AC-10; plan/OA-2-
// map-storage.md 1.0 sections 4.2 and 5.2). A row goes BUILDING (the claim, holding the frozen layout) -> PUBLISHED (the
// finalize) or FAILED (a builder failure, or a stale build); a refused build's BUILDING row is deleted.
// TR_VenueVersion_Frozen refuses any change to a PUBLISHED row, so every write here names Status = 'BUILDING'. Every
// statement binds TenantId = $1 (rule 2) and every value is a parameter (rule 3).
'use strict';

/** The venue's highest VersionNo of any status, or 0: the next version is this + 1 (the counter never goes back). */
async function highestVersionNo(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT COALESCE(MAX(VersionNo), 0) AS n FROM gabay.VenueVersion WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId],
  );
  return Number(rows[0].n);
}

/** The venue's BUILDING row, { versionNo, createdAt }, or null (the newest, should there ever be two). */
async function buildingRow(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT VersionNo AS "versionNo", CreatedAt AS "createdAt"
       FROM gabay.VenueVersion
      WHERE TenantId = $1 AND VenueId = $2 AND Status = 'BUILDING'
      ORDER BY VersionNo DESC
      LIMIT 1`,
    [tenantId, venueId],
  );
  return rows[0] ?? null;
}

/** Sets a BUILDING row FAILED (a stale build, or a builder failure). */
async function markFailed(q, tenantId, venueId, versionNo) {
  await q.query(
    `UPDATE gabay.VenueVersion SET Status = 'FAILED', UpdatedAt = clock_timestamp()
      WHERE TenantId = $1 AND VenueId = $2 AND VersionNo = $3 AND Status = 'BUILDING'`,
    [tenantId, venueId, versionNo],
  );
}

/** The claim: a BUILDING row holding the frozen layout. */
async function insertBuilding(q, tenantId, venueId, { versionNo, layout, formatVersion, actor }) {
  await q.query(
    `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion, LayoutJson, CreatedBy)
     VALUES ($1, $2, $3, 'BUILDING', $4, $5::jsonb, $6)`,
    [tenantId, venueId, versionNo, formatVersion, JSON.stringify(layout), actor],
  );
}

/** A refused build leaves no row: its BUILDING row is deleted (the frozen trigger allows it, AC-27). */
async function deleteBuilding(q, tenantId, venueId, versionNo) {
  await q.query(
    `DELETE FROM gabay.VenueVersion
      WHERE TenantId = $1 AND VenueId = $2 AND VersionNo = $3 AND Status = 'BUILDING'`,
    [tenantId, venueId, versionNo],
  );
}

/**
 * The finalize: the BUILDING row becomes PUBLISHED with its package.
 * @returns {Promise<boolean>} false when the row is no longer BUILDING (a later publish set it FAILED as stale)
 */
async function markPublished(q, tenantId, venueId, versionNo, pkg) {
  const { rows } = await q.query(
    `UPDATE gabay.VenueVersion
        SET Status = 'PUBLISHED', PackageFileId = $4, PackageSha256 = $5, NodeCount = $6, EdgeCount = $7,
            PublishedAt = clock_timestamp(), PublishedBy = $8, UpdatedBy = $8, UpdatedAt = clock_timestamp()
      WHERE TenantId = $1 AND VenueId = $2 AND VersionNo = $3 AND Status = 'BUILDING'
     RETURNING VersionNo`,
    [tenantId, venueId, versionNo, pkg.fileId, pkg.sha256, pkg.nodeCount, pkg.edgeCount, pkg.actor],
  );
  return rows.length === 1;
}

/** The venue's PUBLISHED versions, newest first: [{ version, publishedAt, publishedBy }] (AC-11, DC-9: unpaged). */
async function listPublished(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT VersionNo AS version, PublishedAt AS "publishedAt", PublishedBy AS "publishedBy"
       FROM gabay.VenueVersion
      WHERE TenantId = $1 AND VenueId = $2 AND Status = 'PUBLISHED'
      ORDER BY VersionNo DESC`,
    [tenantId, venueId],
  );
  return rows;
}

/** The frozen layout of one PUBLISHED version of the venue, or undefined when there is no such version. */
async function publishedLayout(q, tenantId, venueId, versionNo) {
  const { rows } = await q.query(
    `SELECT LayoutJson AS layout
       FROM gabay.VenueVersion
      WHERE TenantId = $1 AND VenueId = $2 AND VersionNo = $3 AND Status = 'PUBLISHED'`,
    [tenantId, venueId, versionNo],
  );
  return rows.length === 1 ? rows[0].layout : undefined;
}

module.exports = {
  highestVersionNo,
  buildingRow,
  markFailed,
  insertBuilding,
  deleteBuilding,
  markPublished,
  listPublished,
  publishedLayout,
};
