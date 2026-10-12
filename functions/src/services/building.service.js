// Buildings under a venue (P0-01; plan/FF-1-venue-setup.md sections 2.2 to 2.4): list, read, create, edit, and delete
// when the building has no levels (B4). The type comes from gabay.BuildingType, the tenant's own rows or the platform's
// (TenantId NULL, the global-lookup trap); a new reference to an inactive type is refused, an unchanged one is kept
// (AC-9, AC-10, Blueprint DC8). The label is always the join, never a copy (AC-8).
//
// Rule 2: every statement binds TenantId = $1 from the tenant the route passes in (req.tenantCompanyID). Rule 3: every
// request value is a bound parameter; the list order is fixed here (DC-3).
'use strict';

const { httpError } = require('../utils/errors');
const { parsePaging, likePattern, runPaged } = require('../utils/pagination');
const { getActorId, assertTenantId } = require('../utils/requestContext');
const {
  readBody,
  readText,
  readDecimal,
  readInteger,
  readUpdatedAt,
  refuseMissing,
  refuseIfDifferent,
  refuseStampsOnCreate,
  refuseStampsOnEdit,
  INT_MAX,
} = require('../utils/fieldInput');
const { foreignKeyInUse } = require('../utils/foreignKeyInUse');
const { lockVenue } = require('./venueLock');

const NOT_FOUND = 'Not found';
const STALE = 'Someone else changed this building. Reload to see their change';
const TYPE_NOT_AVAILABLE = 'Building type is not available';
const TYPE_INACTIVE = 'That building type is no longer in use. Choose another';
const STILL_HAS_LEVELS = 'This building still has levels. Delete them first';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const LEVELS_FK = 'fk_level_building';

/** Column limits from db/schema.sql (gabay.Building); venues.schemaMirror.test.js fails if they drift (DC-8). */
const NAME_MAX = 200;
const MAP_UP_DEG = Object.freeze({
  label: 'Map up angle',
  precision: 6,
  scale: 2,
  example: '90.50',
  blank: null, // no default: NULL means the venue's angle
  min: '0',
  max: '360',
  maxExclusive: true, // CK_Building_MapUpDeg
});

const PAGING = Object.freeze({
  sortMap: Object.freeze({ name: 'b.Name' }),
  defaultSort: 'name',
  tieBreaker: 'b.BuildingId',
});

/** The fields a body carries, with the form's labels. */
const LABELS = Object.freeze({
  name: 'Name',
  buildingTypeId: 'Building type',
  mapUpDeg: MAP_UP_DEG.label,
});

/** The fields a create or an edit writes (section 2.3). An edit must send every one (L164); unknown keys are ignored. */
function readFields(body, { edit }) {
  if (edit) refuseMissing(body, Object.entries(LABELS));
  return {
    name: readText(body, 'name', LABELS.name, NAME_MAX),
    buildingTypeId: readInteger(body, 'buildingTypeId', LABELS.buildingTypeId, {
      min: 1,
      max: INT_MAX,
    }),
    mapUpDeg: readDecimal(body, 'mapUpDeg', MAP_UP_DEG),
  };
}

/** One building as the API shows it (with its type and its venue's angle, AC-7), or null. */
async function readBuilding(q, tenantId, buildingId) {
  const { rows } = await q.query(
    `SELECT b.BuildingId AS id, b.VenueId AS "venueId", b.Name AS name, b.BuildingTypeId AS "buildingTypeId",
            bt.Label AS "buildingTypeLabel", bt.IsActive AS "buildingTypeIsActive", b.MapUpDeg AS "mapUpDeg",
            v.MapUpDeg AS "venueMapUpDeg", b.CreatedAt AS "createdAt", b.CreatedBy AS "createdBy",
            b.UpdatedAt AS "updatedAt", b.UpdatedBy AS "updatedBy"
       FROM gabay.Building b
       JOIN gabay.BuildingType bt ON bt.BuildingTypeId = b.BuildingTypeId
       JOIN gabay.Venue v ON v.TenantId = b.TenantId AND v.VenueId = b.VenueId
      WHERE b.TenantId = $1 AND b.BuildingId = $2`,
    [tenantId, buildingId],
  );
  return rows[0] ?? null;
}

