#!/usr/bin/env node
// Writes the 3D spike's level fixture (plan/V3D-spike.md 1.0 step 1, DC-V4, DC-V5, DC-19):
// db/seeds/sources/demo/*.json -> app/lib/spike3d/demo_level.g.dart, the heaviest Demo Malls level as const Dart data
// in the shape of app/lib/core/map3d/level_geometry.dart, plus the marker's path.
//
//   npm run gen:spike3d-level                write the Dart file
//   node tools/gen-spike3d-level.js --check  exit 1, writing nothing, when the Dart file is stale
//
// tools/test/gen-spike3d-level.test.js runs the check inside `npm run tools:test`, so a changed seed source fails
// `npm run verify` until the fixture is regenerated. The file header records the source file, its SHA-256, the level
// and its counts against the document's caps.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { dartMemberName, dartString, generatedHeader, writeOrCheck } = require('./lib/dart-gen');
const { convertVenue, rankLevels, elementCount } = require('./lib/spike3d-level');

const ROOT = path.resolve(__dirname, '..');
const DART_FILE = 'app/lib/spike3d/demo_level.g.dart';
const SOURCE_DIR = 'db/seeds/sources/demo';
const SOURCE_FILES = ['aurora.json', 'bayview.json', 'meridian.json', 'spire.json'];
const SCHEMA_FILE = 'functions/src/config/venue-map-schema.json';
const COMMAND = 'gen:spike3d-level';
const RANKED_IN_HEADER = 5;

function schemaConstants(root = ROOT) {
  const { constants } = JSON.parse(fs.readFileSync(path.join(root, SCHEMA_FILE), 'utf8'));
  const value = (name) => constants[name].value;
  return {
    wallThicknessM: value('WALL_THICKNESS_DEFAULT_M'),
    levelHeightM: value('LEVEL_HEIGHT_DEFAULT_M'),
    wallMinLengthM: value('WALL_MIN_LENGTH_M'),
    caps: {
      walls: value('MAX_WALLS_PER_LEVEL'),
      units: value('MAX_UNITS_PER_LEVEL'),
      items: value('MAX_ITEMS_PER_LEVEL'),
      polyPoints: value('MAX_POLY_POINTS'),
    },
  };
}

/** Every source's bytes, its SHA-256 and its converted levels, in SOURCE_FILES order. */
function readSources(root = ROOT) {
  const constants = schemaConstants(root);
  return SOURCE_FILES.map((name) => {
    const file = `${SOURCE_DIR}/${name}`;
    const bytes = fs.readFileSync(path.join(root, file));
    return {
      file,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      levels: convertVenue(JSON.parse(bytes.toString('utf8')), constants),
    };
  });
}

/** The counts the header and DemoLevelCounts state for one level. */
function countsOf(level) {
  const explicit = level.walls.filter((w) => w.source === 'wall').length;
  return {
    walls: level.explicitWalls,
    wallSegments: explicit,
    outlineSegments: level.walls.length - explicit,
    units: level.units.length,
    walkableUnits: level.units.filter((u) => u.walkable).length,
    storeUnits: level.units.filter((u) => u.storeName !== null).length,
    items: level.items.length,
    maxPolyPoints: Math.max(0, ...level.units.map((u) => u.outline.length / 2)),
    elements: elementCount(level),
  };
}

const num = (v) => String(v);
const list = (values) => `<double>[${values.map(num).join(', ')}]`;
const describe = (l) =>
  `${l.venueName} (${l.venueId}), building ${l.buildingId ?? 'none'}` +
  `${l.buildingName ? ` "${l.buildingName}"` : ''}, level "${l.shortName}" (${l.levelName}), elevation ${l.elevation} m`;

function renderWall(w) {
  const tail =
    w.source === 'wall'
      ? `, thickness: ${num(w.thickness)}, kind: WallKind.${dartMemberName(w.kind)}`
      : '';
  return (
    `    WallSegment(ax: ${num(w.ax)}, az: ${num(w.az)}, bx: ${num(w.bx)}, bz: ${num(w.bz)}, ` +
    `source: WallSource.${w.source}, sourceId: ${dartString(w.sourceId)}${tail}),`
  );
}

function renderUnit(u) {
  const store = u.storeName === null ? '' : `, storeName: ${dartString(u.storeName)}`;
  return (
    `    UnitGeometry(id: ${dartString(u.id)}, category: ImdfUnitCategory.${dartMemberName(u.category)}, ` +
    `walkable: ${u.walkable}, outline: ${list(u.outline)}${store}),`
  );
}

