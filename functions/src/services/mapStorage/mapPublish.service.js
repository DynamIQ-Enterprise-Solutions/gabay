// Publish and rollback of a venue map (spec/OA-2.md r1 sections 3.5 and 3.6; P0-03 AC-2 to AC-10; plan/OA-2-map-
// storage.md 1.0 sections 4.4 and 5.2; the owner's ruling 18a Q3 (a)). The tenant is the route's req.tenantCompanyID
// only (rule 2); the actor comes from the request context.
//
// Three steps, so autosave never waits on a build (DC-12):
//   1. the claim, one transaction under the venue lock: the refusals in plan 5.2's order (the draft or the old version,
//      its re-validation with today's context, a running publish, the base version, no engine), then a BUILDING
//      VenueVersion row that holds the frozen layout, publishable(canonical) (OA-1 AC-34);
//   2. the build, outside any transaction, through the builder port (mapBuilderPort.js);
//   3. the finalize, one transaction under the venue lock: the package written through the FileStore, its StoredFile row,
//      the row set PUBLISHED, VenueMap.PublishedVersion set; for a rollback, the restored layout becomes the draft, with
//      its backdrops re-attached (AC-34), only if no save landed during the build (Q3 (a): otherwise the version still
//      publishes, the draft saved meanwhile is kept, and the answer is a 409 naming both versions).
// A refused build deletes its BUILDING row (400 { error, problems }). A thrown build, or any failure after it, removes the
// written file, sets the row FAILED in its own statement and is the generic 500 (AC-27). A BUILDING row older than the
// setting publish.buildingStaleS is set FAILED by the next claim, which goes on (P0-03 AC-10).
'use strict';

const crypto = require('node:crypto');
const { validateMap, readMap, publishable } = require('../venueMap');
const { lockVenue } = require('../venueLock');
const { httpError } = require('../../utils/errors');
const { getActorId, assertTenantId } = require('../../utils/requestContext');
const { loadMapContext } = require('./mapContext.repository');
const maps = require('./venueMap.repository');
const versions = require('./venueVersion.repository');
const { insertStoredFile } = require('./backdrop.repository');
const { isStorableVersion } = require('./mapEnvelope');
const { restoreBackdrops } = require('./restoreBackdrops');
const { staleDraft, publishRunning, noEngine, mapProblems } = require('./mapErrors');

const STALE_SETTING = 'publish.buildingStaleS';
const NO_DRAFT = 'There is no draft to publish';
/** A package's file extension, as the storage key carries it (packages/<t>/<v>/v<n>-<sha256>.<extension>). */
const EXTENSION = /^[a-z0-9]{1,10}$/;

