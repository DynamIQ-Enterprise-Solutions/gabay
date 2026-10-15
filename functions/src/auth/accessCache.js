// The access cache (SEC-1; spec/SEC-1.md r2 AC-24, AC-25, AC-29; DC-3, DC-13, DC-17; standard §3.4: "permissions
// cached 30 s, busted on every grant write"; plan/PH2-identity.md P2-S3).
//
//   get(userId)                 the access snapshot (accessStore.loadForUser: roles, role permissions, user permissions),
//                               keyed by the VERIFIED user id only, never by a token or a header (AC-24 a)
//   grantsFor(userId, tenantId) a venue-scoped user's granted venue ids in one tenant (accessStore.venueGrantsFor), keyed
//                               by the pair, read with the tenant bound (rule 2; AC-29)
//   invalidate(userId)          drops that user's snapshot and every one of their grant lists
//   invalidateAll()             drops everything
//
// An entry is served for ACCESS_CACHE_TTL_MS after it was loaded, then reloaded. A load that rejects is not cached, and
// an expired entry is never served when its reload fails (DC-17: no stale-on-error; a lookup that fails must not become
// an open door, standard §3.4). An invalidation during a load wins: that load's result is returned to its caller and not
// cached. Two requests that miss at once both load (EC-28: no single-flight is required).
//
// Nothing writes a grant through the API until R6, so nothing calls the invalidations yet: R6's every grant, role and
// user write must (AC-55's contract). Until then a grant changed by SQL or by `npm run migrate` is seen within 30 s.
//
// VALID ONLY WHILE maxInstances = 1 (Blueprint §2.6): the cache is in this process's memory, so a second instance would
// keep serving a revoked grant for up to 30 s after another instance's invalidation. Several instances is release-blocking.
// The entries hold plain rows from the database and never a token (AC-24 g).
'use strict';

/** Standard §3.4 (P0 item) and PH2 P2-S3: how long a loaded snapshot or grant list is served. */
const ACCESS_CACHE_TTL_MS = 30_000;

/**
 * @param {object} deps
 * @param {{ loadForUser: (userId: number) => Promise<object>,
 *           venueGrantsFor: (userId: number, tenantId: number) => Promise<number[]> }} deps.accessStore
 * @param {() => number} [deps.now]  milliseconds, injected so a test moves the clock
 * @param {number} [deps.ttlMs]
 */
function createAccessCache({ accessStore, now = Date.now, ttlMs = ACCESS_CACHE_TTL_MS }) {
  const snapshots = new Map(); // userId -> { at, value }
  const grants = new Map(); // userId -> Map(tenantId -> { at, value })
  const generations = new Map(); // userId -> a counter moved by every invalidation of that user
  let allGeneration = 0; // moved by invalidateAll

  const generationOf = (userId) => `${allGeneration}:${generations.get(userId) ?? 0}`;

  /** Serves a fresh entry, else loads; caches only a load that succeeded and was not invalidated meanwhile. */
  async function cached(map, key, userId, load) {
    const hit = map.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    map.delete(key); // expired: never served again, whatever the reload does
    const before = generationOf(userId);
    const value = await load(); // a rejection propagates and nothing is cached
    if (generationOf(userId) === before) map.set(key, { at: now(), value });
    return value;
  }

  function grantsOf(userId) {
    if (!grants.has(userId)) grants.set(userId, new Map());
    return grants.get(userId);
  }

  return {
    /** @param {number} userId  the verified user's id (req.user.userId) */
    get(userId) {
      return cached(snapshots, userId, userId, () => accessStore.loadForUser(userId));
    },

    /**
     * @param {number} userId
     * @param {number} tenantId  req.tenantCompanyID
     * @returns {Promise<number[]>}
     */
    grantsFor(userId, tenantId) {
      return cached(grantsOf(userId), tenantId, userId, () =>
        accessStore.venueGrantsFor(userId, tenantId),
      );
    },

    /** R6 calls this on every grant, role or user write that concerns `userId`. */
    invalidate(userId) {
      generations.set(userId, (generations.get(userId) ?? 0) + 1);
      snapshots.delete(userId);
      grants.delete(userId);
    },

    /** R6 calls this on a write that may concern every user (a role's permission rows). */
    invalidateAll() {
      allGeneration += 1;
      snapshots.clear();
      grants.clear();
    },
  };
}

module.exports = { createAccessCache, ACCESS_CACHE_TTL_MS };
