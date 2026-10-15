// How a finding names a document element and where it shows it (spec/P0-03.md r4 AC-107; DC-11 kept: every
// finding carries an element and/or a location, so the editor can open it). `element` is { kind, id, name }, its
// kind a document element kind (building, level, wall, opening, unit, item, correction, amenity, transitPoint,
// anchor, connector), `store` or `beacon`; a position is { x, z } in venue-frame metres.
'use strict';

/** { kind, id, name } for a finding's element; an element with no name (a wall, a correction) has null. */
const elementRef = (kind, element) => ({ kind, id: element.id, name: element.name ?? null });

/** A [x, z] point as { x, z }; + 0 keeps a canonical zero. */
const at = ([x, z]) => ({ x: x + 0, z: z + 0 });

/** A segment [[x, z], [x, z]] as two { x, z }. */
const segmentOf = ([p, q]) => [at(p), at(q)];

module.exports = { elementRef, at, segmentOf };
