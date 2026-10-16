// The engine's findings (spec/P0-03.md r4 AC-107, AC-115; section 3.14.8; DC-25; plan/FF-3-prime-A1.md 1.0 DC-A11):
// one shape for every finding, { kind, severity, message, levelId, levelName, element, at, segment, path, params }
// (A1's issue shape with message, levelName and path added). A blocking finding refuses a publish; a warning never
// does. The kinds are the constants file's two sets, PublishBlockingKind and PublishWarningKind (each with its
// authority, EC-36), so a kind's severity is the set it is in and its place in the order is its place in that set
// (the blocking set first). The message is plain English for the manual and the command line, from one table here
// (DC-A11); the screen words each kind from ARB by `kind` and `params` (DC-P9, AC-128).
'use strict';

const { closedSet, codesOf } = require('../../config/closedSets');

const SEVERITY = Object.freeze({ BLOCKING: 'blocking', WARNING: 'warning' });

const BLOCKING_KINDS = closedSet('PublishBlockingKind');
const WARNING_KINDS = closedSet('PublishWarningKind');
const ALL_KINDS = Object.freeze([...BLOCKING_KINDS, ...WARNING_KINDS]);
/** Every kind as { KIND: 'KIND' }, so a check names a kind the constants file holds. */
const KIND = Object.freeze(Object.fromEntries(ALL_KINDS.map((k) => [k, k])));
const KIND_ORDER = new Map(ALL_KINDS.map((kind, i) => [kind, i]));
const SEVERITY_OF = new Map([
  ...BLOCKING_KINDS.map((k) => [k, SEVERITY.BLOCKING]),
  ...WARNING_KINDS.map((k) => [k, SEVERITY.WARNING]),
]);

/** Each kind's English message (DC-A11); the details are in `params`. */
const MESSAGES = Object.freeze({
  INVALID_DOCUMENT: 'The map is not valid',
  NOTHING_TO_PUBLISH: 'Nothing to publish: nothing is drawn yet',
  TENANT_MISMATCH: "This code is not one of this mall's",
  BEACON_DUPLICATE: 'Two or more beacons share one identity (UUID, Major and Minor)',
  BEACON_NAMESPACE: "This beacon's UUID is not this mall's beacon UUID",
  BEACON_MIXED_MAJOR: "This level's beacons use more than one Major",
  BEACON_MAJOR_SHARED: "This level's Major is also used on another level",
  NO_BEACONS_ON_LEVEL: 'No beacons on this level',
  DOOR_WIDTH_UNMEASURED: "This door's clear width is not measured",
  GRAPH_LARGE: 'The walkway graph has more nodes than the size it is tuned for',
  PACKAGE_LARGE: 'The map package is larger than the size it is tuned for',
  UNREVIEWED: 'This element is marked for review',
  UNREACHABLE: 'No route reaches this place and leads back to an entrance',
  ORPHAN: 'This walkway is not joined to any entrance',
  WALL_CROSSING: 'A walkway drawn by hand crosses a wall here',
  NO_ENTRANCE:
    "No entrance is marked: reachability is checked from the middle of the lowest level's bottom edge",
  CONNECTOR_OFF_WALKWAY: 'This landing does not join the walkway',
  CONNECTOR_NO_RISE:
    'This connector joins levels of the same elevation, so it costs only its base time',
  OUTSIDE_BOUNDARY: 'This element lies outside the site boundary',
  SHAPE_SELF_CROSSING: "This shape's outline crosses itself",
  STORE_WITHOUT_UNIT: 'This store is on no unit of the map, so it is left out',
  STORE_DUPLICATE_UNIT: 'Another store is already on this unit, so this one is left out',
  BEACON_LEVEL_MISSING: 'This beacon is on a level the map no longer has, so it is left out',
});

/**
 * Why a place is unreachable: AC-110's `params.reason`, the constants file's UnreachableReason set (A1′b review I2),
 * which the screen's wording reads (AC-128).
 */