const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function deepFreeze(value) {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** What the builder answered on success, checked: anything else is a failure of the engine (a 500). */
function packageOf(result) {
  const bytes = Buffer.isBuffer(result?.bytes) ? result.bytes : null;
  const count = (n) => (n === null || n === undefined ? null : n);
  const valid =
    bytes !== null &&
    typeof result.mimeType === 'string' &&
    result.mimeType.length > 0 &&
    result.mimeType.length <= 100 &&
    typeof result.extension === 'string' &&
    EXTENSION.test(result.extension) &&
    [result.nodeCount, result.edgeCount].every(
      (n) => n === null || n === undefined || (Number.isInteger(n) && n >= 0),
    ) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((w) => typeof w === 'string');
  if (!valid)
    throw new Error('the publish engine answered a package that does not follow the builder port');
  return {
    bytes,
    mimeType: result.mimeType,
    extension: result.extension,
    nodeCount: count(result.nodeCount),
    edgeCount: count(result.edgeCount),
    warnings: [...result.warnings],
  };
}

/**
 * @param {object} deps
 * @param {{ query: Function, withTransaction: Function }} deps.db
 * @param {{ getSetting: Function }} deps.settings  publish.buildingStaleS
 * @param {import('../storage/fileStore').FileStore} deps.fileStore  where packages are written
 * @param {null|{ formatVersion: number, build: Function }} deps.mapBuilder  the port (mapBuilderPort.js); null: 501
 * @param {() => number} deps.now  the clock in milliseconds, for the stale check (DC-A12)
 * @param {{ error: Function }} deps.logger
 */
function createMapPublishService({ db, settings, fileStore, mapBuilder, now, logger }) {
  /** Plan 5.2 step 6: a running publish of the venue refuses; a stale one is set FAILED and the claim goes on. */
  async function clearStaleBuild(tx, tenantId, venueId) {
    const building = await versions.buildingRow(tx, tenantId, venueId);
    if (!building) return;
    const staleS = Number(await settings.getSetting(STALE_SETTING, tenantId));
    if (now() - building.createdAt.getTime() < staleS * 1000) throw publishRunning();
    await versions.markFailed(tx, tenantId, venueId, building.versionNo);
  }

  /**
   * Step 1. `prepare(tx, row)` gives the route's own refusals and returns { layout, ... } (the canonical layout to
   * freeze); then the shared ones; then the BUILDING row.
   */
  function claim(tenantId, venueId, base, prepare) {
    return db.withTransaction(async (tx) => {
      await lockVenue(tx, tenantId, venueId);
      const row = await maps.readMapRow(tx, tenantId, venueId);
      const prepared = await prepare(tx, row);
      await clearStaleBuild(tx, tenantId, venueId);
      const stored = row?.draftVersion ?? 0;
      if (stored !== base) throw staleDraft(stored);
      if (!mapBuilder) throw noEngine();
      const versionNo = (await versions.highestVersionNo(tx, tenantId, venueId)) + 1;
      const layout = publishable(prepared.canonical);
      await versions.insertBuilding(tx, tenantId, venueId, {
        versionNo,
        layout,
        formatVersion: mapBuilder.formatVersion,
        actor: getActorId(),
      });
      return { ...prepared, versionNo, layout };
    });
  }

  /** A failure after the claim: the row is set FAILED in its own statement, and the error is rethrown (a 500). */
  async function fail(tenantId, venueId, versionNo, err) {
    try {
      await versions.markFailed(db, tenantId, venueId, versionNo);
    } catch (markErr) {
      logger.error({ err: markErr, venueId, versionNo }, 'could not set a failed publish FAILED');
    }
    throw err;
  }

  /** Step 2: the build, outside any transaction. A refusal deletes the BUILDING row and is a 400. */
  async function build(tenantId, venueId, claimed) {
    let result;
    try {
      result = await mapBuilder.build({
        tenantId,
        venueId,
        versionNo: claimed.versionNo,
        layout: deepFreeze(structuredClone(claimed.layout)),
      });
    } catch (err) {
      return fail(tenantId, venueId, claimed.versionNo, err);
    }
    if (result?.ok === false) {
      await versions.deleteBuilding(db, tenantId, venueId, claimed.versionNo);
      const problems = Array.isArray(result.problems) ? result.problems.map(String) : [];
      throw httpError(400, `This map cannot be published: ${problems.length} problem(s)`, {
        extra: { problems },
      });
    }
    try {
      return packageOf(result);
    } catch (err) {
      return fail(tenantId, venueId, claimed.versionNo, err);
    }
  }

  /**
   * Step 3: the package and the PUBLISHED row in one transaction under the lock; `afterPublish(tx)` adds the route's own
   * writes and returns its answer. Any failure removes the written file and sets the row FAILED.
   */
  async function finalize(tenantId, venueId, claimed, pkg, afterPublish) {
    const sha256 = sha256Of(pkg.bytes);
    const key = `packages/${tenantId}/${venueId}/v${claimed.versionNo}-${sha256}.${pkg.extension}`;
    let written = false;
    try {
      return await db.withTransaction(async (tx) => {
        await lockVenue(tx, tenantId, venueId);
        const stored = await fileStore.put(key, pkg.bytes);
        written = true;
        const actor = getActorId();
        const fileId = await insertStoredFile(tx, tenantId, {
          purpose: 'PACKAGE',
          mimeType: pkg.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          storagePath: key,
          actor,
        });
        const published = await versions.markPublished(tx, tenantId, venueId, claimed.versionNo, {
          fileId,
          sha256: stored.sha256,
          nodeCount: pkg.nodeCount,
          edgeCount: pkg.edgeCount,
          actor,
        });
        if (!published) {
          throw new Error(
            `version ${claimed.versionNo} is no longer BUILDING (set FAILED as stale)`,
          );
        }
        await maps.setPublishedVersion(tx, tenantId, venueId, claimed.versionNo);
        return afterPublish(tx);
      });
    } catch (err) {
      if (written) {
        await fileStore.remove(key).catch((removeErr) => {
          logger.error({ err: removeErr, key }, 'could not remove the package of a failed publish');
        });
      }
      return fail(tenantId, venueId, claimed.versionNo, err);
    }
  }

  return {
    /**
     * AC-24 to AC-30: -> { publishedVersion, draftVersion, warnings }.
     * @param {{ baseVersion: number }} body  validated (mapEnvelope.js stateChangeBody)
     */
    async publish(tenantId, venueId, { baseVersion: base }) {
      assertTenantId(tenantId);
      await maps.requireVenue(db, tenantId, venueId);
      const claimed = await claim(tenantId, venueId, base, async (tx, row) => {
        if (!row || row.draft === null) throw httpError(409, NO_DRAFT);
        const read = readMap(row.draft);
        if (!read.ok) throw mapProblems({ problems: read.problems, total: read.problems.length });
        const { context } = await loadMapContext(tx, tenantId);
        const result = validateMap(read.map, context);
        if (!result.ok) throw mapProblems(result);
        return { canonical: result.map };
      });
      const pkg = await build(tenantId, venueId, claimed);
      return finalize(tenantId, venueId, claimed, pkg, async (tx) => {
        const row = await maps.readMapRow(tx, tenantId, venueId);
        return {
          publishedVersion: claimed.versionNo,
          draftVersion: row.draftVersion,
          warnings: pkg.warnings,
        };
      });
    },

    /**
     * AC-31 to AC-34: -> { publishedVersion, draftVersion, restoredFrom }.
     * @param {{ version: number, baseVersion: number }} body  validated (mapEnvelope.js rollbackBody)
     */
    async rollback(tenantId, venueId, { version, baseVersion: base }) {
      assertTenantId(tenantId);
      await maps.requireVenue(db, tenantId, venueId);
      const notPublished = () => httpError(404, `No published version ${version} of this venue`);
      const claimed = await claim(tenantId, venueId, base, async (tx) => {
        const stored = isStorableVersion(version)
          ? await versions.publishedLayout(tx, tenantId, venueId, version)
          : undefined;
        if (stored === undefined) throw notPublished();
        const read = readMap(stored);
        if (!read.ok) {
          throw httpError(
            409,
            `Version ${version} was made by a newer or unknown version of Gabay`,
          );
        }
        const { context } = await loadMapContext(tx, tenantId);
        const result = validateMap(read.map, context);
        if (!result.ok)
          throw mapProblems(result, `Version ${version} no longer passes today's checks`);
        return { canonical: result.map };
      });
      const pkg = await build(tenantId, venueId, claimed);
      const outcome = await finalize(tenantId, venueId, claimed, pkg, async (tx) => {
        const row = await maps.readMapRow(tx, tenantId, venueId);
        const actor = getActorId();
        if (!row) {
          const made = await maps.insertMap(tx, tenantId, venueId, {
            draft: restoreBackdrops(claimed.canonical, null),
            publishedVersion: claimed.versionNo,
            actor,
          });
          return { draftVersion: made.draftVersion, kept: false };
        }
        if (row.draftVersion !== base) return { draftVersion: row.draftVersion, kept: true }; // Q3 (a)
        const draft = restoreBackdrops(claimed.canonical, row.draft);
        const written = await maps.writeDraft(tx, tenantId, venueId, base, { draft, actor });
        return { draftVersion: written.draftVersion, kept: false };
      });
      if (outcome.kept) {
        throw httpError(
          409,
          `Version ${version} was republished, but someone changed the draft meanwhile. Reload to see it`,
          { extra: { publishedVersion: claimed.versionNo, draftVersion: outcome.draftVersion } },
        );
      }
      return {
        publishedVersion: claimed.versionNo,
        draftVersion: outcome.draftVersion,
        restoredFrom: version,
      };
    },
  };
}

module.exports = { createMapPublishService };
