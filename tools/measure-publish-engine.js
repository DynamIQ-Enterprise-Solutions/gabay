#!/usr/bin/env node
// AC-137's A1′ share (spec/P0-03.md r4 AC-137, AC-69; A5, D14: measured, not gated; plan/FF-3-prime-A1.md 1.0
// section 5): the publish engine's analysis (analyseMap) timed on a seeded synthetic mall, sized by a target node
// count, with 16 or 8 lattice neighbours. It is run by hand and its output pasted in the pull request; it is not a
// verify check.
//
//   npm run measure:publish-engine -- --nodes <n> [--neighbours 16|8]      20 runs, each in a fresh Node process
//
// The mall is invented (no seed source, no penthouse: L48): on each level a grid of stores (non-walkable units with a
// wall on every side and a door onto the corridor, every seventh a walk-through store with a second door), 6 m
// corridors between them as the walkable floor, a pillar at each corridor crossing, amenities, and per level a
// BLOCK_AREA, an ADD_PATH and a REMOVE_PATH; entrances on the ground level; between each pair of levels a stair and an
// escalator, and a lift serving every level. Dense with stores on purpose (the A1′a review's I4: an empty level
// times far faster than a mall). Its size follows the target: the levels (at least 2, at most OA-1's MAX_LEVELS) and
// the grid of each level are chosen from an estimate of the walkable area, within OA-1's caps as they stand (extent,
// units per level, document bytes), and the document is validated with validateMap before any run.
//
// Each child process loads the engine, builds the snapshot (the lookup rows shaped by OA-1's shapeCatalog and
// shapeMapContext, then given the label, sort order and cost pair the engine reads), and times analyseMap alone
// (performance.now). Peak memory is process.resourceUsage().maxRSS (the Node 22 docs: "the maximum resident set size
// used in kibibytes"), the process's, so it includes the parsed input and the loaded code; heapUsed is a sample after
// the call. The engine never yields (DC-31, EC-90), so its longest synchronous stretch is the whole call.
//
// Inputs that are not the engine's: the connector types' cost pairs are the cost vector file's (the seeded values,
// test inputs, AC-106), and the routing.* values are AC-120's table, since their DEFAULTS are OA-3a's.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS = path.join(ROOT, "functions");
const VENUE_MAP = path.join(FUNCTIONS, "src", "services", "venueMap");
const ENGINE = path.join(
  FUNCTIONS,
  "src",
  "services",
  "engines",
  "publishEngine.service.js",
);
const SCHEMA = path.join(FUNCTIONS, "src", "config", "venueMapSchema.js");
const SETTINGS = path.join(FUNCTIONS, "src", "config", "settings.js");
const COST_VECTORS = path.join(
  FUNCTIONS,
  "test",
  "fixtures",
  "publish-cost-vectors.json",
);

const RUNS = 20;
const SEED = 137;
const MIB = 1024 * 1024;
const CATALOG_VERSION = 1;
const TENANT_UUID = "b7c1e2d3-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

/** The store grid (metres): each store W x D, corridors C wide between and around them. */
const STORE_W = 10;
const STORE_D = 12;
const CORRIDOR = 6;
const PITCH_X = STORE_W + CORRIDOR;
const PITCH_Z = STORE_D + CORRIDOR;
/** Lattice nodes one level is sized for at most (a full 300 x 300 m level of this grid holds about 21,000). */
const NODES_PER_LEVEL = 20000;
/** One store in this many is a walk-through store with a door at each end. */
const WALK_THROUGH_EVERY = 7;
/** A level's elevation step (metres). */
const STOREY_M = 4.5;
/** AC-120's routing.* table (the DEFAULTS are OA-3a's; spec/P0-03.md r4 AC-120). */
const ROUTING = Object.freeze({
  stairsSaveS: 120,
  otherWayMarginS: 0.417,
  stepFreeMinWidthM: 1.2,
});

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
      row("PILLAR", {
        defaultW: 0.6,
        defaultD: 0.6,
        defaultH: 3,
        resize: { w: null, d: null, h: null },
        blocksWalk: true,
        mount: "floor",
        round: false,
      }),
    ],
    buildingTypes: [row("MAIN")],
    amenityTypes: [row("CR"), row("ATM")],
    transitTypes: [row("TAXI_BAY")],
    connectorTypes: [
      row("STAIRS_STD", { costModel: "STAIRS" }),
      row("ESC_STD", { costModel: "ESCALATOR" }),
      row("LIFT_STD", { costModel: "ELEVATOR" }),
    ],
    occupantCategories: [row("FASHION")],
  };
}

