// Backdrop images of a venue map (spec/OA-2.md r1 section 3.9; office section 9; plan/OA-2-map-storage.md 1.0
// section 5.4): upload with the prune under the venue lock (AC-38, AC-39, AC-41) and read (AC-40). Type from the magic
// bytes and size from the header only (utils/imageHeader.js); limits are the schema file's BACKDROP_* constants. The
// tenant is the route's req.tenantCompanyID only (rule 2).
//
// CONTRACT ONLY (plan section 13 step 3): every method answers 501 until OA-2 step 5.
'use strict';

const { notBuilt } = require('./notBuilt');

/**
 * @param {object} _deps
 * @param {{ query: Function, withTransaction: Function }} _deps.db
 * @param {import('../storage/fileStore').FileStore} _deps.fileStore
 * @param {() => number} _deps.now  the clock in milliseconds, for the prune's cutoff (DC-A12)
 * @returns {{
 *   upload: (tenantId: number, venueId: number, file: { buffer: Buffer, size: number } | undefined) =>
 *     Promise<{ id: string, width: number, height: number }>,
 *   read: (tenantId: number, venueId: number, key: string) => Promise<{ bytes: Buffer, mimeType: string }>,
 * }}
 *   `file` is multer's req.file for the form field `file` (undefined when the request carried none).
 */
function createMapBackdropService(_deps) {
  return { upload: notBuilt(), read: notBuilt() };
}

module.exports = { createMapBackdropService };
