// Publish and rollback of a venue map (spec/OA-2.md r1 sections 3.5 and 3.6; plan/OA-2-map-storage.md 1.0 section
// 5.2): the claim under the venue lock (a BUILDING VenueVersion row holding the frozen layout), the builder call
// outside it (mapBuilderPort.js), and the finalize; stale-build recovery after publish.buildingStaleS (settings.js);
// 501 when no builder is configured (AC-30). The tenant is the route's req.tenantCompanyID only (rule 2).
//
// CONTRACT ONLY (plan section 13 step 3): every method answers 501 until OA-2 step 5.
'use strict';

const { notBuilt } = require('./notBuilt');

/**
 * @param {object} _deps
 * @param {{ query: Function, withTransaction: Function }} _deps.db
 * @param {{ getSetting: Function }} _deps.settings  publish.buildingStaleS
 * @param {import('../storage/fileStore').FileStore} _deps.fileStore  where packages are written
 * @param {null|{ formatVersion: number, build: Function }} _deps.mapBuilder  the port (mapBuilderPort.js)
 * @param {() => number} _deps.now  the clock in milliseconds, for the stale check (DC-A12)
 * @param {object} _deps.logger
 * @returns {{
 *   publish: (tenantId: number, venueId: number, body: unknown) =>
 *     Promise<{ publishedVersion: number, draftVersion: number, warnings: string[] }>,
 *   rollback: (tenantId: number, venueId: number, body: unknown) =>
 *     Promise<{ publishedVersion: number, draftVersion: number, restoredFrom: number }>,
 * }}
 */
function createMapPublishService(_deps) {
  return { publish: notBuilt(), rollback: notBuilt() };
}

module.exports = { createMapPublishService };
