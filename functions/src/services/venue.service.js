// Venues (P0-01; plan/FF-1-venue-setup.md sections 2.2 to 2.4): list, read, create and edit. No delete: a venue is
// switched off with IsActive (B4). The boundary is never taken from a body; it is derived from the levels
// (venueBoundary.js, B2).
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
  readDecimal,
  readFlag,
  readUpdatedAt,
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
const MAP_UP_DEG = Object.freeze({
  label: 'Map up angle',
  precision: 6,
  scale: 2,
  example: '90.50',
  blank: '0', // the column DEFAULT
  min: '0',
  max: '360',
  maxExclusive: true, // CK_Venue_MapUpDeg
});

const PAGING = Object.freeze({
  sortMap: Object.freeze({ name: 'Name' }),
  defaultSort: 'name',
  tieBreaker: 'VenueId',
});

/** The fields a create or an edit writes, read from the body (section 2.3). Unknown keys, boundary included, are ignored. */
function readFields(body) {
  return {
    code: readText(body, 'code', 'Code', CODE_MAX),
    name: readText(body, 'name', 'Name', NAME_MAX),
    mapUpDeg: readDecimal(body, 'mapUpDeg', MAP_UP_DEG),
    isActive: readFlag(body, 'isActive', 'Active'),
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
    `SELECT VenueId AS id, Code AS code, Name AS name, MapUpDeg AS "mapUpDeg", IsActive AS "isActive",
            BoundaryGeoJson AS boundary, CreatedAt AS "createdAt", CreatedBy AS "createdBy",
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
        select:
          'VenueId AS id, Code AS code, Name AS name, MapUpDeg AS "mapUpDeg", IsActive AS "isActive"',
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
      const fields = readFields(body);
      refuseIfDifferent(body, 'id', 'Id', null);
      refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
      refuseStampsOnCreate(body);
      return db.withTransaction(async (tx) => {
        let venueId;
        try {
          const { rows } = await tx.query(
            `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson, MapUpDeg, IsActive, CreatedBy)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
             RETURNING VenueId`,
            [
              tenantId,
              fields.code,
              fields.name,
              JSON.stringify(ZERO_BOUNDARY),
              fields.mapUpDeg,
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
      const fields = readFields(body);
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
                SET Code = $3, Name = $4, MapUpDeg = $5, IsActive = $6, UpdatedBy = $7,
                    UpdatedAt = GREATEST(clock_timestamp(), COALESCE(UpdatedAt, CreatedAt) + INTERVAL '1 millisecond')
              WHERE TenantId = $1 AND VenueId = $2 AND UpdatedAt IS NOT DISTINCT FROM $8::timestamptz
             RETURNING VenueId`,
            [
              tenantId,
              venueId,
              fields.code,
              fields.name,
              fields.mapUpDeg,
              fields.isActive,
              getActorId(),
              token,
            ],
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
