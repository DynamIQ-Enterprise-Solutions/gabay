// Levels (P0-01; plan/FF-1-venue-setup.md sections 2.2 to 2.4): the indoor levels of a building, and the venue's one
// outdoor ground level (L30: BuildingId NULL, IsOutdoor TRUE, Ordinal 0). List, read, create, edit, and delete when
// nothing uses the level (B4).
//
// Every write takes the venue lock first (venueLock.js, DC-7), then checks the level rules in the service (B7, no
// migration): distinct ordinals within a building (AC-35) and one outdoor ground level per venue (AC-12). VenueId,
// BuildingId and IsOutdoor come from the route's parent, never from the body (AC-13). After every create, edit and
// delete the venue's derived boundary is refreshed (venueBoundary.js, B2).
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
  readOptionalText,
  readDecimal,
  readInteger,
  readUpdatedAt,
  refuseIfDifferent,
  refuseStampsOnCreate,
  refuseStampsOnEdit,
} = require('../utils/fieldInput');
const { foreignKeyInUse } = require('../utils/foreignKeyInUse');
const { lockVenue } = require('./venueLock');
const { refreshBoundary } = require('./venueBoundary');

const NOT_FOUND = 'Not found';
const STALE = 'Someone else changed this level. Reload to see their change';
const SECOND_OUTDOOR = 'This venue already has an outdoor ground level';
const OUTDOOR_ORDINAL = 'Ordinal of the outdoor ground level is always 0';
const PG_FOREIGN_KEY_VIOLATION = '23503';

/** Column limits and defaults from db/schema.sql (gabay.Level); venues.schemaMirror.test.js fails if they drift (DC-8). */
const NAME_MAX = 100;
const SHORT_NAME_MAX = 10;
const SPOKEN_NAME_MAX = 100;
const ELEVATION_M = Object.freeze({
  label: 'Elevation',
  precision: 9,
  scale: 3,
  example: '-4.500',
  blank: '0', // the column DEFAULT; any sign
});
const WIDTH_M = Object.freeze({
  label: 'Width',
  precision: 9,
  scale: 3,
  example: '40.000',
  required: true,
  min: '0',
  minExclusive: true, // B6, checked here
});
const DEPTH_M = Object.freeze({
  label: 'Depth',
  precision: 9,
  scale: 3,
  example: '25.000',
  required: true,
  min: '0',
  minExclusive: true, // B6, checked here
});
const GRID_CELL_M = Object.freeze({
  label: 'Grid cell size',
  precision: 5,
  scale: 2,
  example: '0.50',
  blank: '1.00', // the column DEFAULT
  min: '0.25',
  max: '2.00', // CK_Level_GridCell, both ends included
});
const CEILING_HEIGHT_M = Object.freeze({
  label: 'Ceiling height',
  precision: 5,
  scale: 2,
  example: '3.20',
  blank: null, // not known
  min: '0',
  minExclusive: true, // B6, checked here
});

/** Ordinal DESC (highest floor first, B11), then the id so pages never overlap. */
const PAGING = Object.freeze({
  sortMap: Object.freeze({ ordinal: 'Ordinal' }),
  defaultSort: 'ordinal',
  tieBreaker: 'LevelId',
});
const LIST_SELECT =
  'LevelId AS id, Ordinal AS ordinal, Name AS name, ShortName AS "shortName", IsOutdoor AS "isOutdoor"';

/**
 * The outdoor ground level's ordinal: absent or 0, and the server writes 0 (AC-12).
 * @returns {0}
 */
function readOutdoorOrdinal(body) {
  if (Object.hasOwn(body, 'ordinal') && body.ordinal !== 0) {
    throw httpError(400, OUTDOOR_ORDINAL);
  }
  return 0;
}

