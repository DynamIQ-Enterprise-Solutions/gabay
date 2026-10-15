// A level's walkable area as GeoJSON for A2′'s preview route (spec/P0-03.md r4 AC-124; plan/FF-3-prime-A1.md 1.0
// DC-A3): traced by marching squares over walkable.js's own point test, so the preview and the graph read one
// derivation. The graph never reads this trace.
//
// The samples lie on a square grid of TRACE_CELL_M anchored at the venue frame's origin, so every lattice node
// (a multiple of publish.nodeSpacingM, 1.5 m = 6 cells) is a sample. A contour runs through the middle of each cell
// edge whose two samples differ, so every walkable sample lies inside the traced area and every blocked sample
// outside it, each half a cell from the line. Where a cell's diagonal corners alone are walkable (a saddle), the
// cell's centre is tested to decide whether the two join. Rings are oriented with the walkable side on the left
// (outer rings counter-clockwise in x and z, holes clockwise: RFC 7946's right-hand rule) and returned as one
// MultiPolygon in venue-frame metres; a level with no walkable sample gives no polygon.
'use strict';

const planar = require('./geometry/planar');

/** The trace's grid, metres: office section 11's raster cell (DC-A3). */
const TRACE_CELL_M = 0.25;

// Point keys on the doubled grid (edge midpoints are half-cells): exact integers for |coordinate| below 2^20 cells.
const KEY_OFFSET = 2 ** 21;
const KEY_SPAN = 2 ** 22;
const keyOf = (x2, z2) => (x2 + KEY_OFFSET) * KEY_SPAN + (z2 + KEY_OFFSET);

/**
 * The cell's corners in counter-clockwise order (x across, z down, read as x and y) and the edge after each:
 * [corner di, corner dj, the midpoint after it on the doubled grid as dx2, dz2].
 */
const CORNERS = Object.freeze([
  [0, 0, 1, 0], // top-left, then the top edge's middle
  [1, 0, 2, 1], // top-right, then the right edge's middle
  [1, 1, 1, 2], // bottom-right, then the bottom edge's middle
  [0, 1, 0, 1], // bottom-left, then the left edge's middle
]);

/** Removes every point that lies on the straight line between its neighbours (doubled-grid integers: exact). */
function simplify(ring) {
  const out = [];
  const n = ring.length;
  for (let k = 0; k < n; k += 1) {
    const [px, pz] = ring[(k + n - 1) % n];
    const [x, z] = ring[k];
    const [qx, qz] = ring[(k + 1) % n];
    if ((x - px) * (qz - z) - (z - pz) * (qx - x) !== 0) out.push(ring[k]);
  }
  return out;
}

/**
 * @param {object} area  walkable.js's level area
 * @returns {{ type: 'MultiPolygon', coordinates: number[][][][] }}
 */
function walkableAreaGeoJson(area) {
  const c = TRACE_CELL_M;
  const { x0, z0, x1, z1 } = area.rect;
  // One sample beyond the rectangle on every side, so every contour closes.
  const i0 = Math.ceil(x0 / c - 1e-9) - 1;
  const i1 = Math.floor(x1 / c + 1e-9) + 1;
  const j0 = Math.ceil(z0 / c - 1e-9) - 1;
  const j1 = Math.floor(z1 / c + 1e-9) + 1;
  const width = i1 - i0 + 1;
  const height = j1 - j0 + 1;
  const walk = new Uint8Array(width * height);
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      walk[j * width + i] = area.pointWalkable((i0 + i) * c, (j0 + j) * c) ? 1 : 0;
    }
  }
  const at = (i, j) => walk[j * width + i];

  // Segments, each from a midpoint where the walkable side is left behind to the one where it starts again.
  const starts = [];
  const next = new Map();
  for (let j = 0; j + 1 < height; j += 1) {
    for (let i = 0; i + 1 < width; i += 1) {
      const corner = CORNERS.map(([di, dj]) => at(i + di, j + dj));
      const crossings = [];
      for (let k = 0; k < 4; k += 1) {
        if (corner[k] === corner[(k + 1) % 4]) continue;
        const [, , dx2, dz2] = CORNERS[k];
        crossings.push({ leaves: corner[k] === 1, x2: 2 * (i0 + i) + dx2, z2: 2 * (j0 + j) + dz2 });
      }
      if (crossings.length === 0) continue;
      const centreWalkable =
        crossings.length === 4 && area.pointWalkable((i0 + i + 0.5) * c, (j0 + j + 0.5) * c);
      for (let k = 0; k < crossings.length; k += 1) {
        if (!crossings[k].leaves) continue;
        // The walkable side is left at crossing k. It starts again at the next crossing round the cell when the two
        // walkable corners join through the centre, else at the one before.
        const step = crossings.length === 4 && !centreWalkable ? crossings.length - 1 : 1;
        const to = crossings[(k + step) % crossings.length];
        const from = crossings[k];
        const key = keyOf(from.x2, from.z2);
        starts.push(key);
        next.set(key, { x2: to.x2, z2: to.z2, from });
      }
    }
  }

  const rings = [];
  const used = new Set();
  for (const start of starts) {
    if (used.has(start)) continue;
    const ring = [];
    let key = start;
    while (!used.has(key)) {
      used.add(key);
      const segment = next.get(key);
      ring.push([segment.from.x2, segment.from.z2]);
      key = keyOf(segment.x2, segment.z2);
    }
    const simple = simplify(ring);
    if (simple.length >= 3) rings.push(simple.map(([x2, z2]) => [(x2 * c) / 2, (z2 * c) / 2]));
  }

  const outers = [];
  const holes = [];
  for (const ring of rings) (planar.ringArea2(ring) > 0 ? outers : holes).push(ring);
  const polygons = outers.map((ring) => ({ ring, area: planar.ringArea2(ring), holes: [] }));
  for (const hole of holes) {
    let best = null;
    for (const polygon of polygons) {
      if (planar.pointInRing(hole[0][0], hole[0][1], polygon.ring) === 'outside') continue;
      if (!best || polygon.area < best.area) best = polygon;
    }
    if (best) best.holes.push(hole);
  }
  const closed = (ring) => [...ring, ring[0]];
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((p) => [closed(p.ring), ...p.holes.map(closed)]),
  };
}

module.exports = { walkableAreaGeoJson, TRACE_CELL_M };