/** A grid of kx by kz stores: the level's width and depth. */
const sizeOf = (kx, kz) => ({
  width: kx * PITCH_X + CORRIDOR,
  depth: kz * PITCH_Z + CORRIDOR,
});

/**
 * The lattice points of one level of a kx by kz grid that no store covers (a store blocks out to its walls' faces
 * plus the body margin; the default wall thickness is the schema's), and a door node per store: an estimate of the
 * level's nodes (pillars, the extra doors and landings left out), used only to size the mall.
 */
function latticeEstimate(kx, kz, publish, wallT) {
  const { width, depth } = sizeOf(kx, kz);
  const s = publish.nodeSpacingM;
  const reach = wallT / 2 + publish.bodyMarginM;
  // True when v lies in a store's grown band along one axis; only store i's band can hold it (a band is shorter
  // than the pitch).
  const inBand = (v, pitch, count, size) => {
    const i = Math.floor((v - CORRIDOR + reach) / pitch);
    if (i < 0 || i >= count) return false;
    const from = CORRIDOR + i * pitch;
    return v > from - reach && v < from + size + reach;
  };
  let points = 0;
  for (let j = 0; j * s <= depth; j += 1) {
    const zBand = inBand(j * s, PITCH_Z, kz, STORE_D);
    for (let i = 0; i * s <= width; i += 1) {
      if (!(zBand && inBand(i * s, PITCH_X, kx, STORE_W))) points += 1;
    }
  }
  return points + kx * kz;
}

/**
 * The levels and the grid of each level for `target` nodes, within OA-1's caps (the extent, the units per level and
 * the levels): of the fewest levels that can hold the target and the next two counts, the levels and grid whose
 * estimated lattice comes nearest the target.
 */
function plan(target, constants, publish, wallT) {
  const maxX = Math.floor((constants.VENUE_EXTENT_MAX_M - CORRIDOR) / PITCH_X);
  const maxZ = Math.floor((constants.VENUE_EXTENT_MAX_M - CORRIDOR) / PITCH_Z);
  const estimates = [];
  for (let kz = 1; kz <= maxZ; kz += 1) {
    for (
      let kx = 1;
      kx <= maxX && kx * kz <= constants.MAX_UNITS_PER_LEVEL;
      kx += 1
    ) {
      estimates.push({
        kx,
        kz,
        nodes: latticeEstimate(kx, kz, publish, wallT),
      });
    }
  }
  const fewest = Math.min(
    constants.MAX_LEVELS,
    Math.max(2, Math.ceil(target / NODES_PER_LEVEL)),
  );
  let best = null;
  for (
    let levels = fewest;
    levels <= Math.min(constants.MAX_LEVELS, fewest + 2);
    levels += 1
  ) {
    for (const e of estimates) {
      const miss = Math.abs(levels * e.nodes - target);
      if (!best || miss < best.miss)
        best = { levels, kx: e.kx, kz: e.kz, miss };
    }
  }
  return {
    levels: best.levels,
    kx: best.kx,
    kz: best.kz,
    ...sizeOf(best.kx, best.kz),
  };
}

