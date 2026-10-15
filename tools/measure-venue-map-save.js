#!/usr/bin/env node
// AC-46's measurement (spec/OA-2.md r1 AC-46: recorded, not gated; plan/OA-2-map-storage.md 1.0 section 8, DC-A22):
// the time of a whole draft save, PUT /api/venues/:venueId/map/draft, of OA-1's measurement document (just under
// MAX_MAP_BYTES, tools/measure-venue-map.js), from the request to the response: JSON parsing, validation, the lock and
// the JSONB write. It is run by hand and its output pasted beside L172's validator-only figures; it is not a verify
// check.
//
//   npm run measure:venue-map-save       20 saves, one after the other, on this working copy's database
//
// Nothing is kept: the real app runs over the API tests' rolled-back connection (functions/test/venueApp.js; L151), with
// an invented tenant, venue and lookup rows (no seed source, no penthouse: L48). One unmeasured save comes first, so the
// first measured one is not paying for code loading.
'use strict';

const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
// The API tests' helpers set NODE_ENV=test and load the root .env. (SEC-1: the save is signed in as the harness's MALL_ADMIN.)
const { withVenueApp } = require(path.join(ROOT, 'functions', 'test', 'venueApp.js'));
const { VENUE_MAP_SCHEMA } = require(
  path.join(ROOT, 'functions', 'src', 'config', 'venueMapSchema.js'),
);
const { documentUnderCap, contextRows } = require('./measure-venue-map');

const RUNS = 20;
const VALIDATOR_ONLY = 'L172 (validator only): median 304.5 ms, p95 316.5 ms';

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

/** One fixed statement per lookup list of contextRows(); every value is bound. */
const LOOKUP_INSERTS = Object.freeze({
  buildingTypes:
    'INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1',
  amenityTypes:
    'INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1',
  transitTypes:
    'INSERT INTO gabay.TransitType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1',
  occupantCategories:
    'INSERT INTO gabay.OccupantCategory (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1',
});

/** The context rows of the measurement document, written as the tenant's own rows (inside the rolled-back transaction). */
async function seedLookups(sql, tenantId) {
  const rows = contextRows();
  for (const [list, text] of Object.entries(LOOKUP_INSERTS)) {
    for (const r of rows[list]) await sql.one(text, [tenantId, r.code]);
  }
  for (const r of rows.connectorTypes) {
    await sql.one(
      `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree) VALUES ($1, $2, $2, $3, FALSE) RETURNING 1`,
      [tenantId, r.code, r.costModel],
    );
  }
  for (const r of rows.objectTypes) {
    const rz = r.resize;
    await sql.one(
      `INSERT INTO gabay.ObjectType (TenantId, Code, Label, DefaultWidthM, DefaultDepthM, DefaultHeightM, BlocksWalk,
                                     ResizeMinWidthM, ResizeMaxWidthM, ResizeMinDepthM, ResizeMaxDepthM,
                                     ResizeMinHeightM, ResizeMaxHeightM, Mount, IsRound)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING 1`,
      [
        tenantId,
        r.code,
        r.defaultW,
        r.defaultD,
        r.defaultH,
        r.blocksWalk,
        rz.w?.[0] ?? null,
        rz.w?.[1] ?? null,
        rz.d?.[0] ?? null,
        rz.d?.[1] ?? null,
        rz.h?.[0] ?? null,
        rz.h?.[1] ?? null,
        r.mount,
        r.round,
      ],
    );
  }
}

async function main() {
  const doc = documentUnderCap(VENUE_MAP_SCHEMA.constants);
  const body = JSON.stringify({ layout: doc, baseVersion: 0 });
  const docBytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
  let lines = null;
  await withVenueApp(async ({ sql, tenantA, call }) => {
    await seedLookups(sql, tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const url = `/api/venues/${venue}/map/draft`;
    const send = async (base) => {
      const text = body.replace('"baseVersion":0}', `"baseVersion":${base}}`);
      const start = performance.now();
      const res = await call('PUT', url, { rawBody: text });
      const ms = performance.now() - start;
      if (res.status !== 200) {
        throw new Error(`save at base ${base}: ${res.status} ${res.text.slice(0, 500)}`);
      }
      return ms;
    };
    await send(0); // warm-up, not measured
    const times = [];
    for (let i = 1; i <= RUNS; i += 1) times.push(await send(i));
    times.sort((a, b) => a - b);
    const cpu = os.cpus()[0]?.model.trim() ?? 'unknown CPU';
    lines = [
      'venue map draft save, measured and not gated (spec/OA-2.md r1 AC-46; plan DC-A22)',
      `document: ${docBytes} bytes (MAX_MAP_BYTES ${VENUE_MAP_SCHEMA.constants.MAX_MAP_BYTES}); request body ${Buffer.byteLength(body, 'utf8')} bytes`,
      `runs: ${RUNS} saves after one warm-up, each from request to response (JSON parsing, validation, the venue lock, the JSONB write), over a rolled-back transaction`,
      `time: median ${percentile(times, 0.5).toFixed(1)} ms, p95 ${percentile(times, 0.95).toFixed(1)} ms (min ${times[0].toFixed(1)}, max ${times[times.length - 1].toFixed(1)})`,
      `beside it: ${VALIDATOR_ONLY}`,
      `machine: ${cpu}, ${os.cpus().length} logical cores, ${(os.totalmem() / 1024 ** 3).toFixed(1)} GiB RAM, ${process.platform} ${os.release()}, Node ${process.version}`,
    ];
  });
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exitCode = 1;
  },
);
