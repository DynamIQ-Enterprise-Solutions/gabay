// Venues (P0-01; plan/FF-1-venue-setup.md sections 2.2 to 2.4): list, read, create and edit. No delete: a venue is
// switched off with IsActive (B4).
//
// OA-2 (spec/OA-2.md r1 AC-43, EC-40): the map "up" angle and the boundary have left the venue API; the venue map document
// holds both (site.mapUp and the site's extent). A body that still sends mapUpDeg or boundary is accepted and the key
// ignored. A new row gets ZERO_BOUNDARY and the MapUpDeg column default, because both columns stay NOT NULL until OA-3's
// migration 0002 drops them; an edit leaves them alone.
//
// Rule 2: every statement binds TenantId = $1 from the tenant the route passes in (req.tenantCompanyID). Rule 3: every
// request value is a bound parameter; the list order is fixed here (DC-3). Writes run in db.withTransaction and stamp
// CreatedBy / UpdatedBy from the actor context.
'use strict';

const { httpError } = require('../utils/errors');
const { parsePaging, likePattern, runPaged } = require('../utils/pagination');
const { getActorId, assertTenantId } = require('../utils/requestContext');
const {
  readBody,
  readText,
  readFlag,
  readUpdatedAt,
  refuseMissing,
  refuseIfDifferent,
  refuseStampsOnCreate,
  refuseStampsOnEdit,
} = require('../utils/fieldInput');
const { ZERO_BOUNDARY } = require('./venueBoundary');

const NOT_FOUND = 'Not found';
const DUPLICATE_CODE = 'A venue with this code already exists';
const STALE = 'Someone else changed this venue. Reload to see their change';
const PG_UNIQUE_VIOLATION = '23505';
const UNIQUE_CODE = 'uq_venue_tenant_code';

/** Column limits from db/schema.sql (gabay.Venue); venues.schemaMirror.test.js fails if they drift (DC-8). */
const CODE_MAX = 40;
const NAME_MAX = 200;

const PAGING = Object.freeze({
  sortMap: Object.freeze({ name: 'Name' }),
  defaultSort: 'name',
  tieBreaker: 'VenueId',
});

/** The fields a body carries, with the form's labels. */
const LABELS = Object.freeze({
  code: 'Code',
  name: 'Name',
  isActive: 'Active',
});

/**
 * The fields a create or an edit writes, read from the body (section 2.3). An edit must send every one (L164). Unknown
 * keys, mapUpDeg and boundary included, are ignored (AC-43).
 */
function readFields(body, { edit }) {
  if (edit) refuseMissing(body, Object.entries(LABELS));
  return {
    code: readText(body, 'code', LABELS.code, CODE_MAX),
    name: readText(body, 'name', LABELS.name, NAME_MAX),
    isActive: readFlag(body, 'isActive', LABELS.isActive),
  };
}

/** A unique violation on the tenant's code becomes the 409 a person can act on (AC-4); anything else is rethrown. */
function duplicateCode(err) {
  if (err?.code === PG_UNIQUE_VIOLATION && err.constraint === UNIQUE_CODE) {
    return httpError(409, DUPLICATE_CODE);
  }
  return err;
}

/** One venue as the API shows it, or null. */
async function readVenue(q, tenantId, venueId) {
  const { rows } = await q.query(
    `SELECT VenueId AS id, Code AS code, Name AS name, IsActive AS "isActive",
            CreatedAt AS "createdAt", CreatedBy AS "createdBy",
            UpdatedAt AS "updatedAt", UpdatedBy AS "updatedBy"
       FROM gabay.Venue
      WHERE TenantId = $1 AND VenueId = $2`,
    [tenantId, venueId],
  );
  return rows[0] ?? null;
}

/** @param {{query: Function, withTransaction: Function}} db */
function createVenueService(db) {
  return {
    /**
     * @param {number} tenantId  req.tenantCompanyID
     * @param {object} params  req.query: page, pageSize and search are read; the order is fixed (Name, then id)
     */
    async list(tenantId, params) {
      assertTenantId(tenantId);
      const paging = parsePaging(
        { page: params.page, pageSize: params.pageSize, search: params.search },
        PAGING,
      );
      return runPaged({
        query: (text, values) => db.query(text, values),
        select: 'VenueId AS id, Code AS code, Name AS name, IsActive AS "isActive"',
        from: 'gabay.Venue',
        where: 'TenantId = $1 AND ($2::text IS NULL OR Code ILIKE $2 OR Name ILIKE $2)',
        params: [tenantId, paging.search === null ? null : likePattern(paging.search)],
        paging,
      });
    },

    /** @throws {Error} 404 when the tenant has no such venue */
    async get(tenantId, venueId) {
      assertTenantId(tenantId);
      const venue = await readVenue(db, tenantId, venueId);
      if (!venue) throw httpError(404, NOT_FOUND);
      return venue;
    },

    /** @throws {Error} 400 for a field, 409 for a code the tenant already uses */
    async create(tenantId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { edit: false });
      refuseIfDifferent(body, 'id', 'Id', null);
      refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
      refuseStampsOnCreate(body);
      return db.withTransaction(async (tx) => {
        let venueId;
        try {
          const { rows } = await tx.query(
            `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson, IsActive, CreatedBy)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6)
             RETURNING VenueId`,
            [
              tenantId,
              fields.code,
              fields.name,
              JSON.stringify(ZERO_BOUNDARY),
              fields.isActive,
              getActorId(),
            ],
          );
          venueId = rows[0].venueid;
        } catch (err) {
          throw duplicateCode(err);
        }
        return readVenue(tx, tenantId, venueId);
      });
    },

    /**
     * An edit with the optimistic check of B5: the body's updatedAt must still be the stored one.
     * @throws {Error} 400 for a field, 404 when the tenant has no such venue, 409 for a stale edit or a used code
     */
    async update(tenantId, venueId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { edit: true });
      const token = readUpdatedAt(body);
      refuseIfDifferent(body, 'id', 'Id', venueId);
      refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
      return db.withTransaction(async (tx) => {
        const stored = await readVenue(tx, tenantId, venueId);
        if (!stored) throw httpError(404, NOT_FOUND);
        refuseStampsOnEdit(body, stored, token);
        let updated;
        try {
          updated = await tx.query(
            `UPDATE gabay.Venue
                SET Code = $3, Name = $4, IsActive = $5, UpdatedBy = $6,
                    UpdatedAt = GREATEST(clock_timestamp(), COALESCE(UpdatedAt, CreatedAt) + INTERVAL '1 millisecond')
              WHERE TenantId = $1 AND VenueId = $2 AND UpdatedAt IS NOT DISTINCT FROM $7::timestamptz
             RETURNING VenueId`,
            [tenantId, venueId, fields.code, fields.name, fields.isActive, getActorId(), token],
          );
        } catch (err) {
          throw duplicateCode(err);
        }
        // A venue is never deleted, and it was read above: no row back means the token is stale.
        if (updated.rows.length === 0) throw httpError(409, STALE);
        return readVenue(tx, tenantId, venueId);
      });
    },
  };
}

module.exports = { createVenueService };