const r3 = (n) => Math.round(n * 1000) / 1000;
const box = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** One level of the mall: its stores, pillars, amenities and corrections. */
function buildLevel(n, grid, rng, stores) {
  const id = `L${n}`;
  const walls = [];
  const openings = [];
  const units = [];
  const items = [];
  const amenities = [];
  for (let gz = 0; gz < grid.kz; gz += 1) {
    for (let gx = 0; gx < grid.kx; gx += 1) {
      const x0 = CORRIDOR + gx * PITCH_X;
      const z0 = CORRIDOR + gz * PITCH_Z;
      const [x1, z1] = [x0 + STORE_W, z0 + STORE_D];
      const k = `${n}-${gx}-${gz}`;
      walls.push(
        { id: `n${k}`, a: [x0, z0], b: [x1, z0] },
        { id: `e${k}`, a: [x1, z0], b: [x1, z1] },
        { id: `s${k}`, a: [x0, z1], b: [x1, z1] },
        { id: `w${k}`, a: [x0, z1], b: [x0, z0] },
      );
      const walkThrough = (gx + gz * grid.kx) % WALK_THROUGH_EVERY === 0;
      const doors = [`d${k}`];
      openings.push({
        id: `d${k}`,
        wall: `s${k}`,
        at: r3(0.3 + rng() * 0.4),
        w: 1.5,
      });
      if (walkThrough) {
        doors.push(`b${k}`);
        openings.push({ id: `b${k}`, wall: `n${k}`, at: 0.5, w: 1.5 });
      }
      units.push({
        id: `u${k}`,
        name: `Store ${k}`,
        category: "room",
        walkable: false,
        ...(walkThrough ? { passThrough: true } : {}),
        doors,
        poly: box(x0, z0, x1, z1),
      });
      stores.push({ unitKey: `u${k}` });
      items.push({
        id: `p${k}`,
        type: "PILLAR",
        x: x0 - CORRIDOR / 2,
        z: z0 - CORRIDOR / 2,
      });
      if ((gx + gz) % 9 === 0) {
        amenities.push({
          id: `a${k}`,
          type: "CR",
          at: [x1 + CORRIDOR / 2, r3(z0 + 2 + rng() * 8)],
        });
      }
    }
  }
  if (n === 0) {
    for (let e = 0; e < Math.min(3, grid.kz); e += 1) {
      const z = CORRIDOR + e * PITCH_Z - CORRIDOR / 2;
      walls.push({ id: `edge${e}`, a: [0, z - 2], b: [0, z + 2] });
      openings.push({
        id: `entrance${e}`,
        wall: `edge${e}`,
        at: 0.5,
        w: 2,
        entrance: true,
      });
    }
  }
  const corrections = [
    { id: `block${n}`, kind: "BLOCK_AREA", poly: box(1, 1, 3, 3) },
    {
      id: `add${n}`,
      kind: "ADD_PATH",
      line: [
        [CORRIDOR / 2, CORRIDOR + 1],
        [CORRIDOR / 2, CORRIDOR + PITCH_Z - 1],
      ],
    },
    {
      id: `remove${n}`,
      kind: "REMOVE_PATH",
      line: [
        [grid.width - 2, 1],
        [grid.width - 2, 4],
      ],
    },
  ];
  return {
    id,
    name: `Level ${n}`,
    shortName: `L${n}`,
    building: "b1",
    ordinal: n + 1,
    elevation: n * STOREY_M,
    origin: [0, 0],
    size: [grid.width, grid.depth],
    walls,
    openings,
    units,
    items,
    corrections,
    amenities,
  };
}

/** The connectors: per pair of levels a stair and an escalator, and one lift serving every level. */
function buildConnectors(grid) {
  const corridor = (gx, gz) => [
    CORRIDOR + gx * PITCH_X - CORRIDOR / 2,
    CORRIDOR + gz * PITCH_Z + 3,
  ];
  const out = [];
  for (let n = 0; n + 1 < grid.levels; n += 1) {
    const [sx, sz] = corridor(1, n % grid.kz);
    out.push({
      id: `st${n}`,
      name: `Stairs ${n}`,
      kind: "stairs",
      type: "STAIRS_STD",
      levels: [`L${n}`, `L${n + 1}`],
      stops: [
        [sx, sz],
        [sx, sz + 4],
      ],
      x: sx,
      z: sz + 2,
      rot: 90,
    });
    const [ex, ez] = corridor(Math.min(3, grid.kx - 1), (n + 1) % grid.kz);
    out.push({
      id: `es${n}`,
      name: `Escalator ${n}`,
      kind: "escalator",
      type: "ESC_STD",
      levels: [`L${n}`, `L${n + 1}`],
      stops: [
        [ex, ez],
        [ex, ez + 7],
      ],
      x: ex,
      z: ez + 3.5,
      rot: 90,
      ...(n % 2 === 0 ? { twoWay: true } : {}),
    });
  }
  const [lx, lz] = corridor(Math.min(2, grid.kx - 1), 0);
  out.push({
    id: "lift",
    name: "Lift",
    kind: "elevator",
    type: "LIFT_STD",
    levels: Array.from({ length: grid.levels }, (_, n) => `L${n}`),
    stops: Array.from({ length: grid.levels }, () => [lx, lz]),
    x: lx,
    z: lz,
  });
  return out;
}