/** The fields a create or an edit writes (section 2.3); unknown keys are ignored. */
function readFields(body, { outdoor }) {
  return {
    ordinal: outdoor ? readOutdoorOrdinal(body) : readInteger(body, 'ordinal', 'Ordinal'),
    name: readText(body, 'name', 'Name', NAME_MAX),
    shortName: readText(body, 'shortName', 'Short name', SHORT_NAME_MAX),
    spokenName: readOptionalText(body, 'spokenName', 'Spoken name', SPOKEN_NAME_MAX),
    elevationM: readDecimal(body, 'elevationM', ELEVATION_M),
    widthM: readDecimal(body, 'widthM', WIDTH_M),
    depthM: readDecimal(body, 'depthM', DEPTH_M),
    gridCellM: readDecimal(body, 'gridCellM', GRID_CELL_M),
    ceilingHeightM: readDecimal(body, 'ceilingHeightM', CEILING_HEIGHT_M),
  };
}

/** The keys a body may echo but never change: they follow from the route's parent (AC-13, DC-4). */
function refusePairing(body, { tenantId, venueId, buildingId, isOutdoor }) {
  refuseIfDifferent(body, 'tenantId', 'Tenant', tenantId);
  refuseIfDifferent(body, 'venueId', 'Venue', venueId);
  refuseIfDifferent(body, 'buildingId', 'Building', buildingId);
  refuseIfDifferent(body, 'isOutdoor', 'Outdoor', isOutdoor);
}

/** One level as the API shows it, or null. */
async function readLevel(q, tenantId, levelId) {
  const { rows } = await q.query(
    `SELECT LevelId AS id, VenueId AS "venueId", BuildingId AS "buildingId", IsOutdoor AS "isOutdoor",
            Ordinal AS ordinal, Name AS name, ShortName AS "shortName", SpokenName AS "spokenName",
            ElevationM AS "elevationM", WidthM AS "widthM", DepthM AS "depthM", GridCellM AS "gridCellM",
            CeilingHeightM AS "ceilingHeightM", CreatedAt AS "createdAt", CreatedBy AS "createdBy",
            UpdatedAt AS "updatedAt", UpdatedBy AS "updatedBy"
       FROM gabay.Level
      WHERE TenantId = $1 AND LevelId = $2`,
    [tenantId, levelId],
  );
  return rows[0] ?? null;
}

/** The venue of a building of the tenant, or null. */
async function venueOfBuilding(q, tenantId, buildingId) {
  const { rows } = await q.query(
    'SELECT VenueId AS "venueId" FROM gabay.Building WHERE TenantId = $1 AND BuildingId = $2',
    [tenantId, buildingId],
  );
  return rows[0]?.venueId ?? null;
}

/** AC-35, under the venue lock: no other level of the building has this ordinal (the level's own does not count). */
async function refuseDuplicateOrdinal(tx, tenantId, venueId, buildingId, ordinal, levelId) {
  const { rows } = await tx.query(
    `SELECT 1 FROM gabay.Level
      WHERE TenantId = $1 AND VenueId = $2 AND BuildingId = $3 AND Ordinal = $4
        AND LevelId IS DISTINCT FROM $5
      LIMIT 1`,
    [tenantId, venueId, buildingId, ordinal, levelId],
  );
  if (rows.length > 0) {
    throw httpError(409, `Another level of this building has ordinal ${ordinal}`);
  }
}

/** AC-12, under the venue lock: the venue has no outdoor ground level yet. */
async function refuseSecondOutdoor(tx, tenantId, venueId) {
  const { rows } = await tx.query(
    `SELECT 1 FROM gabay.Level
      WHERE TenantId = $1 AND VenueId = $2 AND BuildingId IS NULL
      LIMIT 1`,
    [tenantId, venueId],
  );
  if (rows.length > 0) throw httpError(409, SECOND_OUTDOOR);
}

/** Inserts a level whose parent the caller has checked under the venue lock; returns its id. */
async function insertLevel(tx, tenantId, venueId, buildingId, fields) {
  const { rows } = await tx.query(
    `INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, IsOutdoor, Ordinal, Name, ShortName, SpokenName,
                              ElevationM, WidthM, DepthM, GridCellM, CeilingHeightM, CreatedBy)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING LevelId`,
    [
      tenantId,
      venueId,
      buildingId,
      buildingId === null,
      fields.ordinal,
      fields.name,
      fields.shortName,
      fields.spokenName,
      fields.elevationM,
      fields.widthM,
      fields.depthM,
      fields.gridCellM,
      fields.ceilingHeightM,
      getActorId(),
    ],
  );
  return rows[0].levelid;
}

