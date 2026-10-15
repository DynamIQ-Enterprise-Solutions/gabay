// The venue map document as the engine reads it (spec/OA-1.md r1 section 2; spec/P0-03.md r4 section 3.14.0's
// vocabulary). The engine receives the canonical copy, which leaves out every field equal to its default (OA-1
// DC-11), so each such field is filled here from the schema file's own default: no default is written twice
// (OA-1 AC-37; no literal of a schema value). Positions are (x, z) in the venue frame, x across and z down the plan,
// origin at the top-left (OA-1 section 2). Read-only: the document is never changed.
//
// readLayout(layout, context) -> {
//   levels: [{ index, id, name, ordinal, elevation, outdoor, building, rect: { x0, z0, x1, z1 },
//              walls, openings, units, items, corrections, amenities, transitPoints, anchors }],
//   levelById, unitById, buildings: [{ index, id, footprint }], connectors }
// Every element keeps its document position (`index`) and its level's (`levelIndex`), the order every list in the
// engine follows (AC-31, DC-A10).
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { subsetOf, codesOf } = require('../../config/closedSets');
const { PublishBuildError } = require('./buildError');

const KINDS = VENUE_MAP_SCHEMA.kinds;
const OPENING_KIND = codesOf('OpeningKind');

/**
 * The field's value, or what the canonical copy means by leaving it out: the schema's default, or for a flag with
 * `defaultFrom` (a unit's walkable, OA-1 AC-9) whether the source field's value is in the subset. A field with no
 * default (a name, clearW) is undefined when absent.
 */
function valueOf(element, kindName, fieldName) {
  if (Object.hasOwn(element, fieldName)) return element[fieldName];
  const rule = KINDS[kindName].fields[fieldName];
  if (!rule) throw new Error(`publish engine: the schema's ${kindName} has no field ${fieldName}`);
  if (rule.defaultFrom) {
    return subsetOf(rule.defaultFrom.subset).includes(element[rule.defaultFrom.field]);
  }
  return rule.default;
}

const point = (p) => [p[0], p[1]];

function readWall(wall, index, levelIndex) {
  const [ax, az] = wall.a;
  const [bx, bz] = wall.b;
  const length = Math.hypot(bx - ax, bz - az);
  return {
    index,
    levelIndex,
    id: wall.id,
    a: point(wall.a),
    b: point(wall.b),
    t: valueOf(wall, 'wall', 't'),
    kind: valueOf(wall, 'wall', 'kind'),
    length,
    ux: (bx - ax) / length,
    uz: (bz - az) / length,
  };
}

/**
 * An opening on its wall: the midpoint a + at x (b - a) (AC-95), and its gap along the wall, `w` wide and centred
 * there, cut to the wall's own length for the wall segments (AC-94).
 */
function readOpening(opening, index, levelIndex, wallById) {
  const wall = wallById.get(opening.wall);
  const at = opening.at;
  const w = opening.w;
  const along = at * wall.length;
  const from = Math.max(0, along - w / 2);
  const to = Math.min(wall.length, along + w / 2);
  const pointAt = (s) => [wall.a[0] + s * wall.ux, wall.a[1] + s * wall.uz];
  const clearW = valueOf(opening, 'opening', 'clearW');
  const kind = valueOf(opening, 'opening', 'kind');
  return {
    index,
    levelIndex,
    id: opening.id,
    wall,
    at,
    w,
    kind,
    isDoor: kind === OPENING_KIND.door,
    entrance: valueOf(opening, 'opening', 'entrance'),
    clearW: clearW === undefined ? null : clearW,
    name: valueOf(opening, 'opening', 'name') ?? null,
    mid: [wall.a[0] + at * (wall.b[0] - wall.a[0]), wall.a[1] + at * (wall.b[1] - wall.a[1])],
    gapFrom: from,
    gapTo: to,
    gap: [pointAt(from), pointAt(to)],
  };
}

function readUnit(unit, index, levelIndex) {
  return {
    index,
    levelIndex,
    id: unit.id,
    name: valueOf(unit, 'unit', 'name') ?? null,
    walkable: valueOf(unit, 'unit', 'walkable'),
    passThrough: valueOf(unit, 'unit', 'passThrough'),
    parent: valueOf(unit, 'unit', 'parent') ?? null,
    doors: [...valueOf(unit, 'unit', 'doors')],
    ring: unit.poly.map(point),
  };
}

