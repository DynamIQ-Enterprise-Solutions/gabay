// raw-error-text, the server half (SEC-2 spec AC-49 to AC-53; EC-38; plan step 4): a bad sample for each refused form and
// a good sample for each allowed one, over throwaway trees. The Dart half is SEC-3's and has its own test file.
"use strict";

const test = require("../../test/timeout");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { lint, at, tree } = require("./helper");
const linter = require("../raw-error-text");

const NAME = "raw-error-text";
const RUN = path.resolve(__dirname, "..", "run.js");
const REPO = path.resolve(__dirname, "..", "..", "..");
const FILE = "functions/src/routes/x.js";

/** The violations of one source file placed at functions/src/routes/x.js. */
const check = (code) => lint(NAME, { [FILE]: `'use strict';\n${code}\n` });
const lines = (violations) => violations.map((v) => v.line);

/** `body` inside a catch clause: line 2 is `try {} catch (err) {`, the body's first line is 3. */
const inCatch = (body) =>
  `async function h(req, res) {\n  try { await go(); } catch (err) {\n    ${body}\n  }\n}`;

test("raw-error-text: the file has a server half and a Dart half, and the Dart half is a no-op until SEC-3", () => {
  assert.equal(typeof linter.serverHalf, "function");
  assert.equal(typeof linter.dartHalf, "function");
  assert.deepEqual(linter.dartHalf({}), []);
  assert.equal(linter.name, NAME);
});

// -------------------------------------------------------------------------------------------------- AC-49: the forms

for (const prop of [
  "message",
  "stack",
  "detail",
  "hint",
  "constraint",
  "table",
  "column",
  "schema",
  "where",
  "routine",
  "issues",
  "errors",
]) {
  test(`raw-error-text: err.${prop} in a response is refused`, () => {
    const found = check(
      inCatch(`res.status(500).json({ error: err.${prop} });`),
    );
    assert.deepEqual(at(found), [`${FILE}:4:${NAME}`]);
    assert.match(found[0].message, new RegExp(`err\\.${prop}`));
  });
}

test("raw-error-text: String(err), a template, JSON.stringify, concatenation, the bare variable and prettifyError are refused", () => {
  const bad = [
    "res.json({ error: String(err) });",
    "res.json({ error: `failed: ${err}` });",
    "res.json({ error: JSON.stringify(err) });",
    "res.json({ error: err + '' });",
    "res.json(err);",
    "res.status(500).send(err);",
    "res.end(err);",
    "res.write(err);",
    "res.json({ err });",
    "res.json({ error: z.prettifyError(err) });",
    "res.json({ error: z.flattenError(err) });",
    'res.json({ error: err["message"] });',
    "res.json({ error: err?.message });",
    "res.status(500).set('X', 'y').json({ error: err.message });",
  ];
  for (const sink of bad) {
    assert.equal(check(inCatch(sink)).length, 1, sink);
  }
});

test("raw-error-text: httpError(...) carrying the error is refused", () => {
  for (const sink of [
    "throw httpError(500, err.message);",
    "throw httpError(400, `bad: ${err.detail}`);",
    "throw httpError(500, String(err));",
  ]) {
    assert.equal(check(inCatch(sink)).length, 1, sink);
  }
});

test("raw-error-text: the error variable is a catch clause, a .catch callback or an Express error handler parameter", () => {
  assert.equal(
    check("go().catch((e) => res.json({ error: e.message }));").length,
    1,
  );
  assert.equal(
    check("go().catch(e => res.json({ error: e.message }));").length,
    1,
  );
  assert.equal(
    check("go().catch(function (e) { res.json({ error: e.stack }); });").length,
    1,
  );
  assert.equal(
    check(
      "function errorHandler(err, req, res, next) {\n  res.status(500).json({ error: err.message });\n}",
    ).length,
    1,
  );
  assert.equal(
    check(
      "const handler = (error, req, res, _next) => {\n  res.status(500).json({ error: error.message });\n};",
    ).length,
    1,
  );
  // A parameter that is not any of those is not an error variable (code that only passes it on, or compares codes).
  assert.deepEqual(
    check("parser(req, res, (err) => { res.json({ error: err.message }); });"),
    [],
  );
  assert.deepEqual(
    check("function f(err) { res.json({ error: err.message }); }"),
    [],
  );
});

test("raw-error-text: the body the error handler builds: the function it passes its error to is read (DC-38)", () => {
  const code = `function describeError(err) {
  return { status: 500, message: err.message };
}
function errorHandler(err, req, res, _next) {
  const { status, message } = describeError(err);
  res.status(status).json({ error: message });
}`;
  const found = check(code);
  assert.deepEqual(at(found), [`${FILE}:3:${NAME}`]);
  assert.match(found[0].message, /error handler builds/);
  // not the object literals of a function the handler does not pass its error to
  const unrelated = `function other(err) {\n  return { message: err.message };\n}\nfunction errorHandler(err, req, res, _next) {\n  res.status(500).json({ error: 'x' });\n}`;
  assert.deepEqual(check(unrelated), []);
});