/**
 * The building-type rule (AC-6, AC-10): the type must be the tenant's or the platform's, and active unless it is the
 * building's current type (an unchanged inactive type is kept, AC-9).
 * @param {number|null} currentTypeId  the building's stored type, null on a create
 */
async function checkType(tx, tenantId, typeId, currentTypeId) {
  const { rows } = await tx.query(
    `SELECT IsActive AS "isActive"
       FROM gabay.BuildingType
      WHERE BuildingTypeId = $2 AND (TenantId = $1 OR TenantId IS NULL)`,
    [tenantId, typeId],
  );
  if (rows.length === 0) throw httpError(400, TYPE_NOT_AVAILABLE);
  if (!rows[0].isActive && typeId !== currentTypeId) throw httpError(400, TYPE_INACTIVE);
}

/** @param {{query: Function, withTransaction: Function}} db */
function createBuildingService(db) {
  /** The venue must be the tenant's: a 404 otherwise (never a 500 from the composite FK, AC-22). */
  async function requireVenue(q, tenantId, venueId) {
    const { rows } = await q.query(
      'SELECT VenueId FROM gabay.Venue WHERE TenantId = $1 AND VenueId = $2',
      [tenantId, venueId],
    );
    if (rows.length === 0) throw httpError(404, NOT_FOUND);
  }

  return {
    /**
     * The buildings of one venue, with the type's label joined (AC-8).
     * @param {object} params  req.query: page, pageSize and search are read; the order is fixed (Name, then id)
     */
    async list(tenantId, venueId, params) {
      assertTenantId(tenantId);
      await requireVenue(db, tenantId, venueId);
      const paging = parsePaging(
        { page: params.page, pageSize: params.pageSize, search: params.search },
        PAGING,
      );
      return runPaged({
        query: (text, values) => db.query(text, values),
        select: `b.BuildingId AS id, b.Name AS name, b.BuildingTypeId AS "buildingTypeId", bt.Label AS "buildingTypeLabel",
                 bt.IsActive AS "buildingTypeIsActive", b.MapUpDeg AS "mapUpDeg"`,
        from: 'gabay.Building b JOIN gabay.BuildingType bt ON bt.BuildingTypeId = b.BuildingTypeId',
        where: 'b.TenantId = $1 AND b.VenueId = $2 AND ($3::text IS NULL OR b.Name ILIKE $3)',
        params: [tenantId, venueId, paging.search === null ? null : likePattern(paging.search)],
        paging,
      });
    },

    /** @throws {Error} 404 when the tenant has no such building */
    async get(tenantId, buildingId) {
      assertTenantId(tenantId);
      const building = await readBuilding(db, tenantId, buildingId);
      if (!building) throw httpError(404, NOT_FOUND);
      return building;
    },

    /** @throws {Error} 400 for a field or the type, 404 when the tenant has no such venue */
    async create(tenantId, venueId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { edit: false });
      refuseIfDifferent(body, 'id', 'Id', null);
      refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
      refuseIfDifferent(body, 'venueId', 'Venue', venueId);
      refuseStampsOnCreate(body);
      return db.withTransaction(async (tx) => {
        await requireVenue(tx, tenantId, venueId);
        await checkType(tx, tenantId, fields.buildingTypeId, null);
        const { rows } = await tx.query(
          `INSERT INTO gabay.Building (TenantId, VenueId, BuildingTypeId, Name, MapUpDeg, CreatedBy)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING BuildingId`,
          [tenantId, venueId, fields.buildingTypeId, fields.name, fields.mapUpDeg, getActorId()],
        );
        return readBuilding(tx, tenantId, rows[0].buildingid);
      });
    },

    /**
     * An edit with the optimistic check of B5. A building never moves to another venue (AC-13).
     * @throws {Error} 400 for a field or the type, 404 when the tenant has no such building, 409 for a stale edit
     */
    async update(tenantId, buildingId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { edit: true });
      const token = readUpdatedAt(body);
      refuseIfDifferent(body, 'id', 'Id', buildingId);
      refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
      return db.withTransaction(async (tx) => {
        // Locks the row, so the current type the rule compares with cannot change before the UPDATE.
        const { rows: found } = await tx.query(
          `SELECT VenueId AS "venueId", BuildingTypeId AS "buildingTypeId", CreatedAt AS "createdAt",
                  CreatedBy AS "createdBy", UpdatedAt AS "updatedAt", UpdatedBy AS "updatedBy"
             FROM gabay.Building
            WHERE TenantId = $1 AND BuildingId = $2
              FOR NO KEY UPDATE`,
          [tenantId, buildingId],
        );
        const stored = found[0];
        if (!stored) throw httpError(404, NOT_FOUND);
        refuseIfDifferent(body, 'venueId', 'Venue', stored.venueId);
        refuseStampsOnEdit(body, stored, token);
        await checkType(tx, tenantId, fields.buildingTypeId, stored.buildingTypeId);
        const updated = await tx.query(
          `UPDATE gabay.Building
              SET Name = $3, BuildingTypeId = $4, MapUpDeg = $5, UpdatedBy = $6,
                  UpdatedAt = GREATEST(clock_timestamp(), COALESCE(UpdatedAt, CreatedAt) + INTERVAL '1 millisecond')
            WHERE TenantId = $1 AND BuildingId = $2 AND UpdatedAt IS NOT DISTINCT FROM $7::timestamptz
           RETURNING BuildingId`,
          [
            tenantId,
            buildingId,
            fields.name,
            fields.buildingTypeId,
            fields.mapUpDeg,
            getActorId(),
            token,
          ],
        );
        // The row is locked above, so it still exists: no row back means the token is stale.
        if (updated.rows.length === 0) throw httpError(409, STALE);
        return readBuilding(tx, tenantId, buildingId);
      });
    },

    /**
     * Deletes a building that has no levels (B4), under the venue lock so no level gets in between the check and the
     * delete; a level that does anyway is caught by the foreign key and gives the same 409.
     * @throws {Error} 404 when the tenant has no such building, 409 when it still has levels
     */
    async remove(tenantId, buildingId) {
      assertTenantId(tenantId);
      await db.withTransaction(async (tx) => {
        const { rows } = await tx.query(
          'SELECT VenueId AS "venueId" FROM gabay.Building WHERE TenantId = $1 AND BuildingId = $2',
          [tenantId, buildingId],
        );
        if (rows.length === 0) throw httpError(404, NOT_FOUND);
        const { venueId } = rows[0];
        await lockVenue(tx, tenantId, venueId);
        const levels = await tx.query(
          `SELECT 1 FROM gabay.Level
            WHERE TenantId = $1 AND VenueId = $2 AND BuildingId = $3
            LIMIT 1`,
          [tenantId, venueId, buildingId],
        );
        if (levels.rows.length > 0) throw httpError(409, STILL_HAS_LEVELS);
        let deleted;
        try {
          deleted = await tx.query(
            'DELETE FROM gabay.Building WHERE TenantId = $1 AND BuildingId = $2',
            [tenantId, buildingId],
          );
        } catch (err) {
          if (err?.code !== PG_FOREIGN_KEY_VIOLATION) throw err;
          if (err.constraint === LEVELS_FK) throw httpError(409, STILL_HAS_LEVELS);
          throw httpError(409, `This building is still used by ${foreignKeyInUse(err)}`);
        }
        if (deleted.rowCount === 0) throw httpError(404, NOT_FOUND); // deleted by someone else in the gap
      });
    },
  };
}

module.exports = { createBuildingService };
