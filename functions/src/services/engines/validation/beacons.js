// AC-17 (invariant 9; ruled D9; EC-30). Among the venue's active beacons: no two share (ProximityUuid, Major, Minor),
// and every beacon's ProximityUuid is its tenant's. Either fault refuses the publish and shows every beacon
// concerned. The database enforces both already (UQ_Beacon_Identity, FK_Beacon_Namespace): this is defence in depth
// on the venue's own beacons (DC-P13). D9's identifier range per level is not checked yet (ruled D9).
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { ref, at } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');

function checkBeacons(venue, issues) {
  const active = venue.beacons.filter((b) => b.isActive);
  const identity = (b) => `${b.uuid}|${b.major}|${b.minor}`;
  const sharing = new Map();
  for (const b of active) {
    if (!sharing.has(identity(b))) sharing.set(identity(b), []);
    sharing.get(identity(b)).push(b.id);
  }
  for (const b of active) {
    const group = sharing.get(identity(b));
    if (group.length < 2) continue;
    issues.problem(PROBLEM.BEACON_DUPLICATE, {
      element: ref('Beacon', b, null),
      levelId: b.levelId,
      at: at(b.x, b.y),
      params: {
        uuid: b.uuid,
        major: b.major,
        minor: b.minor,
        otherBeaconIds: group.filter((id) => id !== b.id),
      },
    });
  }
  for (const b of active) {
    if (b.uuid === venue.beaconProximityUuid) continue;
    issues.problem(PROBLEM.BEACON_NAMESPACE, {
      element: ref('Beacon', b, null),
      levelId: b.levelId,
      at: at(b.x, b.y),
      params: { uuid: b.uuid },
    });
  }
}

module.exports = { checkBeacons };
