// The publish engine's problems and warnings (spec/P0-03.md r2 AC-2, DC-1, DC-11; plan/FF-3-publish-engine.md 1.0
// §3, DC-P9): one shape for both, { kind, severity, levelId, element, at, segment, params }. The kind comes from a
// closed set in the constants file (EC-36): a problem refuses the publish, a warning never does. The screen words
// each kind from ARB; the API adds an English message.
'use strict';

const { closedSet } = require('../../config/closedSets');

const PROBLEM_KINDS = new Set(closedSet('PublishProblemKind'));
const WARNING_KINDS = new Set(closedSet('PublishWarningKind'));

/**
 * @typedef {{ table: string, id: number, name: string | null }} ElementRef
 * @typedef {{ levelId?: number | null, element?: ElementRef | null, at?: { x: number, y: number } | null,
 *             segment?: number[][] | null, params?: object }} IssueFields
 */

function issue(severity, kind, fields = {}) {
  return {
    kind,
    severity,
    levelId: fields.levelId ?? null,
    element: fields.element ?? null,
    at: fields.at ?? null,
    segment: fields.segment ?? null,
    params: fields.params ?? {},
  };
}

/** A collector that every check writes into; it never stops at the first problem (DC-1). */
function createIssues() {
  const problems = [];
  const warnings = [];
  return {
    problems,
    warnings,
    /** @param {string} kind  @param {IssueFields} [fields] */
    problem(kind, fields) {
      if (!PROBLEM_KINDS.has(kind))
        throw new Error(`publish engine: ${kind} is not a PublishProblemKind`);
      problems.push(issue('problem', kind, fields));
    },
    /** @param {string} kind  @param {IssueFields} [fields] */
    warning(kind, fields) {
      if (!WARNING_KINDS.has(kind))
        throw new Error(`publish engine: ${kind} is not a PublishWarningKind`);
      warnings.push(issue('warning', kind, fields));
    },
  };
}

module.exports = { createIssues };
