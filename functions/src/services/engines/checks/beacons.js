// The beacon checks (spec/P0-03.md r4 AC-109; L170 Q2; r3 AC-17 and AC-87, R30; ruled 2026-10-14 Q2 (a); all
// blocking). Only active beacons count, and only this tenant's: the snapshot holds this venue's beacons and, for the
// shared-Major check, the (venue, level, Major) of the tenant's other venues' active beacons; another tenant's are
// never read (rule 2; invariant 13).
//   - BEACON_DUPLICATE: two or more beacons share (ProximityUuid, Major, Minor); one finding per identity;
//   - BEACON_NAMESPACE: a beacon's ProximityUuid is not the tenant's BeaconProximityUuid; one per beacon;
//   - BEACON_MIXED_MAJOR: one level's beacons use two or more Majors; one per level, naming them;
//   - BEACON_MAJOR_SHARED: a beacon on a level of this venue has the Major of a beacon on another level, of this venue
//     (one finding per pair of levels, on the first) or of another venue of the tenant (one per other level).
// A beacon whose LevelKey names no level of the layout is left out of the two Major checks (it gets AC-114's
// BEACON_LEVEL_MISSING). The database's UQ_Beacon_Identity and FK_Beacon_Namespace already stop the first two in
// stored data, so they are tested on in-memory rows (r3 AC-17's reason). UUIDs are compared without regard to case.
// A beacon's position is its row's x and y, the venue frame's x and z. A row check: it runs on an invalid layout too
// (AC-115), reading the layout's levels through layoutKeys.js.
'use strict';

const { KIND } = require('../findings');
const { ROW_RANK } = require('../elements');

/** Text order by code unit (the same on every machine, unlike a locale's). */
const byText = (p, q) => (p < q ? -1 : p > q ? 1 : 0);
const beaconRef = (beacon) => ({ kind: 'beacon', id: String(beacon.beaconId), name: null });
const beaconAt = (beacon) => ({ x: beacon.x + 0, z: beacon.y + 0 });
const sameUuid = (a, b) => a !== null && b !== null && a.toLowerCase() === b.toLowerCase();

/** Each Major's beacons on one level, by Major, lowest first. */
function majorsOf(beacons) {
  const byMajor = new Map();
  for (const b of beacons) {
    if (!byMajor.has(b.major)) byMajor.set(b.major, []);
    byMajor.get(b.major).push(b);
  }
  return new Map([...byMajor].sort((p, q) => p[0] - q[0]));
}

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} read  readSnapshot's result (beacons, otherVenueBeacons, tenant)
 * @param {object} keys  layoutKeys(layout)
 */
function checkBeacons(findings, read, keys) {
  const active = read.beacons.filter((b) => b.isActive).sort((p, q) => p.beaconId - q.beaconId);
  const levelOf = (b) => keys.levelById.get(b.levelKey) ?? null;
  const fields = (b, params) => ({
    level: levelOf(b),
    element: beaconRef(b),
    at: beaconAt(b),
    order: [ROW_RANK, b.beaconId],
    params,
  });

  const byIdentity = new Map();
  for (const b of active) {
    const key = `${b.proximityUuid.toLowerCase()}|${b.major}|${b.minor}`;
    if (!byIdentity.has(key)) byIdentity.set(key, []);
    byIdentity.get(key).push(b);
  }
  for (const group of byIdentity.values()) {
    if (group.length < 2) continue;
    const [first] = group;
    findings.add(
      KIND.BEACON_DUPLICATE,
      fields(first, {
        beaconIds: group.map((b) => String(b.beaconId)),
        proximityUuid: first.proximityUuid,
        major: first.major,
        minor: first.minor,
      }),
    );
  }

  const tenantUuid = read.tenant.beaconProximityUuid;
  for (const b of active) {
    if (!sameUuid(b.proximityUuid, tenantUuid)) {
      findings.add(KIND.BEACON_NAMESPACE, fields(b, { proximityUuid: b.proximityUuid }));
    }
  }

  // The Major checks: this venue's beacons on a level of the layout, by level in document order.
  const onLevel = keys.levels.map((level) => ({
    level,
    majors: majorsOf(active.filter((b) => b.levelKey === level.id)),
  }));
  for (const { level, majors } of onLevel) {
    if (majors.size < 2) continue;
    const firsts = [...majors.values()].map((group) => group[0]);
    findings.add(KIND.BEACON_MIXED_MAJOR, {
      ...fields(firsts[0], {
        majors: [...majors.keys()],
        beaconIds: firsts.map((b) => String(b.beaconId)),
      }),
      level,
    });
  }
  for (let p = 0; p < onLevel.length; p += 1) {
    const { level, majors } = onLevel[p];
    for (const [major, group] of majors) {
      const shared = (otherLevel, otherVenue) =>
        findings.add(KIND.BEACON_MAJOR_SHARED, {
          ...fields(group[0], {
            major,
            otherLevelId: otherLevel.id,
            otherLevelName: otherLevel.name,
            otherVenueId: otherVenue?.venueId ?? null,
            otherVenueName: otherVenue?.venueName ?? null,
          }),
          level,
        });
      for (let q = p + 1; q < onLevel.length; q += 1) {
        if (onLevel[q].majors.has(major)) shared(onLevel[q].level, null);
      }
      const seen = new Set();
      const others = read.otherVenueBeacons
        .filter((o) => o.major === major)
        .sort((x, y) => x.venueId - y.venueId || byText(x.levelKey, y.levelKey));
      for (const other of others) {
        const key = `${other.venueId}|${other.levelKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        shared({ id: other.levelKey, name: null }, other);
      }
    }
  }
}

module.exports = { checkBeacons };