/**
 * An item with its footprint's size: the item's own `w` and `d`, else its catalog type's defaults (EC-101); a
 * round type's `d` follows its `w` (office section 5). `blocks` and `round` come from the type (OA-1 AC-44). A code
 * the snapshot's catalog does not resolve gives `type` null and blocks nothing: the tenant check reports it (AC-108).
 * A blocking item with no size is a build failure naming the item and its type, never a warning and never a silent
 * pass (the owner's ruling on the A1′a review's I2, 2026-10-15, option (b): a blocking ObjectType must have a
 * default size, which OA-3a's migration enforces; until then this is the engine's stop).
 */
function readItem(item, index, levelIndex, objectTypes) {
  const type = objectTypes.get(item.type) ?? null;
  const round = type !== null && type.round;
  const w = valueOf(item, 'item', 'w') ?? type?.size.w ?? null;
  const d = round ? w : (valueOf(item, 'item', 'd') ?? type?.size.d ?? null);
  const blocks = type !== null && type.blocks;
  if (blocks && !(w > 0 && d > 0)) {
    throw new PublishBuildError(
      `item ${item.id} of type ${item.type} blocks walking but has no size: neither the item nor its type gives one`,
    );
  }
  return {
    index,
    levelIndex,
    id: item.id,
    typeCode: item.type,
    x: item.x,
    z: item.z,
    rot: valueOf(item, 'item', 'rot'),
    w,
    d,
    blocks,
    round,
  };
}

function readCorrection(correction, index, levelIndex) {
  return {
    index,
    levelIndex,
    id: correction.id,
    kind: correction.kind,
    ring: correction.poly ? correction.poly.map(point) : null,
    line: correction.line ? correction.line.map(point) : null,
  };
}

function readPoint(element, kindName, index, levelIndex) {
  const unit = kindName === 'transitPoint' ? undefined : valueOf(element, kindName, 'unit');
  return {
    index,
    levelIndex,
    id: element.id,
    kind: kindName,
    typeCode: element.type ?? null,
    name: valueOf(element, kindName, 'name') ?? null,
    at: point(element.at),
    unit: unit ?? null,
  };
}

function readLevel(level, index, objectTypes) {
  const origin = level.origin;
  const size = level.size;
  const walls = valueOf(level, 'level', 'walls').map((w, i) => readWall(w, i, index));
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const points = (field, kindName) =>
    valueOf(level, 'level', field).map((e, i) => readPoint(e, kindName, i, index));
  return {
    index,
    id: level.id,
    name: level.name,
    ordinal: level.ordinal,
    elevation: valueOf(level, 'level', 'elevation'),
    outdoor: valueOf(level, 'level', 'outdoor'),
    building: valueOf(level, 'level', 'building') ?? null,
    rect: { x0: origin[0], z0: origin[1], x1: origin[0] + size[0], z1: origin[1] + size[1] },
    walls,
    openings: valueOf(level, 'level', 'openings').map((o, i) => readOpening(o, i, index, wallById)),
    units: valueOf(level, 'level', 'units').map((u, i) => readUnit(u, i, index)),
    items: valueOf(level, 'level', 'items').map((it, i) => readItem(it, i, index, objectTypes)),
    corrections: valueOf(level, 'level', 'corrections').map((c, i) => readCorrection(c, i, index)),
    amenities: points('amenities', 'amenity'),
    transitPoints: points('transitPoints', 'transitPoint'),
    anchors: points('anchors', 'anchor'),
  };
}

function readConnector(connector, index, levelById) {
  return {
    index,
    id: connector.id,
    name: connector.name,
    kind: connector.kind,
    typeCode: connector.type,
    levels: connector.levels.map((id) => levelById.get(id).index),
    stops: connector.stops.map(point),
    walkable: valueOf(connector, 'connector', 'walkable'),
    preferred: valueOf(connector, 'connector', 'preferred'),
    twoWay: valueOf(connector, 'connector', 'twoWay'),
    evacuationOnly: valueOf(connector, 'connector', 'evacuationOnly'),
  };
}

/**
 * @param {object} layout  the canonical, publishable venue map document
 * @param {object} context  shapeMapContext's result (the catalog's ObjectType entries)
 */
function readLayout(layout, context) {
  const objectTypes = context.lookups.ObjectType;
  const levels = layout.levels.map((level, i) => readLevel(level, i, objectTypes));
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const unitById = new Map(levels.flatMap((l) => l.units.map((u) => [u.id, u])));
  const buildings = valueOf(layout, 'document', 'buildings').map((b, index) => ({
    index,
    id: b.id,
    footprint: b.footprint ? b.footprint.map(point) : null,
  }));
  const connectors = valueOf(layout, 'document', 'connectors').map((c, i) =>
    readConnector(c, i, levelById),
  );
  return { levels, levelById, unitById, buildings, connectors };
}

module.exports = { readLayout };
