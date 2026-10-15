// The engine's findings (spec/P0-03.md r4 AC-107, AC-115; DC-25; plan/FF-3-prime-A1.md 1.0 DC-A11): one shape for
// every finding, { kind, severity, message, levelId, levelName, element, at, segment, path, params } (A1's issue
// shape with message, levelName and path added). A blocking finding refuses a publish; a warning never does. The
// message is plain English for the manual and the command line, from one kind-to-English table (DC-A11); the screen
// words each kind from ARB (DC-P9). Findings come back in AC-115's order, so one snapshot always gives one list.
//
// A1′a raises only the graph's own warnings, in section 3.14.8's spellings. The kinds join closed-sets.json as the
// sets PublishBlockingKind and PublishWarningKind in A1′b (plan step 11, with `npm run gen:closed-sets`), which then
// become this file's one source of every kind, its severity and its order; until then A1′a's three are listed here.
'use strict';

const SEVERITY = Object.freeze({ BLOCKING: 'blocking', WARNING: 'warning' });

/** A1′a's warning kinds, in section 3.14.8's order (AC-115 sorts by it). */
const WARNING_KINDS = Object.freeze(['WALL_CROSSING', 'NO_ENTRANCE', 'CONNECTOR_OFF_WALKWAY']);
const KIND = Object.freeze(Object.fromEntries(WARNING_KINDS.map((k) => [k, k])));

/** Each kind's English message (DC-A11). */
const MESSAGES = Object.freeze({
  WALL_CROSSING: 'A walkway drawn by hand crosses a wall here',
  NO_ENTRANCE:
    "No entrance is marked: reachability is checked from the middle of the lowest level's bottom edge",
  CONNECTOR_OFF_WALKWAY: 'This landing does not join the walkway',
});

const KIND_ORDER = new Map(WARNING_KINDS.map((kind, i) => [kind, i]));

/**
 * A collector for one analysis: add() builds each finding; list() returns them all in AC-115's order: blocking
 * first, then the kind's position, then the level's order in the document, then the element's (`order`, a list of
 * numbers), then x, then z. A finding with no level or element comes before those with one.
 */
function createFindings() {
  const entries = [];
  return {
    /**
     * @param {string} kind
     * @param {{ level?: object, element?: object, at?: object, segment?: object[], path?: string,
     *           params?: object, order?: number[] }} fields  `level` is layout.js's level
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
      } = {},
    ) {
      if (!KIND_ORDER.has(kind)) throw new Error(`publish engine: ${kind} is not a finding kind`);
      entries.push({
        order: [level === null ? -1 : level.index, ...order],
        finding: {
          kind,
          severity: SEVERITY.WARNING,
          message: MESSAGES[kind],
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

module.exports = { createFindings, KIND };
