#!/usr/bin/env node
// AC-33's measurement (spec/OA-1.md r1 AC-33: measured, not gated; plan/OA-1-map-document.md 1.0 section 3.6,
// DC-O11): the venue map validator's time and peak memory on a synthetic valid document just under MAX_MAP_BYTES.
// It is run by hand and its output pasted in the pull request; it is not a verify check.
//
//   npm run measure:venue-map            20 runs, each in a fresh Node process
//
// The document is invented (no seed source, no penthouse: L48, EC-9), built from a seeded generator so every run
// measures the same text: ten levels at the level cap, each with walls, openings, units, items, corrections, amenities
// and landmarks, and the connectors between them. Each child process loads the module, parses the document and the
// context rows, then times validateMap alone (performance.now) and reads its peak resident set from
// process.resourceUsage().maxRSS (the Node 22 docs: "the maximum resident set size used in kibibytes"); heapUsed is a
// sample after the call. Peak memory is the process's, so it includes the parsed input and the loaded code.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'functions', 'src', 'services', 'venueMap');
const SCHEMA = path.join(ROOT, 'functions', 'src', 'config', 'venueMapSchema.js');
const RUNS = 20;
const SEED = 33;
const MARGIN_BYTES = 2048;
const CATALOG_VERSION = 1;
const MIB = 1024 * 1024;

/** A seeded pseudo-random generator (mulberry32), so every run measures the same document. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const row = (code, over = {}) => ({
  tenantId: null,
  code,
  label: code,
  sortOrder: 0,
  isActive: true,
  ...over,
});

/** The invented lookup and catalog rows the document's codes resolve in. */
function contextRows() {
  return {
    objectTypes: [
      row('DESK', {
        defaultW: 1.4,
        defaultD: 0.7,
        defaultH: 0.75,
        resize: { w: [0.6, 3], d: [0.5, 1.5], h: [0.7, 1.2] },
        blocksWalk: true,
        mount: 'floor',
        round: false,
      }),
      row('PILLAR', {
        defaultW: 0.5,
        defaultD: 0.5,
        defaultH: 3,
        resize: { w: null, d: null, h: null },
        blocksWalk: true,
        mount: 'floor',
        round: false,
      }),
    ],
    buildingTypes: [row('MAIN')],
    amenityTypes: [row('CR')],
    transitTypes: [row('TAXI_BAY')],
    connectorTypes: [row('STAIRS_STD', { costModel: 'STAIRS' })],
    occupantCategories: [row('FASHION')],
  };
}

/** A valid document of ten full-size levels with `itemsPerLevel` items on each, the count that fits it under the cap. */
function buildDocument(constants, itemsPerLevel) {
  const rng = mulberry32(SEED);
  const extent = constants.VENUE_EXTENT_MAX_M;
  const at = (lo, hi) => Math.round((lo + rng() * (hi - lo)) * 1000) / 1000;
  const levels = [];
  for (let n = 0; n < constants.MAX_LEVELS; n += 1) {
    const id = `L${n}`;
    const walls = Array.from({ length: constants.MAX_WALLS_PER_LEVEL }, (_, i) => {
      const a = [at(10, extent - 20), at(10, extent - 20)];
      return { id: `w${n}-${i}`, a, b: [Math.round((a[0] + 5) * 1000) / 1000, a[1]] };
    });
    const openings = walls
      .slice(0, 400)
      .map((w, i) => ({ id: `o${n}-${i}`, wall: w.id, at: 0.5, w: 1 }));
    const units = Array.from({ length: constants.MAX_UNITS_PER_LEVEL }, (_, i) => {
      const x = 10 + (i % 20) * 14;
      const z = 10 + Math.floor(i / 20) * 18;
      return {
        id: `u${n}-${i}`,
        name: `Store ${n}-${i}`,
        category: 'room',
        walkable: false,
        doors: i < 400 ? [`o${n}-${i}`] : undefined,
        poly: [
          [x, z],
          [x + 10, z],
          [x + 10, z + 12],
          [x, z + 12],
        ],
      };
    });
    const count = itemsPerLevel;
    const items = Array.from({ length: count }, (_, i) => ({
      id: `i${n}-${i}`,
      type: i % 4 === 0 ? 'PILLAR' : 'DESK',
      x: at(1, extent - 1),
      z: at(1, extent - 1),
      ...(i % 4 === 0 ? {} : { rot: at(0, 359), w: 1.5 }),
    }));
    const corrections = Array.from({ length: 50 }, (_, i) => ({
      id: `c${n}-${i}`,
      kind: 'BLOCK_AREA',
      poly: [
        [20 + i, 20],
        [24 + i, 20],
        [24 + i, 24],
        [20 + i, 24],
      ],
    }));
    const amenities = Array.from({ length: 100 }, (_, i) => ({
      id: `am${n}-${i}`,
      type: 'CR',
      at: [at(1, extent - 1), at(1, extent - 1)],
    }));
    const anchors = Array.from({ length: 100 }, (_, i) => ({
      id: `an${n}-${i}`,
      name: `Landmark ${i}`,
      at: [at(1, extent - 1), at(1, extent - 1)],
    }));
    levels.push({
      id,
      name: `Level ${n}`,
      shortName: `L${n}`,
      building: 'b1',
      ordinal: n + 1,
      elevation: n * 4.5,
      origin: [0, 0],
      size: [extent, extent],
      walls,
      openings,
      units,
      items,
      corrections,
      amenities,
      anchors,
    });
  }
  const connectors = Array.from({ length: constants.MAX_LEVELS - 1 }, (_, n) => ({
    id: `st${n}`,
    name: `Stairs ${n}`,
    kind: 'stairs',
    type: 'STAIRS_STD',
    levels: [`L${n}`, `L${n + 1}`],
    stops: [
      [150, 150],
      [150, 150],
    ],
    x: 150,
    z: 150,
  }));
  return JSON.parse(
    JSON.stringify({
      spec: 1,
      units: 'm',
      catalog: CATALOG_VERSION,
      site: {
        boundary: [
          [0, 0],
          [extent, 0],
          [extent, extent],
          [0, extent],
        ],
        georeference: null,
      },
      buildings: [{ id: 'b1', name: 'Main building', type: 'MAIN' }],
      levels,
      connectors,
    }),
  );
}

