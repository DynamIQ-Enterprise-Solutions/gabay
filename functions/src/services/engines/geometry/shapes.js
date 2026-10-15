// Shapes the publish engine builds from the venue map document (spec/P0-03.md r4 AC-90 (c); DC-P4: no geometry
// library). The document's polygons are already readable: OA-1's validator refuses an unclosed ring, too few points
// or a wrong type (OA-1 AC-8, AC-16), so A1's GeoJSON readers are gone (r4 withdrew AC-18). What stays: an item's
// box outline, and the self-crossing test a polygon may still fail (OA-1 DC-16, EC-27; AC-112's warning).
'use strict';

const { segmentsCross } = require('./planar');

/** True when two edges of the ring that are not neighbours pass through each other. */
function ringSelfCrosses(ring) {
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // neighbours through the closing edge
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentsCross(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) return true;
    }
  }
  return false;
}

/**
 * A box's outline as a polygon (one ring): centre (cx, cy), width along its own x, depth along its own y, turned by
 * rotationDeg with the standard rotation matrix. In the venue frame (x across, z down the plan) that turn is
 * clockwise as seen on the plan, the document's convention for every angle (OA-1 section 2).
 */
function boxPolygon(cx, cy, width, depth, rotationDeg) {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corner = (u, v) => [cx + u * cos - v * sin, cy + u * sin + v * cos];
  const hw = width / 2;
  const hd = depth / 2;
  return [[corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)]];
}

module.exports = { ringSelfCrosses, boxPolygon };
