// VenueMapBackdrop and StoredFile SQL (spec/OA-2.md r1 AC-19, AC-38 to AC-41; plan/OA-2-map-storage.md 1.0 sections 4.2
// and 5.4). A stored file (a backdrop image or a publish package) is one StoredFile row whose StoragePath is the
// FileStore key. Every statement binds TenantId = $1 from the request tenant (rule 2) and every value is a parameter
// (rule 3).
'use strict';

/** Which of `keys` name a backdrop of this tenant's venue (AC-19). */
async function existingKeys(q, tenantId, venueId, keys) {
  const { rows } = await q.query(
    `SELECT BackdropKey AS key
       FROM gabay.VenueMapBackdrop
      WHERE TenantId = $1 AND VenueId = $2 AND BackdropKey = ANY($3::text[])`,
    [tenantId, venueId, keys],
  );
  return new Set(rows.map((r) => r.key));
}

/**
 * The prune's set (AC-41): the venue's backdrops uploaded before `cutoff` whose key is not in `keep`.
 * @returns {Promise<{ key: string, fileId: string, storagePath: string }[]>}
 */
async function pruneCandidates(q, tenantId, venueId, cutoff, keep) {
  const { rows } = await q.query(
    `SELECT k.BackdropKey AS key, k.FileId AS "fileId", f.StoragePath AS "storagePath"
       FROM gabay.VenueMapBackdrop AS k
       JOIN gabay.StoredFile AS f ON f.TenantId = k.TenantId AND f.FileId = k.FileId
      WHERE k.TenantId = $1 AND f.TenantId = $1 AND k.VenueId = $2
        AND k.CreatedAt < $3 AND NOT (k.BackdropKey = ANY($4::text[]))`,
    [tenantId, venueId, cutoff, keep],
  );
  return rows;
}

/** Deletes backdrop rows by key, then their StoredFile rows (the files are removed after the commit, DC-A18). */
async function deleteBackdrops(q, tenantId, venueId, backdrops) {
  if (backdrops.length === 0) return;
  await q.query(
    `DELETE FROM gabay.VenueMapBackdrop WHERE TenantId = $1 AND VenueId = $2 AND BackdropKey = ANY($3::text[])`,
    [tenantId, venueId, backdrops.map((b) => b.key)],
  );
  await q.query(`DELETE FROM gabay.StoredFile WHERE TenantId = $1 AND FileId = ANY($2::bigint[])`, [
    tenantId,
    backdrops.map((b) => b.fileId),
  ]);
}

/** How many backdrops the venue has (AC-39's limit, counted after the prune). */
async function countForVenue(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT count(*)::int AS n FROM gabay.VenueMapBackdrop WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId],
  );
  return rows[0].n;
}

/**
 * A StoredFile row for a file just written through the FileStore.
 * @returns {Promise<string>} its FileId (BIGINT, as text)
 */
async function insertStoredFile(
  q,
  tenantId,
  { purpose, mimeType, sizeBytes, sha256, storagePath, actor },
) {
  const { rows } = await q.query(
    `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath, CreatedBy)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING FileId`,
    [tenantId, purpose, mimeType, sizeBytes, sha256, storagePath, actor],
  );
  return rows[0].fileid;
}

/** The backdrop row of an upload. */
async function insertBackdrop(q, tenantId, venueId, { key, fileId, width, height, actor }) {
  await q.query(
    `INSERT INTO gabay.VenueMapBackdrop (BackdropKey, TenantId, VenueId, FileId, WidthPx, HeightPx, CreatedBy)
     VALUES ($3, $1, $2, $4, $5, $6, $7)`,
    [tenantId, venueId, key, fileId, width, height, actor],
  );
}

/** One backdrop of this tenant's venue with its file: { mimeType, storagePath }, or null (AC-40). */
async function readBackdrop(q, tenantId, venueId, key) {
  const { rows } = await q.query(
    `SELECT f.MimeType AS "mimeType", f.StoragePath AS "storagePath"
       FROM gabay.VenueMapBackdrop AS k
       JOIN gabay.StoredFile AS f ON f.TenantId = k.TenantId AND f.FileId = k.FileId
      WHERE k.TenantId = $1 AND f.TenantId = $1 AND k.VenueId = $2 AND k.BackdropKey = $3`,
    [tenantId, venueId, key],
  );
  return rows[0] ?? null;
}

module.exports = {
  existingKeys,
  pruneCandidates,
  deleteBackdrops,
  countForVenue,
  insertStoredFile,
  insertBackdrop,
  readBackdrop,
};
