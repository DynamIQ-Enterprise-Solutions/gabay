// Backdrop images of a venue map (spec/OA-2.md r1 section 3.9; office section 9; plan/OA-2-map-storage.md 1.0 section
// 5.4; the owner's ruling Q4 (a)): upload with the prune (AC-38, AC-39, AC-41) and read (AC-40). The tenant is the
// route's req.tenantCompanyID only (rule 2); the actor comes from the request context.
//
// Upload, in order: the venue (404; the route asks before the body is read), the body (multer: 413 over
// BACKDROP_MAX_BYTES, 400 for no file, a second file or another field), the type from the magic bytes (415) and the size
// from the header (400 damaged; 400 naming a pixel limit), then one transaction under the venue lock (DC-18): the prune
// (backdrops older than BACKDROP_PRUNE_AFTER_H that no level of the draft names: their rows and StoredFile rows), the
// count (409 at BACKDROP_MAX_PER_VENUE), a fresh random key, the file put through the FileStore, its StoredFile and
// VenueMapBackdrop rows. The pruned files are removed after the commit (DC-A18); the new file is removed if the
// transaction fails after the put. The cutoff comes from createApp's clock (DC-A12).
'use strict';

const crypto = require('node:crypto');
const { constant } = require('../../config/venueMapSchema');
const { httpError, UPLOAD_ONE_IMAGE } = require('../../utils/errors');
const { getActorId, assertTenantId } = require('../../utils/requestContext');
const { readImageHeader } = require('../../utils/imageHeader');
const { lockVenue } = require('../venueLock');
const maps = require('./venueMap.repository');
const backdrops = require('./backdrop.repository');
const { backdropKeysOf } = require('./backdropKeys');
const { notFound } = require('./mapErrors');

const LIMITS = Object.freeze({
  minSide: constant('BACKDROP_MIN_SIDE_PX'),
  maxSide: constant('BACKDROP_MAX_SIDE_PX'),
  maxPixels: constant('BACKDROP_MAX_PIXELS'),
  perVenue: constant('BACKDROP_MAX_PER_VENUE'),
  pruneAfterMs: constant('BACKDROP_PRUNE_AFTER_H') * 3600 * 1000,
});
const KEY_BYTES = constant('BACKDROP_KEY_CHARS') / 2; // hex: two characters per byte

const n = (value) => value.toLocaleString('en-US');
const TEXT = Object.freeze({
  unknownType: 'Use a PNG, JPEG or WebP image',
  damaged: 'This image file is damaged',
  tooSmall: `Each side of the image must be at least ${n(LIMITS.minSide)} pixels`,
  tooLarge: `Each side of the image must be at most ${n(LIMITS.maxSide)} pixels`,
  tooManyPixels: `The image must be at most ${n(LIMITS.maxPixels / 1e6)} megapixels (${n(LIMITS.maxPixels)} pixels)`,
  full: `This venue already has ${LIMITS.perVenue} floor-plan images`,
});

/** The type and size of an uploaded file, or the refusal (AC-38, AC-39, EC-10, EC-37). */
function checkImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw httpError(400, UPLOAD_ONE_IMAGE.message);
  const header = readImageHeader(file.buffer);
  if (header.error === 'unknownType') throw httpError(415, TEXT.unknownType);
  if (header.error) throw httpError(400, TEXT.damaged);
  const { width, height } = header;
  if (Math.min(width, height) < LIMITS.minSide) throw httpError(400, TEXT.tooSmall);
  if (Math.max(width, height) > LIMITS.maxSide) throw httpError(400, TEXT.tooLarge);
  if (width * height > LIMITS.maxPixels) throw httpError(400, TEXT.tooManyPixels);
  return header;
}

/**
 * @param {object} deps
 * @param {{ query: Function, withTransaction: Function }} deps.db
 * @param {import('../storage/fileStore').FileStore} deps.fileStore
 * @param {() => number} deps.now  the clock in milliseconds, for the prune's cutoff (DC-A12)
 * @param {{ error: Function }} deps.logger
 */
function createMapBackdropService({ db, fileStore, now, logger }) {
  const removeQuietly = (key) =>
    fileStore
      .remove(key)
      .catch((err) => logger.error({ err, key }, 'could not remove a stored file'));

  return {
    /** The venue check the route runs before it reads the upload's body (AC-8; plan 5.4 step 1). */
    async requireVenue(tenantId, venueId) {
      assertTenantId(tenantId);
      await maps.requireVenue(db, tenantId, venueId);
    },

    /** AC-38, AC-39, AC-41: one image (multer's req.file) -> 201 { id, width, height }. */
    async upload(tenantId, venueId, file) {
      assertTenantId(tenantId);
      const image = checkImage(file);
      const key = crypto.randomBytes(KEY_BYTES).toString('hex');
      const storagePath = `backdrops/${tenantId}/${venueId}/${key}`;
      let written = false;
      let pruned = [];
      try {
        await db.withTransaction(async (tx) => {
          await lockVenue(tx, tenantId, venueId);
          const row = await maps.readMapRow(tx, tenantId, venueId);
          const named = backdropKeysOf(row?.draft).map((k) => k.key);
          const cutoff = new Date(now() - LIMITS.pruneAfterMs);
          pruned = await backdrops.pruneCandidates(tx, tenantId, venueId, cutoff, named);
          await backdrops.deleteBackdrops(tx, tenantId, venueId, pruned);
          if ((await backdrops.countForVenue(tx, tenantId, venueId)) >= LIMITS.perVenue) {
            throw httpError(409, TEXT.full);
          }
          const stored = await fileStore.put(storagePath, file.buffer);
          written = true;
          const actor = getActorId();
          const fileId = await backdrops.insertStoredFile(tx, tenantId, {
            purpose: 'UNDERLAY',
            mimeType: image.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
            storagePath,
            actor,
          });
          await backdrops.insertBackdrop(tx, tenantId, venueId, {
            key,
            fileId,
            width: image.width,
            height: image.height,
            actor,
          });
        });
      } catch (err) {
        if (written) await removeQuietly(storagePath);
        throw err;
      }
      for (const gone of pruned) await removeQuietly(gone.storagePath);
      return { id: key, width: image.width, height: image.height };
    },

    /** AC-40: { bytes, mimeType } of one backdrop of this tenant's venue; 404 for a malformed or unknown key. */
    async read(tenantId, venueId, key) {
      assertTenantId(tenantId);
      const found = await backdrops.readBackdrop(db, tenantId, venueId, key);
      if (!found) throw notFound();
      const bytes = await fileStore.get(found.storagePath);
      if (!bytes) {
        logger.error(
          { key: found.storagePath },
          'a backdrop row names a file the store does not hold',
        );
        throw notFound();
      }
      return { bytes, mimeType: found.mimeType };
    },
  };
}

module.exports = { createMapBackdropService, BACKDROP_TEXT: TEXT };