/** The whole Dart file for the heaviest level of `sources`. */
function renderDart(sources, constants = schemaConstants()) {
  const ranked = rankLevels(
    sources.flatMap((s) => s.levels.map((level) => ({ ...level, source: s }))),
  );
  const chosen = ranked[0].level;
  const c = countsOf(chosen);
  const caps = constants.caps;
  const out = [
    ...generatedHeader({
      source: chosen.source.file,
      what: "the 3D spike's level fixture (plan/V3D-spike.md 1.0 step 1, DC-V4, DC-V5, DC-19)",
      command: COMMAND,
    }),
    '//',
    `// Source SHA-256: ${chosen.source.sha256}`,
    `// Level: ${describe(chosen)}, height ${chosen.height} m.`,
    `// Chosen as the heaviest of ${ranked.length} (venue, building, level) entries in ${SOURCE_FILES.length}`,
    '// sources by walls + units + items (DC-19; a tie goes to the lower elevation). Heaviest first:',
    ...ranked
      .slice(0, RANKED_IN_HEADER)
      .map((r, i) => `//   ${i + 1}. ${r.elements} elements: ${describe(r.level)}`),
    '// Counts against the caps (VenueMapConstants):',
    `//   walls (explicit, one per outline edge): ${c.walls} of ${caps.walls}`,
    `//   wall segments: ${c.wallSegments} explicit (split at doors) + ${c.outlineSegments} unit outline`,
    `//   units: ${c.units} of ${caps.units} (${c.storeUnits} with a store, ${c.walkableUnits} walkable)`,
    `//   items: ${c.items} of ${caps.items}`,
    `//   longest outline: ${c.maxPolyPoints} points of ${caps.polyPoints}`,
    '',
    "import '../core/config/closed_sets.dart';",
    "import '../core/map3d/level_geometry.dart';",
    '',
    "/// The fixture's counts, as the generator counted them (the header above).",
    'abstract final class DemoLevelCounts {',
    `  static const String sourceFile = ${dartString(chosen.source.file)};`,
    `  static const String sourceSha256 = ${dartString(chosen.source.sha256)};`,
    `  static const String venueId = ${dartString(chosen.venueId)};`,
    `  static const int sourceLevelIndex = ${chosen.levelIndex};`,
    `  static const int walls = ${c.walls};`,
    `  static const int wallSegments = ${c.wallSegments};`,
    `  static const int outlineSegments = ${c.outlineSegments};`,
    `  static const int units = ${c.units};`,
    `  static const int storeUnits = ${c.storeUnits};`,
    `  static const int walkableUnits = ${c.walkableUnits};`,
    `  static const int items = ${c.items};`,
    '}',
    '',
    "/// The marker's path (plan step 5): x, z pairs, walked out and back.",
    `const List<double> demoMarkerPath = ${list(chosen.markerPath)};`,
    '',
    '/// The heaviest Demo Malls level (DC-19).',
    'const LevelGeometry demoLevel = LevelGeometry(',
    `  levelId: ${dartString(`${chosen.buildingId ?? 'outdoor'}-${chosen.sourceLevelId}`)},`,
    `  buildingId: ${chosen.buildingId === null ? 'null' : dartString(chosen.buildingId)},`,
    `  elevation: ${num(chosen.elevation)},`,
    `  height: ${num(chosen.height)},`,
    `  originX: ${num(chosen.origin[0])},`,
    `  originZ: ${num(chosen.origin[1])},`,
    `  sizeW: ${num(chosen.size[0])},`,
    `  sizeD: ${num(chosen.size[1])},`,
    `  floorOutline: ${list(chosen.floorOutline)},`,
    '  walls: <WallSegment>[',
    ...chosen.walls.map(renderWall),
    '  ],',
    '  units: <UnitGeometry>[',
    ...chosen.units.map(renderUnit),
    '  ],',
    '  items: <ItemGeometry>[],',
    ');',
    '',
  ];
  return out.join('\n');
}

function main(argv) {
  const sources = readSources();
  const expected = renderDart(sources);
  const summary = expected.split('\n').find((l) => l.startsWith('// Level: '));
  fs.mkdirSync(path.dirname(path.join(ROOT, DART_FILE)), { recursive: true });
  return writeOrCheck({ root: ROOT, file: DART_FILE, expected, command: COMMAND, summary, argv });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { DART_FILE, SOURCE_FILES, readSources, renderDart, countsOf, schemaConstants };