/** The largest document under MAX_MAP_BYTES - MARGIN_BYTES, found by searching the items per level. */
function documentUnderCap(constants) {
  const cap = constants.MAX_MAP_BYTES - MARGIN_BYTES;
  let lo = 0;
  let hi = constants.MAX_ITEMS_PER_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const bytes = Buffer.byteLength(JSON.stringify(buildDocument(constants, mid)), 'utf8');
    if (bytes <= cap) lo = mid;
    else hi = mid - 1;
  }
  return buildDocument(constants, lo);
}

function child(dir) {
  const { shapeCatalog, shapeMapContext, validateMap } = require(MODULE);
  const rows = JSON.parse(fs.readFileSync(path.join(dir, 'rows.json'), 'utf8'));
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'doc.json'), 'utf8'));
  const { objectTypes, ...lookups } = rows;
  const context = shapeMapContext({
    catalog: shapeCatalog(objectTypes, CATALOG_VERSION),
    ...lookups,
  });
  const rssBefore = process.resourceUsage().maxRSS;
  const start = performance.now();
  const result = validateMap(doc, context);
  const ms = performance.now() - start;
  const usage = process.resourceUsage();
  process.stdout.write(
    JSON.stringify({
      ok: result.ok,
      ms,
      rssBeforeKiB: rssBefore,
      maxRssKiB: usage.maxRSS,
      heapUsed: process.memoryUsage().heapUsed,
    }),
  );
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function main() {
  const { VENUE_MAP_SCHEMA } = require(SCHEMA);
  const { shapeCatalog, shapeMapContext, validateMap } = require(MODULE);
  const { constants } = VENUE_MAP_SCHEMA;
  const doc = documentUnderCap(constants);
  const rows = contextRows();
  const { objectTypes, ...lookups } = rows;
  const check = validateMap(
    doc,
    shapeMapContext({ catalog: shapeCatalog(objectTypes, CATALOG_VERSION), ...lookups }),
  );
  if (!check.ok) {
    process.stderr.write(
      `the synthetic document is not valid: ${JSON.stringify(check.problems)}\n`,
    );
    return 1;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-measure-venue-map-'));
  try {
    const text = JSON.stringify(doc);
    fs.writeFileSync(path.join(dir, 'doc.json'), text);
    fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify(rows));
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      const r = spawnSync(process.execPath, [__filename, '--child', dir], { encoding: 'utf8' });
      if (r.status !== 0) {
        process.stderr.write(r.stdout + r.stderr);
        return 1;
      }
      const run = JSON.parse(r.stdout);
      if (!run.ok) {
        process.stderr.write('a child run refused the document\n');
        return 1;
      }
      runs.push(run);
    }
    const times = runs.map((r) => r.ms).sort((a, b) => a - b);
    const peak = Math.max(...runs.map((r) => r.maxRssKiB)) / 1024;
    const before = Math.max(...runs.map((r) => r.rssBeforeKiB)) / 1024;
    const heap = Math.max(...runs.map((r) => r.heapUsed)) / MIB;
    const levels = doc.levels.length;
    const elements = doc.levels.reduce(
      (n, l) =>
        n +
        ['walls', 'openings', 'units', 'items', 'corrections', 'amenities', 'anchors'].reduce(
          (m, k) => m + (l[k]?.length ?? 0),
          0,
        ),
      0,
    );
    const cpu = os.cpus()[0]?.model.trim() ?? 'unknown CPU';
    const lines = [
      'venue map validator, measured and not gated (spec/OA-1.md r1 AC-33; plan DC-O11)',
      `document: ${Buffer.byteLength(text, 'utf8')} bytes (MAX_MAP_BYTES ${constants.MAX_MAP_BYTES}), ${levels} levels, ${elements} elements, ${doc.connectors.length} connectors`,
      `runs: ${RUNS}, each in a fresh Node process; time is validateMap alone`,
      `time: median ${percentile(times, 0.5).toFixed(1)} ms, p95 ${percentile(times, 0.95).toFixed(1)} ms (min ${times[0].toFixed(1)}, max ${times[times.length - 1].toFixed(1)})`,
      `peak memory: max RSS ${peak.toFixed(1)} MiB (before validating: ${before.toFixed(1)} MiB); heap used after: ${heap.toFixed(1)} MiB`,
      `machine: ${cpu}, ${os.cpus().length} logical cores, ${(os.totalmem() / 1024 ** 3).toFixed(1)} GiB RAM, ${process.platform} ${os.release()}, Node ${process.version}`,
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv[2] === '--child') child(process.argv[3]);
  else process.exitCode = main();
}
