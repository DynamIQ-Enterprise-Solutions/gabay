// How a finding names a document element, where it shows it, and where it sorts (spec/P0-03.md r4 AC-107, AC-115;
// DC-11 kept: every finding carries an element and/or a location, so the editor can open it). `element` is
// { kind, id, name }, its kind a document element kind (building, level, wall, opening, unit, item, correction,
// amenity, transitPoint, anchor, connector), `store` (its id the unit key) or `beacon`; a position is { x, z } in
// venue-frame metres.
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');

/** { kind, id, name } for a finding's element; an element with no name (a wall, a correction) has null. */
const elementRef = (kind, element) => ({ kind, id: element.id, name: element.name ?? null });

/** A [x, z] point as { x, z }; + 0 keeps a canonical zero. */
const at = ([x, z]) => ({ x: x + 0, z: z + 0 });

/** A segment [[x, z], [x, z]] as two { x, z }. */
const segmentOf = ([p, q]) => [at(p), at(q)];

const LEVEL_FIELDS = Object.keys(VENUE_MAP_SCHEMA.kinds.level.fields);
/** The array of a level each element kind lives in (OA-1 section 2.5). */
const ARRAY_OF = Object.freeze({
  wall: 'walls',
  opening: 'openings',
  unit: 'units',
  item: 'items',
  correction: 'corrections',
  amenity: 'amenities',
  transitPoint: 'transitPoints',
  anchor: 'anchors',
});

/** A level element kind's place in document order: its array's place among the level's fields (AC-115). */
const documentRank = (kind) => LEVEL_FIELDS.indexOf(ARRAY_OF[kind]);
/** Connectors follow every level's own arrays in the document (OA-1 section 2.1). */
const CONNECTOR_RANK = LEVEL_FIELDS.length;
/** Store and beacon rows are not in the document; their findings follow its elements, by row id. */
const ROW_RANK = CONNECTOR_RANK + 1;

module.exports = { elementRef, at, segmentOf, ARRAY_OF, documentRank, CONNECTOR_RANK, ROW_RANK };