/** The mall document and its rows for `target` nodes. */
function buildMall(target, schema, publish) {
  const rng = mulberry32(SEED);
  const grid = plan(
    target,
    schema.constants,
    publish,
    schema.kinds.wall.fields.t.default,
  );
  const stores = [];
  const levels = Array.from({ length: grid.levels }, (_, n) =>
    buildLevel(n, grid, rng, stores),
  );
  const doc = {
    spec: 1,
    catalog: CATALOG_VERSION,
    site: { boundary: box(0, 0, grid.width, grid.depth) },
    buildings: [{ id: "b1", name: "Main building", type: "MAIN" }],
    levels,
    connectors: buildConnectors({ ...grid }),
  };
  const storeRows = stores.map(({ unitKey }, i) => ({
    occupantId: i + 1,
    unitKey,
    name: `Shop ${i + 1}`,
    spokenName: null,
    keywords: null,
    isActive: true,
    category: { code: "FASHION", label: "Fashion", sortOrder: 0 },
    status: { code: "OPEN", label: "Open", sortOrder: 0, isRoutable: true },
  }));
  const beacons = levels.flatMap((level, n) =>
    [0, 1, 2].map((b) => ({
      beaconId: n * 10 + b + 1,
      levelKey: level.id,
      proximityUuid: TENANT_UUID,
      major: n + 1,
      minor: b + 1,
      x: String(CORRIDOR / 2),
      y: String(CORRIDOR + b * PITCH_Z),
      mountHeightM: "2.500",
      measuredPower: -59,
      isActive: true,
    })),
  );
  return { grid, doc, storeRows, beacons };
}

/** The validator's and the engine's context, from the rows: shaped by OA-1, then given what the engine reads. */
function engineContext(venueMap, rows, pairs) {
  const { objectTypes, ...lookups } = rows;
  const base = venueMap.shapeMapContext({
    catalog: venueMap.shapeCatalog(objectTypes, CATALOG_VERSION),
    ...lookups,
  });
  const enrich = (name, add) =>
    new Map(
      [...base.lookups[name]].map(([code, entry]) => [
        code,
        { label: code, sortOrder: 0, ...entry, ...add(entry) },
      ]),
    );
  return {
    catalogVersion: base.catalogVersion,
    lookups: {
      ...base.lookups,
      BuildingType: enrich("BuildingType", () => ({})),
      AmenityType: enrich("AmenityType", () => ({
        synonyms: null,
        isAccessible: false,
      })),
      TransitType: enrich("TransitType", () => ({})),
      ConnectorType: enrich("ConnectorType", (e) => ({
        ...pairs[e.costModel],
        isStepFree: e.costModel === "ELEVATOR",
      })),
    },
  };
}

function snapshotFrom(dir) {
  const venueMap = require(VENUE_MAP);
  const { DEFAULTS } = require(SETTINGS);
  const vectors = JSON.parse(fs.readFileSync(COST_VECTORS, "utf8"));
  const input = JSON.parse(
    fs.readFileSync(path.join(dir, "input.json"), "utf8"),
  );
  const context = engineContext(venueMap, input.rows, vectors.connectorPairs);
  return {
    context,
    snapshot: {
      layout: input.doc,
      venue: {
        code: "MEASURE",
        name: "Measured mall",
        evacEscalatorsAllowed: false,
      },
      tenant: {
        beaconProximityUuid: TENANT_UUID,
        catalogVersion: CATALOG_VERSION,
      },
      stores: input.storeRows,
      beacons: input.beacons,
      otherVenueBeacons: [],
      context,
      settings: {
        routing: { ...vectors.rates, ...ROUTING },
        publish: {
          nodeSpacingM: DEFAULTS["publish.nodeSpacingM"],
          bodyMarginM: DEFAULTS["publish.bodyMarginM"],
          addPathSnapM: DEFAULTS["publish.addPathSnapM"],
          maxNodesWarn: DEFAULTS["publish.maxNodesWarn"],
        },
      },
    },
  };
}

