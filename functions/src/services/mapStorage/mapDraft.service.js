// The venue map's draft (spec/OA-2.md r1 sections 3.3, 3.4 and 3.7; plan/OA-2-map-storage.md 1.0 sections 5.1 and 5.3):
// load (AC-11, AC-12), save (AC-13 to AC-23) and clear (AC-35). The tenant is the route's req.tenantCompanyID and
// nothing else (rule 2); the actor comes from the request context (getActorId).
//
// The save's order of refusals (AC-18): the venue (404, no lock), the body (400), the document (400 with problems), the
// backdrop keys (400 problem), then, in one transaction under the venue lock (lockVenue, FOR NO KEY UPDATE; DC-3) taken
// BEFORE the DraftVersion read (AC-17): the keys again (an upload's prune may have removed one meanwhile; DC-A6), the
// version (409, never a merge) and the conditional write. Validation runs before the lock, so the lock is held for the
// short statements only (DC-4). A first save takes the same lock, so two first saves give one 200 and one 409 (AC-16).
'use strict';

const { validateMap } = require('../venueMap');
const { lockVenue } = require('../venueLock');
const { getActorId, assertTenantId } = require('../../utils/requestContext');
const { loadMapContext } = require('./mapContext.repository');
const maps = require('./venueMap.repository');
const versions = require('./venueVersion.repository');
const backdrops = require('./backdrop.repository');
const { readBaseVersion, readLayout } = require('./mapEnvelope');
const { backdropKeysOf, unknownKeyProblem } = require('./backdropKeys');
const { staleDraft, mapProblems } = require('./mapErrors');

const { requireVenue } = maps;
const iso = (date) => (date ? date.toISOString() : null);

/** AC-19: a 400 problem for each level backdrop key that names no image of this venue. */
async function checkBackdropKeys(q, tenantId, venueId, map) {
  const named = backdropKeysOf(map);
  if (named.length === 0) return;
  const known = await backdrops.existingKeys(
    q,
    tenantId,
    venueId,
    named.map((n) => n.key),
  );
  const problems = named.filter((n) => !known.has(n.key)).map(unknownKeyProblem);
  if (problems.length > 0) throw mapProblems({ problems, total: problems.length });
}

/**
 * @param {object} deps
 * @param {{ query: Function, withTransaction: Function }} deps.db
 */
function createMapDraftService({ db }) {
  return {
    /** AC-11: the draft, its versions, and a running publish; a venue with no map gets the empty shape and no row. */
    async load(tenantId, venueId) {
      assertTenantId(tenantId);
      const venue = await requireVenue(db, tenantId, venueId);
      const row = await maps.readMapRow(db, tenantId, venueId);
      const published = await versions.listPublished(db, tenantId, venueId);
      const building = await versions.buildingRow(db, tenantId, venueId);
      return {
        venue,
        draft: row?.draft ?? null,
        draftVersion: row?.draftVersion ?? 0,
        publishedVersion: row?.publishedVersion ?? null,
        updatedAt: iso(row?.updatedAt),
        versions: published.map((v) => ({
          version: v.version,
          publishedAt: iso(v.publishedAt),
          publishedBy: v.publishedBy,
        })),
        publishing: building
          ? { version: building.versionNo, startedAt: iso(building.createdAt) }
          : null,
      };
    },

    /** AC-13 to AC-23: autosave { layout, baseVersion }; answers { draftVersion, updatedAt }. */
    async save(tenantId, venueId, body) {
      assertTenantId(tenantId);
      await requireVenue(db, tenantId, venueId);
      const base = readBaseVersion(body);
      const layout = readLayout(body);
      const { context } = await loadMapContext(db, tenantId);
      const result = validateMap(layout, context);
      if (!result.ok) throw mapProblems(result);
      const draft = result.map; // the canonical copy, never the request's object (OA-1 AC-24)
      await checkBackdropKeys(db, tenantId, venueId, draft);

      const saved = await db.withTransaction(async (tx) => {
        await lockVenue(tx, tenantId, venueId);
        await checkBackdropKeys(tx, tenantId, venueId, draft);
        const row = await maps.readMapRow(tx, tenantId, venueId);
        const actor = getActorId();
        if (!row) {
          if (base !== 0) throw staleDraft(0);
          return maps.insertMap(tx, tenantId, venueId, { draft, actor });
        }
        if (row.draftVersion !== base) throw staleDraft(row.draftVersion);
        const written = await maps.writeDraft(tx, tenantId, venueId, base, { draft, actor });
        if (!written) throw staleDraft(row.draftVersion);
        return written;
      });
      return { draftVersion: saved.draftVersion, updatedAt: iso(saved.updatedAt) };
    },

    /** AC-35: { baseVersion } -> DraftJson NULL, DraftVersion + 1; nothing else changes, nothing is deleted. */
    async clear(tenantId, venueId, body) {
      assertTenantId(tenantId);
      await requireVenue(db, tenantId, venueId);
      const base = readBaseVersion(body);
      return db.withTransaction(async (tx) => {
        await lockVenue(tx, tenantId, venueId);
        const row = await maps.readMapRow(tx, tenantId, venueId);
        const stored = row?.draftVersion ?? 0;
        if (stored !== base) throw staleDraft(stored);
        if (!row || row.draft === null) return { draftVersion: stored }; // nothing to clear: no write
        const written = await maps.writeDraft(tx, tenantId, venueId, base, {
          draft: null,
          actor: getActorId(),
        });
        if (!written) throw staleDraft(stored);
        return { draftVersion: written.draftVersion };
      });
    },
  };
}

module.exports = { createMapDraftService };