const REASON_CODES = codesOf('UnreachableReason');
const UNREACHABLE_REASON = Object.freeze({
  NO_DOOR: REASON_CODES.no_door,
  CUT_OFF: REASON_CODES.cut_off,
  NO_WAY_BACK: REASON_CODES.no_way_back,
});

const REASON_MESSAGES = Object.freeze({
  [UNREACHABLE_REASON.NO_DOOR]: 'This place has no door, so no route reaches it',
  [UNREACHABLE_REASON.CUT_OFF]: 'No route reaches this place from an entrance',
  [UNREACHABLE_REASON.NO_WAY_BACK]:
    'This place can be reached, but no route leads back from it to an entrance',
});

/**
 * The message of one finding: the kind's, with the validator's own words for INVALID_DOCUMENT (AC-108) and the
 * reason's for UNREACHABLE (AC-110).
 */
function messageOf(kind, params) {
  if (kind === KIND.INVALID_DOCUMENT) return `${MESSAGES[kind]}: ${params.problem}`;
  if (kind === KIND.UNREACHABLE) return REASON_MESSAGES[params.reason] ?? MESSAGES[kind];
  return MESSAGES[kind];
}

const isBlocking = (finding) => finding.severity === SEVERITY.BLOCKING;

/**
 * A collector for one analysis: add() builds each finding; list() returns them all in AC-115's order: blocking
 * first, then the kind's position in the constants file, then the level's order in the document, then the
 * element's (`order`, a list of numbers), then x, then z. A finding with no level or element comes before those with
 * one. `sortKey` replaces the level and element part where a check knows the document position better (the
 * validator's own order for INVALID_DOCUMENT).
 */
function createFindings() {
  const entries = [];
  return {
    /**
     * @param {string} kind
     * @param {{ level?: { index, id, name }, element?: object, at?: object, segment?: object[], path?: string,
     *           params?: object, order?: number[], sortKey?: number[] }} fields
     */
    add(
      kind,
      {
        level = null,
        element = null,
        at = null,
        segment = null,
        path = null,
        params = {},
        order = [],
        sortKey = null,
      } = {},
    ) {
      if (!KIND_ORDER.has(kind)) throw new Error(`publish engine: ${kind} is not a finding kind`);
      entries.push({
        order: sortKey ?? [level === null ? -1 : level.index, ...order],
        finding: {
          kind,
          severity: SEVERITY_OF.get(kind),
          message: messageOf(kind, params),
          levelId: level === null ? null : level.id,
          levelName: level === null ? null : level.name,
          element,
          at,
          segment,
          path,
          params,
        },
      });
    },
    list() {
      const rank = (severity) => (severity === SEVERITY.BLOCKING ? 0 : 1);
      const byNumbers = (p, q) => {
        for (let i = 0; i < Math.max(p.length, q.length); i += 1) {
          const d = (p[i] ?? -1) - (q[i] ?? -1);
          if (d !== 0) return d;
        }
        return 0;
      };
      // No coordinate is negative (OA-1 section 2), so a missing one, read as -1, sorts first.
      const position = (f) => (f.at === null ? [] : [f.at.x, f.at.z]);
      return entries
        .map((entry, i) => ({ ...entry, i }))
        .sort(
          (p, q) =>
            rank(p.finding.severity) - rank(q.finding.severity) ||
            KIND_ORDER.get(p.finding.kind) - KIND_ORDER.get(q.finding.kind) ||
            byNumbers(p.order, q.order) ||
            byNumbers(position(p.finding), position(q.finding)) ||
            p.i - q.i,
        )
        .map((entry) => entry.finding);
    },
  };
}

module.exports = {
  createFindings,
  KIND,
  SEVERITY,
  MESSAGES,
  UNREACHABLE_REASON,
  messageOf,
  isBlocking,
};
