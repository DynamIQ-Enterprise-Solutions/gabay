// Every place with its door nodes (spec/P0-03.md r4 AC-99; P0-06 AC-76 and DC-36: what the nearest reachable point
// needs). A place is an active store (reached through its unit's doors), an amenity, a transit point or an anchor
// (r4's "Place", section 3.14.0). Each carries its id, kind, level, name and door nodes: a store's are the door nodes
// of the doors its unit lists (none when it lists none); an amenity or anchor reached through a non-walkable unit has
// that unit's (AC-95, A1's choice 9); any other point place has its own node. A door node with no edges is listed
// like any other, never dropped and never moved.
'use strict';

/**
 * The stores the package carries one place for: active, keyed to a unit of the layout, and the lowest OccupantId
 * where two share a unit (DC-27). A1′b's checks name the stores left out (AC-114).
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

/**
 * @param {object} layout  readLayout's result
 * @param {object[]} stores  the snapshot's store rows
 * @param {object} graph  generateGraph's result
 * @returns {{ id: string, kind: string, levelId: string, name: string | null, doorNodes: number[] }[]}  stores in
 *   their units' document order, then the amenities, transit points and anchors of each level in document order
 */
function listPlaces(layout, stores, graph) {
  const doorNodesOf = (unit) =>
    unit.doors.filter((id) => graph.doorNode.has(id)).map((id) => graph.doorNode.get(id));
  const places = [];
  const placed = placedStores(stores, layout.unitById);
  for (const level of layout.levels) {
    for (const unit of level.units) {
      const store = placed.get(unit.id);
      if (!store) continue;
      places.push({
        id: unit.id,
        kind: 'store',
        levelId: level.id,
        name: store.name,
        doorNodes: doorNodesOf(unit),
      });
    }
  }
  for (const level of layout.levels) {
    for (const point of [...level.amenities, ...level.transitPoints, ...level.anchors]) {
      const key = `${point.kind}:${point.id}`;
      const doorNodes = graph.placePoint.has(key)
        ? [graph.placePoint.get(key)]
        : doorNodesOf(layout.unitById.get(graph.placeUnit.get(key)));
      places.push({
        id: point.id,
        kind: point.kind,
        levelId: level.id,
        name: point.name,
        doorNodes,
      });
    }
  }
  return places;
}

module.exports = { listPlaces, placedStores };