function child(dir, neighbourMoves) {
  const { analyseMap } = require(ENGINE);
  const { snapshot } = snapshotFrom(dir);
  const rssBefore = process.resourceUsage().maxRSS;
  const start = performance.now();
  const { findings, model } = analyseMap(snapshot, { neighbourMoves });
  const ms = performance.now() - start;
  const byKind = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  process.stdout.write(
    JSON.stringify({
      ms,
      nodes: model ? model.graph.nodeCount : null,
      edges: model ? model.graph.targets.length : null,
      byKind,
      rssBeforeKiB: rssBefore,
      maxRssKiB: process.resourceUsage().maxRSS,
      heapUsed: process.memoryUsage().heapUsed,
    }),
  );
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function argsOf(argv) {
  const value = (name) => {
    const i = argv.indexOf(name);
    return i < 0 ? undefined : argv[i + 1];
  };
  const nodes = Number(value("--nodes"));
  const neighbours = Number(value("--neighbours") ?? 16);
  if (!Number.isInteger(nodes) || nodes < 1 || ![8, 16].includes(neighbours)) {
    throw new Error(
      "usage: npm run measure:publish-engine -- --nodes <n> [--neighbours 16|8]",
    );
  }
  return { nodes, neighbours };
}

function main(argv) {
  const { nodes: target, neighbours } = argsOf(argv);
  const { VENUE_MAP_SCHEMA } = require(SCHEMA);
  const { constants } = VENUE_MAP_SCHEMA;
  const { DEFAULTS } = require(SETTINGS);
  const publish = {
    nodeSpacingM: DEFAULTS["publish.nodeSpacingM"],
    bodyMarginM: DEFAULTS["publish.bodyMarginM"],
  };
  const venueMap = require(VENUE_MAP);
  const { grid, doc, storeRows, beacons } = buildMall(
    target,
    VENUE_MAP_SCHEMA,
    publish,
  );
  const rows = contextRows();
  const vectors = JSON.parse(fs.readFileSync(COST_VECTORS, "utf8"));
  const check = venueMap.validateMap(
    doc,
    engineContext(venueMap, rows, vectors.connectorPairs),
  );
  if (!check.ok) {
    process.stderr.write(
      `the synthetic mall is not valid: ${JSON.stringify(check.problems)}\n`,
    );
    return 1;
  }
  const text = JSON.stringify(doc);
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "gabay-measure-publish-engine-"),
  );
  try {
    fs.writeFileSync(
      path.join(dir, "input.json"),
      JSON.stringify({ doc, rows, storeRows, beacons }),
    );
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      const r = spawnSync(
        process.execPath,
        [__filename, "--child", dir, String(neighbours)],
        {
          encoding: "utf8",
          maxBuffer: 16 * MIB,
        },
      );
      if (r.status !== 0) {
        process.stderr.write(r.stdout + r.stderr);
        return 1;
      }
      runs.push(JSON.parse(r.stdout));
    }
    const [first] = runs;
    if (first.nodes === null) {
      process.stderr.write(
        `a finding blocked the analysis: ${JSON.stringify(first.byKind)}\n`,
      );
      return 1;
    }
    const times = runs.map((r) => r.ms).sort((a, b) => a - b);
    const peak = Math.max(...runs.map((r) => r.maxRssKiB)) / 1024;
    const before = Math.max(...runs.map((r) => r.rssBeforeKiB)) / 1024;
    const heap = Math.max(...runs.map((r) => r.heapUsed)) / MIB;
    const units = doc.levels.reduce((n, l) => n + l.units.length, 0);
    const cpu = os.cpus()[0]?.model.trim() ?? "unknown CPU";
    const kinds = Object.entries(first.byKind)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
    const lines = [
      "publish engine analysis (analyseMap), measured and not gated (spec/P0-03.md r4 AC-137; A5, D14)",
      `target: about ${target} nodes, ${neighbours} neighbours; mall: ${grid.levels} levels of ${grid.width} x ${grid.depth} m, ${grid.kx} x ${grid.kz} stores each (${units} units), ${doc.connectors.length} connectors; document ${Buffer.byteLength(text, "utf8")} bytes (MAX_MAP_BYTES ${constants.MAX_MAP_BYTES})`,
      `graph: ${first.nodes} nodes, ${first.edges} directed edges, ${(first.edges / first.nodes).toFixed(2)} edges per node (Spike 2: 6.3 on an 8-neighbour mesh; A1: about 13 at 16); publish.maxNodesWarn ${DEFAULTS["publish.maxNodesWarn"]}`,
      `runs: ${RUNS}, each in a fresh Node process; time is analyseMap alone`,
      `time: median ${percentile(times, 0.5).toFixed(0)} ms, p95 ${percentile(times, 0.95).toFixed(0)} ms (min ${times[0].toFixed(0)}, max ${times[times.length - 1].toFixed(0)}); longest synchronous stretch: the whole call (the engine never yields, DC-31, EC-90)`,
      `peak memory: max RSS ${peak.toFixed(1)} MiB (before the analysis: ${before.toFixed(1)} MiB); heap used after: ${heap.toFixed(1)} MiB`,
      `findings: ${kinds}`,
      `machine: ${cpu}, ${os.cpus().length} logical cores, ${(os.totalmem() / 1024 ** 3).toFixed(1)} GiB RAM, ${process.platform} ${os.release()}, Node ${process.version}`,
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    return 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv[2] === "--child")
    child(process.argv[3], Number(process.argv[4]));
  else process.exitCode = main(process.argv.slice(2));
}

module.exports = { buildMall, plan };
