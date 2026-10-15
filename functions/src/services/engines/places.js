// Every place with its door nodes (spec/P0-03.md r4 AC-99; P0-06 AC-76 and DC-36: what the nearest reachable point
// needs). A place is an active store (reached through its unit's doors), an amenity, a transit point or an anchor
// (r4's "Place", section 3.14.0). Each carries its id, kind, level, name and door nodes: a store's are the door nodes
// of the doors its unit lists (none when it lists none); an amenity or anchor reached through a non-walkable unit has
// that unit's (AC-95, A1's choice 9); any other point place has its own node. A door node with no edges is listed
// like any other, never dropped and never moved.
//
// For the checks (AC-110) each place also carries its arrival nodes (its unit's doors and its parents' doors, EC-29:
// a section with no reachable door of its own is reached through its parent's; or its own node), the units of that
// chain by `serial` (never a passage for itself, AC-39), whether reachability checks it (AC-88: not an amenity of an
// evacuation type until P3-02), and where a finding about it is shown.
'use strict';

const planar = require('./geometry/planar');
const { closedSet } = require('../../config/closedSets');
const { elementRef, at, documentRank } = require('./elements');

/** The amenity types reachability leaves out until P3-02 (AC-88; L87; R29): the constants file's set. */
const EVACUATION_AMENITY_TYPES = new Set(closedSet('EvacuationAmenityType'));

/**
 * The stores the package carries one place for: active, keyed to a unit of the layout, and the lowest OccupantId
 * where two share a unit (DC-27). checks/rows.js names the stores left out (AC-114).
 */
function placedStores(stores, unitById) {
  const byUnit = new Map();
  for (const store of stores) {
    if (!store.isActive || !unitById.has(store.unitKey)) continue;
    const held = byUnit.get(store.unitKey);
    if (!held || store.occupantId < held.occupantId) byUnit.set(store.unitKey, store);
  }
  return byUnit;
}

/** The unit and its parents, nearest first (the validator refuses a cycle, OA-1 AC-4; guarded all the same). */
function unitChain(unit, unitById) {
  const chain = [];
  const seen = new Set();
  for (let u = unit; u && !seen.has(u.id); u = u.parent === null ? null : unitById.get(u.parent)) {
    seen.add(u.id);
    chain.push(u);
  }
  return chain;
}

/**
 * @param {object} layout  readLayout's result
 * @param {object[]} stores  the snapshot's store rows
 * @param {object} graph  generateGraph's result
 * @returns {object[]}  stores in their units' document order, then the amenities, transit points and anchors of each
 *   level in document order: { id, kind, levelId, name, doorNodes, storeId, store, levelIndex, element, order, at,
 *   arrival, units, checked }
 */
function listPlaces(layout, stores, graph) {
  const { csr } = graph;
  const doorNodesOf = (unit) =>
    unit.doors.filter((id) => graph.doorNode.has(id)).map((id) => graph.doorNode.get(id));
  const nodePoint = (v) => [csr.x[v], csr.z[v]];
  const throughUnit = (unit) => {
    const chain = unitChain(unit, layout.unitById);
    return {
      arrival: [...new Set(chain.flatMap(doorNodesOf))],
      units: new Set(chain.map((u) => u.serial)),
    };
  };
  const places = [];
  const placed = placedStores(stores, layout.unitById);
  for (const level of layout.levels) {
    for (const unit of level.units) {
      const store = placed.get(unit.id);
      if (!store) continue;
      const doorNodes = doorNodesOf(unit);
      places.push({
        id: unit.id,
        kind: 'store',
        levelId: level.id,
        name: store.name,
        doorNodes,
        storeId: unit.id,
        store,
        levelIndex: level.index,
        element: { kind: 'store', id: unit.id, name: store.name },
        order: [documentRank('unit'), unit.index],
        at: at(doorNodes.length > 0 ? nodePoint(doorNodes[0]) : planar.ringCentroid(unit.ring)),
        checked: true,
        ...throughUnit(unit),
      });
    }
  }
  for (const level of layout.levels) {
    for (const point of [...level.amenities, ...level.transitPoints, ...level.anchors]) {
      const key = `${point.kind}:${point.id}`;
      const own = graph.placePoint.get(key);
      const unit = own === undefined ? layout.unitById.get(graph.placeUnit.get(key)) : null;
      const reached = unit ? throughUnit(unit) : { arrival: [own], units: new Set() };
      places.push({
        id: point.id,
        kind: point.kind,
        levelId: level.id,
        name: point.name,
        doorNodes: unit ? doorNodesOf(unit) : [own],
        storeId: null,
        store: null,
        levelIndex: level.index,
        element: elementRef(point.kind, point),
        order: [documentRank(point.kind), point.index],
        at: at(point.at),
        checked: !(point.kind === 'amenity' && EVACUATION_AMENITY_TYPES.has(point.typeCode)),
        ...reached,
      });
    }
  }
  return places;
}

module.exports = { listPlaces, placedStores };
