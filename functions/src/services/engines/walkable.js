// One level's walkable area (spec/P0-03.md r4 AC-90 to AC-92; office section 11; L170 Q6), as an exact point test
// and an exact segment test (plan/FF-3-prime-A1.md 1.0 DC-A1, DC-A2). The area is the level's rectangle (`origin`,
// `size`, its edge not grown) minus the blockers, each grown by the body margin (`publish.bodyMarginM`):
//   (a) every wall, as the rectangle of its thickness t along a to b;
//   (b) every unit whose `walkable` is false (a pass-through store included);
//   (c) every item whose catalog type `blocks`: its box w x d turned by `rot`, or the circle of diameter w;
//   (d) on the outdoor level only, every building's footprint (DC-17).
// Then each door's channel is cut back in (AC-92), and last every BLOCK_AREA is taken away exactly as drawn
// (DC-18). A connector's footprint is not a blocker (DC-40).
//
// A channel opens the doorway, not the rooms on either side of it (A1′a review I1): where it reaches strictly inside
// a non-walkable unit or a building footprint, it opens only its own wall's body there, so no node lands inside a
// store (V-GEO-3) or inside a footprint on the outdoor level (AC-90 (d), DC-17). On its own level every door cuts
// its channel; on another level of its elevation (one floor, D6) only a door whose gap lies on a building
// footprint's edge does, which is how a building's entrance opens the outdoor level (V-GEO-5).
//
// "Grown by the margin" is a distance: a point is blocked when it lies strictly inside a blocker or less than the
// margin from it. The grown blocker is an open set (DC-A2): a point exactly one margin away is walkable, and with
// the margin 0 a point on a blocker's outline is walkable. A channel and a BLOCK_AREA are closed: their outline
// belongs to them.
//
// A segment is walkable when every point on it is. Along a straight line walkability can only change where the line
// meets the outline of a channel, a BLOCK_AREA or a blocker, or the edge of a blocker's grown band (margin.js), so
// the segment is split at those points and each piece is tested at its middle, with each split point itself: exact,
// with no sampling step to tune (A1's method, kept).
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');
const { boxPolygon } = require('./geometry/shapes');
const { circleParams, capsuleParams } = require('./geometry/margin');
const { pointSegmentDistanceSq } = require('./geometry/distance');
const { gapsOnEdge } = require('./walls');
const { codesOf } = require('../../config/closedSets');

const CORRECTION = codesOf('NavCorrectionKind');
/** The blockers a channel opens only its wall's body inside: rooms on either side of a doorway (review I1). */
const ENCLOSING = new Set(['unit', 'building']);

/** Bucket side for one level's indexes, in metres (a node join or walk edge spans a cell or two). Kept from A1. */
const BUCKET_CELL_M = 6;
/** Two split points closer than this along a segment (as a fraction of it) are one point. Kept from A1. */
const SAME_SPLIT = 1e-12;

const E = planar.EPS;
const POLYGON = 'polygon';
const CIRCLE = 'circle';

function polygonShape(ring, source) {
  const edges = [];
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    edges.push([p[0], p[1], q[0], q[1]]);
  }
  const [minX, minZ, maxX, maxZ] = planar.boundsOf(ring);
  return { type: POLYGON, ring, edges, minX, minZ, maxX, maxZ, source };
}

function circleShape(cx, cz, r, source) {
  return {
    type: CIRCLE,
    cx,
    cz,
    r,
    minX: cx - r,
    minZ: cz - r,
    maxX: cx + r,
    maxZ: cz + r,
    source,
  };
}

/** A wall's body: the rectangle of thickness t centred on a to b (AC-90 (a)). */
function wallRectangle(wall) {
  const hx = (-wall.uz * wall.t) / 2;
  const hz = (wall.ux * wall.t) / 2;
  const [ax, az] = wall.a;
  const [bx, bz] = wall.b;
  return [
    [ax + hx, az + hz],
    [bx + hx, bz + hz],
    [bx - hx, bz - hz],
    [ax - hx, az - hz],
  ];
}

/**
 * A door's channel (AC-92): a rectangle as wide as the opening's w along its wall and t + 2 x margin across it,
 * centred on the opening's midpoint. It carries its wall's body (the centreline through `mid` along (ux, uz), half
 * its thickness `halfT`) and the body's two faces across the channel, where what a channel opens inside a room
 * changes (review I1).
 */