/** @param {{query: Function, withTransaction: Function}} db */
function createLevelService(db) {
  /** One page of a level list, highest ordinal first; `where` binds $1 tenant and $2 venue. */
  function page(params, run) {
    const paging = parsePaging(
      { page: params.page, pageSize: params.pageSize, search: params.search, sortOrder: 'DESC' },
      PAGING,
    );
    return run(paging, paging.search === null ? null : likePattern(paging.search));
  }
  const query = (text, values) => db.query(text, values);

  return {
    /** The indoor levels of a building, searched on Name and ShortName. @throws {Error} 404 for an unknown building */
    async listOfBuilding(tenantId, buildingId, params) {
      assertTenantId(tenantId);
      const venueId = await venueOfBuilding(db, tenantId, buildingId);
      if (venueId === null) throw httpError(404, NOT_FOUND);
      return page(params, (paging, search) =>
        runPaged({
          query,
          select: LIST_SELECT,
          from: 'gabay.Level',
          // VenueId is bound too, so IX_Level_Venue (TenantId, VenueId, Ordinal) serves the list (G4).
          where:
            'TenantId = $1 AND VenueId = $2 AND BuildingId = $3 AND ($4::text IS NULL OR Name ILIKE $4 OR ShortName ILIKE $4)',
          params: [tenantId, venueId, buildingId, search],
          paging,
        }),
      );
    },

    /** The venue's outdoor ground level, as a list of at most one. @throws {Error} 404 for an unknown venue */
    async listOutdoor(tenantId, venueId, params) {
      assertTenantId(tenantId);
      const { rows } = await db.query(
        'SELECT VenueId FROM gabay.Venue WHERE TenantId = $1 AND VenueId = $2',
        [tenantId, venueId],
      );
      if (rows.length === 0) throw httpError(404, NOT_FOUND);
      return page({ page: params.page, pageSize: params.pageSize }, (paging) =>
        runPaged({
          query,
          select: LIST_SELECT,
          from: 'gabay.Level',
          where: 'TenantId = $1 AND VenueId = $2 AND BuildingId IS NULL',
          params: [tenantId, venueId],
          paging,
        }),
      );
    },

    /** @throws {Error} 404 when the tenant has no such level */
    async get(tenantId, levelId) {
      assertTenantId(tenantId);
      const level = await readLevel(db, tenantId, levelId);
      if (!level) throw httpError(404, NOT_FOUND);
      return level;
    },

    /**
     * An indoor level of a building (AC-11). The building is read again under the lock, so a building deleted while
     * this create waited gives 404, never a 500 from the foreign key.
     * @throws {Error} 400 for a field, 404 for an unknown building, 409 for a duplicate ordinal
     */
    async createIndoor(tenantId, buildingId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { outdoor: false });
      refuseIfDifferent(body, 'id', 'Id', null);
      refuseStampsOnCreate(body);
      return db.withTransaction(async (tx) => {
        const venueId = await venueOfBuilding(tx, tenantId, buildingId);
        if (venueId === null) throw httpError(404, NOT_FOUND);
        refusePairing(body, { tenantId, venueId, buildingId, isOutdoor: false });
        await lockVenue(tx, tenantId, venueId);
        if ((await venueOfBuilding(tx, tenantId, buildingId)) === null) {
          throw httpError(404, NOT_FOUND);
        }
        await refuseDuplicateOrdinal(tx, tenantId, venueId, buildingId, fields.ordinal, null);
        const levelId = await insertLevel(tx, tenantId, venueId, buildingId, fields);
        await refreshBoundary(tx, tenantId, venueId);
        return readLevel(tx, tenantId, levelId);
      });
    },

    /**
     * The venue's outdoor ground level (AC-12): no building, ordinal 0, one per venue.
     * @throws {Error} 400 for a field, 404 for an unknown venue, 409 when the venue already has one
     */
    async createOutdoor(tenantId, venueId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      const fields = readFields(body, { outdoor: true });
      refuseIfDifferent(body, 'id', 'Id', null);
      refuseStampsOnCreate(body);
      refusePairing(body, { tenantId, venueId, buildingId: null, isOutdoor: true });
      return db.withTransaction(async (tx) => {
        await lockVenue(tx, tenantId, venueId); // 404 for a venue the tenant does not have
        await refuseSecondOutdoor(tx, tenantId, venueId);
        const levelId = await insertLevel(tx, tenantId, venueId, null, fields);
        await refreshBoundary(tx, tenantId, venueId);
        return readLevel(tx, tenantId, levelId);
      });
    },

    /**
     * An edit with the optimistic check of B5. The level keeps its venue, building and outdoor flag (AC-13).
     * @throws {Error} 400 for a field, 404 when the tenant has no such level, 409 for a stale edit or a duplicate ordinal
     */
    async update(tenantId, levelId, rawBody) {
      assertTenantId(tenantId);
      const body = readBody(rawBody);
      return db.withTransaction(async (tx) => {
        const stored = await readLevel(tx, tenantId, levelId);
        if (!stored) throw httpError(404, NOT_FOUND);
        const fields = readFields(body, { outdoor: stored.isOutdoor });
        const token = readUpdatedAt(body);
        refuseIfDifferent(body, 'id', 'Id', levelId);
        refusePairing(body, { tenantId, ...stored });
        refuseStampsOnEdit(body, stored, token);
        await lockVenue(tx, tenantId, stored.venueId);
        if (!stored.isOutdoor) {
          await refuseDuplicateOrdinal(
            tx,
            tenantId,
            stored.venueId,
            stored.buildingId,
            fields.ordinal,
            levelId,
          );
        }
        const updated = await tx.query(
          `UPDATE gabay.Level
              SET Ordinal = $3, Name = $4, ShortName = $5, SpokenName = $6, ElevationM = $7, WidthM = $8,
                  DepthM = $9, GridCellM = $10, CeilingHeightM = $11, UpdatedBy = $12,
                  UpdatedAt = GREATEST(clock_timestamp(), COALESCE(UpdatedAt, CreatedAt) + INTERVAL '1 millisecond')
            WHERE TenantId = $1 AND LevelId = $2 AND UpdatedAt IS NOT DISTINCT FROM $13::timestamptz
           RETURNING LevelId`,
          [
            tenantId,
            levelId,
            fields.ordinal,
            fields.name,
            fields.shortName,
            fields.spokenName,
            fields.elevationM,
            fields.widthM,
            fields.depthM,
            fields.gridCellM,
            fields.ceilingHeightM,
            getActorId(),
            token,
          ],
        );
        if (updated.rows.length === 0) {
          // Read before the lock: it may have been deleted since (404), or edited (409).
          const { rows } = await tx.query(
            'SELECT 1 FROM gabay.Level WHERE TenantId = $1 AND LevelId = $2',
            [tenantId, levelId],
          );
          throw rows.length === 0 ? httpError(404, NOT_FOUND) : httpError(409, STALE);
        }
        await refreshBoundary(tx, tenantId, stored.venueId);
        return readLevel(tx, tenantId, levelId);
      });
    },

    /**
     * Deletes a level nothing uses (B4); a level still referenced is a 409 naming what uses it (DC-11).
     * @throws {Error} 404 when the tenant has no such level, 409 when it is in use
     */
    async remove(tenantId, levelId) {
      assertTenantId(tenantId);
      await db.withTransaction(async (tx) => {
        const { rows } = await tx.query(
          'SELECT VenueId AS "venueId" FROM gabay.Level WHERE TenantId = $1 AND LevelId = $2',
          [tenantId, levelId],
        );
        if (rows.length === 0) throw httpError(404, NOT_FOUND);
        const { venueId } = rows[0];
        await lockVenue(tx, tenantId, venueId);
        let deleted;
        try {
          deleted = await tx.query('DELETE FROM gabay.Level WHERE TenantId = $1 AND LevelId = $2', [
            tenantId,
            levelId,
          ]);
        } catch (err) {
          if (err?.code !== PG_FOREIGN_KEY_VIOLATION) throw err;
          throw httpError(409, `This level is still used by ${foreignKeyInUse(err)}`);
        }
        if (deleted.rowCount === 0) throw httpError(404, NOT_FOUND); // deleted by someone else in the gap
        await refreshBoundary(tx, tenantId, venueId);
      });
    },
  };
}

module.exports = { createLevelService };
