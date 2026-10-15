// SEC-2 step 3: no hand-reading is left (spec/SEC-2.md r2 AC-37). After the swap no route handler or service reads
// req.body, req.query or req.params: only the validate step and the audit trail do (and the upload route, whose body is
// multer's). A source scan of functions/src/routes and functions/src/services, comments and strings blanked.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { codeOnly } = require('../../tools/lint/lib/scan');

const SRC = path.join(__dirname, '..', 'src');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const rel = (file) => path.relative(SRC, file).replaceAll(path.sep, '/');

test('AC-37: no file under routes/ or services/ reads req.body, req.query or req.params', () => {
  const reading =
    /\breq\s*\.\s*(body|query|params)\b|\breq\s*\[\s*['"](body|query|params)['"]\s*\]/;
  const offenders = [];
  for (const file of [
    ...jsFiles(path.join(SRC, 'routes')),
    ...jsFiles(path.join(SRC, 'services')),
  ]) {
    const code = codeOnly(fs.readFileSync(file, 'utf8'), 'js');
    code.split('\n').forEach((line, i) => {
      if (!reading.test(line)) return;
      // The audit declaration of the draft save reads the body AT THE AUDIT SLOT (DC-32), the one allowed reader here.
      if (rel(file) === 'routes/venueMaps.js' && /\breq\.body\b/.test(line)) return;
      offenders.push(`${rel(file)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('AC-37: the readers nothing uses any more are gone from utils/fieldInput.js and mapEnvelope.js', () => {
  const fieldInput = require('../src/utils/fieldInput');
  assert.deepEqual(Object.keys(fieldInput).sort(), [
    'refuseIfDifferent',
    'refuseStampsOnCreate',
    'refuseStampsOnEdit',
  ]);
  const envelope = require('../src/services/mapStorage/mapEnvelope');
  for (const gone of ['readBaseVersion', 'readVersion', 'readLayout']) {
    assert.equal(envelope[gone], undefined, gone);
  }
});

test('AC-37, C2: no second implementation of a rule stays beside its schema', () => {
  // The venue limits and labels live in validation/venueBodies.js alone; the services hold no copy.
  const service = fs.readFileSync(path.join(SRC, 'services', 'venue.service.js'), 'utf8');
  assert.equal(/CODE_MAX|NAME_MAX|LABELS/.test(codeOnly(service, 'js')), false);
  // The lookup service no longer parses ids or names the 404 for an unknown name: the route's schema does.
  const lookup = codeOnly(
    fs.readFileSync(path.join(SRC, 'services', 'lookup.service.js'), 'utf8'),
    'js',
  );
  assert.equal(/parseIdParam/.test(lookup), false);
});