function doorChannel(opening, margin) {
  const { wall, mid, w } = opening;
  const alongX = (wall.ux * w) / 2;
  const alongZ = (wall.uz * w) / 2;
  const across = wall.t / 2 + margin;
  const nx = -wall.uz * across;
  const nz = wall.ux * across;
  const bx = -wall.uz * (wall.t / 2);
  const bz = wall.ux * (wall.t / 2);
  const face = (s) => [
    mid[0] - alongX + s * bx,
    mid[1] - alongZ + s * bz,
    mid[0] + alongX + s * bx,
    mid[1] + alongZ + s * bz,
  ];
  return {
    ring: [
      [mid[0] - alongX + nx, mid[1] - alongZ + nz],
      [mid[0] + alongX + nx, mid[1] + alongZ + nz],
      [mid[0] + alongX - nx, mid[1] + alongZ - nz],
      [mid[0] - alongX - nx, mid[1] - alongZ - nz],
    ],
    mid,
    ux: wall.ux,
    uz: wall.uz,
    halfT: wall.t / 2,
    faces: [face(1), face(-1)],
  };
}

/** A channel as a shape: its ring, with its wall body's two faces added to the edges a segment is split at. */
function channelShape(channel) {
  const shape = polygonShape(channel.ring, { kind: 'channel' });
  shape.edges.push(...channel.faces);
  shape.body = channel;
  return shape;
}

/** True when (x, z) lies within the channel's wall body: no farther than half its thickness from the centreline. */
function inWallBody({ mid, ux, uz, halfT }, x, z) {
  return Math.abs((x - mid[0]) * uz - (z - mid[1]) * ux) <= halfT + E;
}

/** The level's blockers as drawn, not grown: AC-90 (a) to (d), in document order. */
function levelBlockers(level, footprints) {
  const out = [];
  for (const wall of level.walls) {
    out.push(polygonShape(wallRectangle(wall), { kind: 'wall', id: wall.id }));
  }
  for (const unit of level.units) {
    if (!unit.walkable) out.push(polygonShape(unit.ring, { kind: 'unit', id: unit.id }));
  }
  for (const item of level.items) {
    if (!item.blocks) continue;
    const source = { kind: 'item', id: item.id };
    out.push(
      item.round
        ? circleShape(item.x, item.z, item.w / 2, source)
        : polygonShape(boxPolygon(item.x, item.z, item.w, item.d, item.rot)[0], source),
    );
  }
  if (level.outdoor) {
    for (const { id, footprint } of footprints) {
      if (footprint) out.push(polygonShape(footprint, { kind: 'building', id }));
    }
  }
  return out;
}

function indexOf(shapes, grow) {
  const index = createBucketIndex(BUCKET_CELL_M);
  shapes.forEach((s, i) =>
    index.insert(i, s.minX - grow, s.minZ - grow, s.maxX + grow, s.maxZ + grow),
  );
  return index;
}

/** True when (x, z) is strictly inside the blocker or less than `margin` from it (the open grown set, DC-A2). */
function blockedBy(shape, x, z, margin) {
  if (shape.type === CIRCLE) return Math.hypot(x - shape.cx, z - shape.cz) < shape.r + margin - E;
  if (planar.pointInRing(x, z, shape.ring) === 'inside') return true;
  if (margin <= E) return false;
  const limitSq = (margin - E) * (margin - E);
  for (const [ax, az, bx, bz] of shape.edges) {
    if (pointSegmentDistanceSq(x, z, ax, az, bx, bz) < limitSq) return true;
  }
  return false;
}

/**
 * @param {object} level  layout.js's level
 * @param {object} opts
 * @param {number} opts.margin  the body margin, metres (AC-91)
 * @param {object[]} opts.channels  the door channels that cut this level's blockers (doorChannel results)
 * @param {{ id: string, footprint: number[][] | null }[]} opts.footprints  the buildings (used on the outdoor level)
 * @param {object[]} opts.wallSegments  this level's AC-94 segments (walls.js)
 */