// ------------------------------------------------------------------------------------------- what is allowed (EC-38)

test("raw-error-text: passing the error on, logging it and comparing codes are fine", () => {
  const good = [
    "next(err);",
    'req.log.error({ err }, "failed");',
    "if (err.code === '23505' && err.constraint === UNIQUE_CODE) { throw httpError(409, DUPLICATE_CODE); }",
    "res.status(err.httpStatus).json({ error: GENERIC });",
    "res.status(500).json({ error: 'Database unavailable' });",
    "throw duplicateCode(err);",
    "res.destroy(err);",
  ];
  for (const sink of good) assert.deepEqual(check(inCatch(sink)), [], sink);
});

test("raw-error-text: reading .message off a constant is fine, not an error variable (UPLOAD_ONE_IMAGE.message)", () => {
  assert.deepEqual(
    check(
      inCatch(
        "throw httpError(400, UPLOAD_ONE_IMAGE.message);\n    res.json({ error: CONSTANTS.message });",
      ),
    ),
    [],
  );
});

test("raw-error-text: a key that is named like the error variable is a key, not the variable", () => {
  assert.deepEqual(check(inCatch("res.json({ err: 'x' });")), []);
});

test("raw-error-text: a mention in a comment or a string is not a use", () => {
  const code = inCatch(
    "// res.json({ error: err.message });\n    res.json({ note: 'err.message is never shown' });",
  );
  assert.deepEqual(check(code), []);
});

// ------------------------------------------------------------------------------------------ AC-50: schema names in text

test("raw-error-text: gabay.<name> and constraint-style names in a response text are refused", () => {
  const bad = [
    "res.status(500).json({ error: 'insert into gabay.Venue failed' });",
    "throw httpError(409, 'duplicate key value violates UQ_Venue_Code');",
    "throw httpError(409, 'FK_Level_Venue');",
    "throw httpError(409, `PK_Role ${x}`);",
    "res.send('CK_Thing_Range');",
    "res.send('IX_AuditLog_Tenant and TR_X and UX_Y');",
  ];
  for (const sink of bad) assert.equal(check(sink).length, 1, sink);
});

test("raw-error-text: a table name alone and an ordinary message are fine", () => {
  const good = [
    "throw httpError(400, 'Level must be at least 1');",
    "res.status(404).json({ error: 'Not found' });",
    "throw httpError(409, 'A venue with this code already exists');",
    "const name = 'uq_venue_tenant_code';",
    "log.info('gabay.Venue loaded');",
  ];
  for (const sink of good) assert.deepEqual(check(sink), [], sink);
});

// -------------------------------------------------------------------------------------------- AC-51: the annotation

test("raw-error-text: // raw-error: <reason> above the line sanctions it; an empty reason is itself a violation", () => {
  const ok = inCatch(
    "// raw-error: shown only for an httpError below 500\n    res.json({ error: err.message });",
  );
  assert.deepEqual(check(ok), []);
  const empty = inCatch("// raw-error:\n    res.json({ error: err.message });");
  const found = check(empty);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /needs a reason/);
  const far = inCatch(
    "// raw-error: a reason, but not on the line above\n\n    res.json({ error: err.message });",
  );
  assert.equal(check(far).length, 1);
  const schemaOk =
    "// raw-error: the constraint name is the documented 409 text\nthrow httpError(409, 'UQ_Venue_Code');";
  assert.deepEqual(check(schemaOk), []);
});

test("raw-error-text: the known sanctioned site is the error handler's describeError, with its reason", () => {
  const src = fs.readFileSync(
    path.join(REPO, "functions/src/utils/errors.js"),
    "utf8",
  );
  assert.match(
    src,
    /\/\/ raw-error: .{10,}\n\s*return \{ status, message: shown \? err\.message/,
  );
});

// ---------------------------------------------------------------------------------------------- AC-52: it gates

test("raw-error-text: the real repository gives 0 violations", () => {
  const r = spawnSync(process.execPath, [RUN, NAME, "--root", REPO], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok\s+raw-error-text \(\d+ files\)/);
});

test("raw-error-text: run.js over a bad tree exits non-zero and names the file and the line", () => {
  const root = tree({
    [FILE]: `'use strict';\n${inCatch("res.status(500).json({ error: err.message });")}\n`,
    "db/schema.sql": "-- none\n",
  });
  try {
    const r = spawnSync(
      process.execPath,
      [RUN, NAME, "--root", root, "--allow-partial"],
      { encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(
      r.stdout,
      /functions\/src\/routes\/x\.js:4: raw-error-text: err\.message reaches a response/,
    );
    assert.match(r.stdout, /FAIL raw-error-text/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("raw-error-text: only functions/src is read by the server half; a file elsewhere is not", () => {
  const found = lint(NAME, {
    "tools/x.js": inCatch("res.json({ error: err.message });"),
    "functions/test/x.js": inCatch("res.json({ error: err.message });"),
  });
  assert.deepEqual(lines(found), []);
});
