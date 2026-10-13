'use strict';

// AC-20, the integration half (FEATURE_PIPELINE section 5 item 15, DC-O13; L151): the context is read from the real
// local database, a referenced AmenityType is deactivated inside a transaction that is always rolled back, and the
// document using it still validates, with the code kept. Runs in `npm run verify` (api-tests).
//
// It reads the five code lookups with its own parameterised SQL, `(TenantId = $1 OR TenantId IS NULL)`, because the
// production context loader is OA-2's. ObjectType's new columns are OA-2's too, so the catalog is the fixture one.
// The platform rows it needs are inserted inside the transaction (a fresh database has none yet), so nothing is kept.
// Written FIRST: fails until engine-coder builds shapeMapContext and validateMap.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { openSavepointDb } = require('./savepointDb');
const { createSeeder } = require('./authHelpers');

const camel = (rows) => rows.map((r) => ({ ...r }));

async function readLookups(raw, tenantId) {
  const q = async (text) => camel((await raw.query(text, [tenantId])).rows);
  return {
    buildingTypes: await q(
      `SELECT TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive"
         FROM gabay.BuildingType WHERE (TenantId = $1 OR TenantId IS NULL) ORDER BY Code`,
    ),
    amenityTypes: await q(
      `SELECT TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive"
         FROM gabay.AmenityType WHERE (TenantId = $1 OR TenantId IS NULL) ORDER BY Code`,
    ),
    transitTypes: await q(
      `SELECT TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive"
         FROM gabay.TransitType WHERE (TenantId = $1 OR TenantId IS NULL) ORDER BY Code`,
    ),
    connectorTypes: await q(
      `SELECT TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive",
              CostModel AS "costModel"
         FROM gabay.ConnectorType WHERE (TenantId = $1 OR TenantId IS NULL) ORDER BY Code`,
    ),
    occupantCategories: await q(
      `SELECT TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive"
         FROM gabay.OccupantCategory WHERE (TenantId = $1 OR TenantId IS NULL) ORDER BY Code`,
    ),
  };
}

test('AC-20 (integration): a referenced AmenityType deactivated in the database still validates, and its code is kept; nothing is committed', async () => {
  const { shapeCatalog, shapeMapContext, validateMap } = b.vm();
  const t = await openSavepointDb();
  try {
    const seed = createSeeder(t.raw);
    const tenant = await seed.tenant('A');
    const tag = seed.tag;
    const codes = {
      building: `BT_${tag}`,
      amenity: `AM_${tag}`,
      transit: `TP_${tag}`,
      connector: `CT_${tag}`,
    };
    const insert = async (text, params) => (await t.raw.query(text, params)).rows[0];
    await insert(
      `INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES (NULL, $1, $1) RETURNING 1`,
      [codes.building],
    );
    const amenity = await insert(
      `INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES (NULL, $1, $1) RETURNING AmenityTypeId`,
      [codes.amenity],
    );
    await insert(
      `INSERT INTO gabay.TransitType (TenantId, Code, Label) VALUES ($2, $1, $1) RETURNING 1`,
      [codes.transit, tenant.tenantId],
    );
    await insert(
      `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree) VALUES (NULL, $1, $1, 'STAIRS', FALSE) RETURNING 1`,
      [codes.connector],
    );

    const doc = b.twoLevelDoc();
    doc.buildings[0].type = codes.building;
    doc.levels[0].amenities = [b.amenity('a1', { type: codes.amenity })];
    doc.levels[0].transitPoints = [b.transitPoint('t1', { type: codes.transit })];
    doc.levels[0].items = [b.item('i1', { type: 'DESK' })];
    doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: codes.connector })];

    const contextFrom = async () => {
      const rows = await readLookups(t.raw, tenant.tenantId);
      return {
        rows,
        context: shapeMapContext({ catalog: shapeCatalog(b.objectRows(), 1), ...rows }),
      };
    };

    const before = await contextFrom();
    assert.equal(before.rows.amenityTypes.find((r) => r.code === codes.amenity).isActive, true);
    const first = validateMap(doc, before.context);
    assert.equal(first.ok, true, JSON.stringify(first.problems));

    // the deactivation: SQL, because the lookup screen is R11
    await t.raw.query(`UPDATE gabay.AmenityType SET IsActive = FALSE WHERE AmenityTypeId = $1`, [
      amenity.amenitytypeid,
    ]);

    const after = await contextFrom();
    assert.equal(
      after.rows.amenityTypes.find((r) => r.code === codes.amenity).isActive,
      false,
      'the row is inactive now',
    );
    const second = validateMap(doc, after.context);
    assert.equal(second.ok, true, JSON.stringify(second.problems));
    assert.equal(second.map.levels[0].amenities[0].type, codes.amenity, 'the code is kept');

    // and a code the database does not hold still fails, so the pass above is not vacuous
    const ghost = structuredClone(doc);
    ghost.levels[0].amenities[0].type = `GHOST_${tag}`;
    const refused = validateMap(ghost, after.context);
    assert.equal(refused.ok, false);
    assert.ok(refused.problems[0].startsWith('levels[0].amenities[0].type:'), refused.problems[0]);
  } finally {
    await t.close();
  }
});