function createLevelArea(level, { margin, channels, footprints, wallSegments }) {
  const { rect } = level;
  const blockers = levelBlockers(level, footprints);
  const channelShapes = channels.map(channelShape);
  const blockAreas = level.corrections
    .filter((c) => c.kind === CORRECTION.BLOCK_AREA)
    .map((c) => polygonShape(c.ring, { kind: 'correction', id: c.id }));
  const blockerIndex = indexOf(blockers, margin);
  const channelIndex = indexOf(channelShapes, 0);
  const blockAreaIndex = indexOf(blockAreas, 0);
  const wallIndex = createBucketIndex(BUCKET_CELL_M);
  wallSegments.forEach((w, i) =>
    wallIndex.insert(
      i,
      Math.min(w.x1, w.x2),
      Math.min(w.z1, w.z2),
      Math.max(w.x1, w.x2),
      Math.max(w.z1, w.z2),
    ),
  );

  const inRect = (x, z) =>
    x >= rect.x0 - E && x <= rect.x1 + E && z >= rect.z0 - E && z <= rect.z1 + E;

  /** True when any shape of `shapes` near (x, z) holds the point, edge included. */
  function inAny(index, shapes, x, z) {
    let hit = false;
    index.query(x - E, z - E, x + E, z + E, (i) => {
      hit = planar.pointInRing(x, z, shapes[i].ring) !== 'outside';
      return hit;
    });
    return hit;
  }

  function blocked(x, z, m) {
    let hit = false;
    blockerIndex.query(x - E, z - E, x + E, z + E, (i) => {
      hit = blockedBy(blockers[i], x, z, m);
      return hit;
    });
    return hit;
  }

  /** True when (x, z) lies strictly inside a non-walkable unit or a building footprint of this level. */
  function insideRoom(x, z) {
    let hit = false;
    blockerIndex.query(x - E, z - E, x + E, z + E, (i) => {
      const shape = blockers[i];
      hit =
        shape.type === POLYGON &&
        ENCLOSING.has(shape.source.kind) &&
        planar.pointInRing(x, z, shape.ring) === 'inside';
      return hit;
    });
    return hit;
  }

  /**
   * True when a channel opens (x, z): the point lies in a channel (its outline included), and either within that
   * channel's wall body or not inside a room (review I1).
   */
  function opensAt(x, z) {
    let inChannel = false;
    let inBody = false;
    channelIndex.query(x - E, z - E, x + E, z + E, (i) => {
      const shape = channelShapes[i];
      if (planar.pointInRing(x, z, shape.ring) === 'outside') return false;
      inChannel = true;
      inBody = inWallBody(shape.body, x, z);
      return inBody;
    });
    return inChannel && (inBody || !insideRoom(x, z));
  }

  /** The walkable test with the blockers grown by `m`: the margin, or 0 for the floor as drawn (clearance.js). */
  function walkableWith(x, z, m) {
    if (!inRect(x, z)) return false;
    if (inAny(blockAreaIndex, blockAreas, x, z)) return false;
    if (opensAt(x, z)) return true;
    return !blocked(x, z, m);
  }

  /**
   * Appends to `out` every t along a-b where walkability (with blockers grown by `m`) can change: where the segment
   * meets a channel, a BLOCK_AREA or a blocker's outline, or the edge of a blocker's grown band.
   */
  function splitParams(ax, az, bx, bz, out, m = margin) {
    const minX = Math.min(ax, bx) - E;
    const minZ = Math.min(az, bz) - E;
    const maxX = Math.max(ax, bx) + E;
    const maxZ = Math.max(az, bz) + E;
    const outline = (shape) => {
      for (const [cx, cz, dx, dz] of shape.edges)
        planar.meetParams(ax, az, bx, bz, cx, cz, dx, dz, out);
    };
    channelIndex.query(minX, minZ, maxX, maxZ, (i) => outline(channelShapes[i]));
    blockAreaIndex.query(minX, minZ, maxX, maxZ, (i) => outline(blockAreas[i]));
    blockerIndex.query(minX, minZ, maxX, maxZ, (i) => {
      const shape = blockers[i];
      if (shape.type === CIRCLE) {
        circleParams(ax, az, bx, bz, shape.cx, shape.cz, shape.r + m, out);
        return false;
      }
      outline(shape);
      if (m > E) {
        for (const [cx, cz, dx, dz] of shape.edges)
          capsuleParams(ax, az, bx, bz, cx, cz, dx, dz, m, out);
      }
      return false;
    });
  }

  /** The first point where a-b passes through one of this level's wall segments (AC-94), or null. */
  function crossesWall(ax, az, bx, bz) {
    let best = null;
    wallIndex.query(
      Math.min(ax, bx) - E,
      Math.min(az, bz) - E,
      Math.max(ax, bx) + E,
      Math.max(az, bz) + E,
      (i) => {
        const w = wallSegments[i];
        if (!planar.segmentsCross(ax, az, bx, bz, w.x1, w.z1, w.x2, w.z2)) return false;
        const [x, z] = planar.crossingPoint(ax, az, bx, bz, w.x1, w.z1, w.x2, w.z2);
        const distance = Math.hypot(x - ax, z - az);
        if (!best || distance < best.distance) best = { x, z, distance, segment: w };
        return false;
      },
    );
    return best;
  }

  const pointWalkable = (x, z) => walkableWith(x, z, margin);

  /** True when the whole segment a-b lies in this level's walkable area and crosses none of its wall segments. */
  function segmentWalkable(ax, az, bx, bz) {
    if (!pointWalkable(ax, az) || !pointWalkable(bx, bz)) return false;
    if (crossesWall(ax, az, bx, bz)) return false;
    const ts = [];
    splitParams(ax, az, bx, bz, ts);
    if (ts.length === 0) return true;
    return piecesPass(ax, az, bx, bz, ts, pointWalkable);
  }

  return {
    level,
    rect,
    margin,
    blockers,
    blockAreas,
    channels: channelShapes,
    wallSegments,
    pointWalkable,
    floorAt: (x, z) => walkableWith(x, z, 0),
    splitParams,
    crossesWall,
    segmentWalkable,
  };
}

