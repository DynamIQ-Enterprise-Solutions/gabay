// Test support shared by the venueMap.*.test.js files. Not a test file.
//
//   validate(doc, ctx?)            validateMap with the default context (built once through the module's shapers)
//   assertOneProblemAt(res, path)  refused, exactly one problem, total 1, and it starts "<path>: "
//   assertProblemAt(res, path)     refused, and at least one problem is at or inside `path`
//   clone, setAt, unsetAt          path edits on a document: `levels[1].items[0].w`
'use strict';

const assert = require('node:assert/strict');
const b = require('./mapBuilder');

let cachedContext;
const context = () => (cachedContext ??= b.makeContext());
const validate = (doc, ctx = context()) => b.vm().validateMap(doc, ctx);
const clone = (v) => structuredClone(v);

const tokens = (path) => path.match(/[^.[\]]+/g) ?? [];

function parentAndKey(root, path) {
  const t = tokens(path);
  let node = root;
  for (const k of t.slice(0, -1)) node = node[k];
  return [node, t[t.length - 1]];
}

function setAt(root, path, value) {
  const [node, key] = parentAndKey(root, path);
  node[key] = value;
}

function unsetAt(root, path) {
  const [node, key] = parentAndKey(root, path);
  delete node[key];
}

function assertOneProblemAt(res, path, label = path) {
  assert.equal(res.ok, false, `${label}: must be refused`);
  assert.equal(
    res.problems.length,
    1,
    `${label}: exactly one problem, got ${JSON.stringify(res.problems)}`,
  );
  assert.equal(res.total, 1, `${label}: total`);
  assert.ok(
    res.problems[0].startsWith(`${path}:`),
    `${label}: the problem names the path: ${res.problems[0]}`,
  );
  assert.ok(res.problems[0].length > path.length + 2, `${label}: a message follows the path`);
}

function assertProblemAt(res, path, label = path) {
  assert.equal(res.ok, false, `${label}: must be refused`);
  assert.ok(
    b.problemsAt(res, path).length >= 1,
    `${label}: a problem at ${path}: ${JSON.stringify(res.problems)}`,
  );
}

module.exports = {
  context,
  validate,
  clone,
  setAt,
  unsetAt,
  assertOneProblemAt,
  assertProblemAt,
};
