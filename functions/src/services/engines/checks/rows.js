// Warnings from the rows (spec/P0-03.md r4 AC-114; re-plan section 1.2; P0-11 G7; DC-27): the stores and beacons the
// package leaves out, each named.
//   - STORE_WITHOUT_UNIT: an active store whose UnitKey names no unit of the layout (removed, or an element of
//     another kind);
//   - STORE_DUPLICATE_UNIT: a second active store on one unit; the lowest OccupantId is kept (places.js), and each
//     other one is named;
//   - BEACON_LEVEL_MISSING: an active beacon whose LevelKey names no level of the layout.
// A row check: it runs on an invalid layout too (AC-115), reading the layout's levels and units through
// layoutKeys.js.
'use strict';

const { KIND } = require('../findings');
const { ROW_RANK } = require('../elements');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} read  readSnapshot's result (stores, beacons)
 * @param {object} keys  layoutKeys(layout)
 */
function checkRows(findings, read, keys) {
  const stores = read.stores.filter((s) => s.isActive).sort((p, q) => p.occupantId - q.occupantId);
  const storeRef = (s) => ({ kind: 'store', id: s.unitKey, name: s.name });
  const kept = new Map();
  for (const store of stores) {
    const level = keys.unitLevel.get(store.unitKey);
    if (level === undefined) {
      findings.add(KIND.STORE_WITHOUT_UNIT, {
        element: storeRef(store),
        order: [ROW_RANK, store.occupantId],
        params: { occupantId: store.occupantId, unitKey: store.unitKey },
      });
      continue;
    }
    const first = kept.get(store.unitKey);
    if (first === undefined) {
      kept.set(store.unitKey, store);
      continue;
    }
    findings.add(KIND.STORE_DUPLICATE_UNIT, {
      level,
      element: storeRef(store),
      order: [ROW_RANK, store.occupantId],
      params: {
        occupantId: store.occupantId,
        unitKey: store.unitKey,
        keptOccupantId: first.occupantId,
      },
    });
  }
  for (const beacon of read.beacons) {
    if (!beacon.isActive || keys.levelById.has(beacon.levelKey)) continue;
    findings.add(KIND.BEACON_LEVEL_MISSING, {
      element: { kind: 'beacon', id: String(beacon.beaconId), name: null },
      at: { x: beacon.x + 0, z: beacon.y + 0 },
      order: [ROW_RANK, beacon.beaconId],
      params: { levelKey: beacon.levelKey },
    });
  }
}

module.exports = { checkRows };