/**
 * True when every point of a-b passes `ok`, testing the pieces between the split points `ts` (fractions along a-b,
 * in any order) at their middles, and the split points themselves. Kept from A1.
 */
function piecesPass(ax, az, bx, bz, ts, ok) {
  ts.push(0, 1);
  ts.sort((p, q) => p - q);
  let last = -1;
  for (let k = 0; k < ts.length; k += 1) {
    const t = ts[k];
    if (t - last <= SAME_SPLIT) continue;
    if (k > 0 && last >= 0) {
      const m = (last + t) / 2;
      if (!ok(ax + m * (bx - ax), az + m * (bz - az))) return false;
    }
    if (t > 0 && t < 1 && !ok(ax + t * (bx - ax), az + t * (bz - az))) return false;
    last = t;
  }
  return true;
}

/**
 * Levels of one elevation are one floor (ruled D6; AC-28): true when every point of a-b is walkable on at least one
 * of `areas` and a-b crosses no wall segment of any of them, so a wall on one level is never stepped over because
 * another level has floor there.
 */
function segmentWalkableAcross(areas, ax, az, bx, bz) {
  const ok = (x, z) => areas.some((a) => a.pointWalkable(x, z));
  if (!ok(ax, az) || !ok(bx, bz)) return false;
  if (areas.some((a) => a.crossesWall(ax, az, bx, bz))) return false;
  const ts = [];
  for (const a of areas) a.splitParams(ax, az, bx, bz, ts);
  if (ts.length === 0) return true;
  return piecesPass(ax, az, bx, bz, ts, ok);
}

/** True when the door's gap lies on an edge of a building's footprint (walls.js's on-the-edge rule, AC-94). */
function onFootprintEdge(door, buildings) {
  for (const { footprint } of buildings) {
    if (!footprint) continue;
    for (let i = 0; i < footprint.length; i += 1) {
      const [ax, az] = footprint[i];
      const [bx, bz] = footprint[(i + 1) % footprint.length];
      if (gapsOnEdge(ax, az, bx, bz, [door]).length > 0) return true;
    }
  }
  return false;
}

/**
 * Every level's area. Each door's channel cuts the blockers of its own level, and of every other level at its
 * elevation (one floor, D6) only when its gap lies on a building footprint's edge, so a building's entrance opens
 * the outdoor level's footprint margin (V-GEO-5) and an interior door opens nothing outdoors (review I1).
 * `channels: false` switches the channels off (a test of AC-92's trap, V-GEO-2).
 * @param {object} layout  readLayout's result
 * @param {Map<string, object[]>} wallSegments  level id -> its AC-94 segments
 */
function createAreas(layout, wallSegments, { margin, channels = true }) {
  const own = layout.levels.map(() => []);
  const shared = new Map();
  for (const level of layout.levels) {
    if (!shared.has(level.elevation)) shared.set(level.elevation, []);
    if (!channels) continue;
    for (const opening of level.openings) {
      if (!opening.isDoor) continue;
      const channel = doorChannel(opening, margin);
      own[level.index].push(channel);
      if (onFootprintEdge(opening, layout.buildings)) {
        shared.get(level.elevation).push({ levelIndex: level.index, channel });
      }
    }
  }
  return layout.levels.map((level) =>
    createLevelArea(level, {
      margin,
      channels: [
        ...own[level.index],
        ...shared
          .get(level.elevation)
          .filter((s) => s.levelIndex !== level.index)
          .map((s) => s.channel),
      ],
      footprints: layout.buildings,
      wallSegments: wallSegments.get(level.id),
    }),
  );
}

module.exports = {
  createAreas,
  segmentWalkableAcross,
  wallRectangle,
  BUCKET_CELL_M,
  SAME_SPLIT,
};
