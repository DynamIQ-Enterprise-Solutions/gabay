'use strict';

// OA-3a (spec/OA-3.md r2 AC-2, DC-28; plan/OA-3a-migration-rekey.md 1.1 section 3): `setup-db --skip-seed` prints
// "Schema gabay now has 46 tables, 104 indexes, 2 trigger(s)." with no WARNING, on a fresh database and on a database left at
// 0.16, because in dev mode it counts after the migrations step (0.17's schema.sql does not know the twelve retired tables,
// so straight after the schema step a 0.16 database still holds 58). The real setup-db.js runs as a child process against a
// throwaway database (scratchDb.js): PGDATABASE in the child's environment wins over .env (connect.js loadEnv: real env
// vars win).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { withScratchDatabase } = require('./scratchDb');

const SETUP_DB = path.resolve(__dirname, '..', 'setup-db.js');
const COUNTS_LINE = 'Schema gabay now has 46 tables, 104 indexes, 2 trigger(s).';

function setupDb(database) {
  const result = spawnSync(process.execPath, [SETUP_DB, '--skip-seed', '--stop-on-error'], {
    cwd: path.dirname(SETUP_DB),
    env: { ...process.env, PGDATABASE: database },
    encoding: 'utf8',
  });
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
}

test('AC-2: setup-db prints 46 tables, 104 indexes, 2 triggers and no WARNING, on a fresh database and on one left at 0.16', async () => {
  await withScratchDatabase(async (scratch) => {
    const fresh = setupDb(scratch.name);
    assert.equal(fresh.code, 0, fresh.out);
    assert.ok(fresh.out.includes(COUNTS_LINE), `fresh: the counts line\n${fresh.out}`);
    assert.doesNotMatch(fresh.out, /WARNING/, 'fresh: no WARNING');
    const order = ['== schema ==', '== migrations ==', '== counts =='].map((s) =>
      fresh.out.indexOf(s),
    );
    assert.ok(
      order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])),
      'the counts come after the migrations',
    );

    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applySchema016(c);
    const left = setupDb(scratch.name);
    assert.equal(left.code, 0, left.out);
    assert.ok(left.out.includes(COUNTS_LINE), `left at 0.16: the counts line\n${left.out}`);
    assert.doesNotMatch(left.out, /WARNING/, 'left at 0.16: no WARNING');
  });
});
