'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.5): the savepoint wrapper is load-bearing. A service write that reached the real
// withTransaction on the rolled-back single connection would COMMIT and keep test rows (L151). This file proves, with the
// real tables:
//   - nothing a test or a service wrote survives close(), through db.query or withTransaction, on success or failure;
//   - a failed inner write is undone to its savepoint and the outer transaction stays usable;
//   - one withTransaction at a time (no concurrent requests through one connection, G4).

const test = require('node:test');
const assert = require('node:assert/strict');
const { singleConnectionDb } = require('./helpers');
const { openSavepointDb } = require('./savepointDb');
const { uniqueTag } = require('./authHelpers');

const insertTenant = (q, code) =>
  q.query(`INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $1) RETURNING TenantId`, [code]);

/** How many tenants with these codes a fresh connection (outside the test's transaction) can see. */
async function visibleOutside(codes) {
  const other = singleConnectionDb();
  try {
    const { rows } = await other.query(
      `SELECT COUNT(*) AS n FROM gabay.Tenant WHERE Code = ANY($1::text[])`,
      [codes],
    );
    return Number(rows[0].n);
  } finally {
    await other.close();
  }
}

test('savepointDb: rows written by db.query and by withTransaction are visible inside, and gone after close()', async () => {
  const tag = uniqueTag();
  const [a, b] = [`SP_A_${tag}`, `SP_B_${tag}`];
  const t = await openSavepointDb();
  try {
    await insertTenant(t.db, a);
    const result = await t.db.withTransaction(async (tx) => {
      await insertTenant(tx, b);
      return 'done';
    });
    assert.equal(result, 'done', 'withTransaction returns what fn returns');
    const inside = await t.db.query(
      `SELECT COUNT(*) AS n FROM gabay.Tenant WHERE Code = ANY($1::text[])`,
      [[a, b]],
    );
    assert.equal(Number(inside.rows[0].n), 2, 'both rows are visible inside');
    assert.equal(await visibleOutside([a, b]), 0, 'nothing is committed while the test runs');
  } finally {
    await t.close();
  }
  assert.equal(await visibleOutside([a, b]), 0, 'nothing survives close()');
});

test('savepointDb: a failed inner write is undone to its savepoint, and the outer transaction goes on', async () => {
  const tag = uniqueTag();
  const [outer, inner, dup] = [`SP_O_${tag}`, `SP_I_${tag}`, `SP_D_${tag}`];
  const t = await openSavepointDb();
  try {
    await insertTenant(t.db, outer);
    await insertTenant(t.db, dup);
    await assert.rejects(
      t.db.withTransaction(async (tx) => {
        await insertTenant(tx, inner); // goes with the failed write
        await insertTenant(tx, dup); // unique violation
      }),
      (err) => err.code === '23505',
    );
    const seen = async (code) =>
      Number(
        (await t.db.query(`SELECT COUNT(*) AS n FROM gabay.Tenant WHERE Code = $1`, [code])).rows[0]
          .n,
      );
    assert.equal(await seen(inner), 0, 'the failed write took its earlier statements with it');
    assert.equal(await seen(outer), 1, 'the outer transaction kept its own row');
    assert.equal(await seen(dup), 1);
    // and it is still usable: another write, in a transaction and out of one
    await t.db.withTransaction(async (tx) => insertTenant(tx, `SP_N_${tag}`));
    assert.equal(await seen(`SP_N_${tag}`), 1);
  } finally {
    await t.close();
  }
  assert.equal(await visibleOutside([outer, inner, dup, `SP_N_${tag}`]), 0);
});

test('savepointDb: any error thrown by fn is rethrown as it was, after the rollback to the savepoint', async () => {
  const tag = uniqueTag();
  const code = `SP_E_${tag}`;
  const t = await openSavepointDb();
  try {
    const boom = new Error('boom');
    await assert.rejects(
      t.db.withTransaction(async (tx) => {
        await insertTenant(tx, code);
        throw boom;
      }),
      (err) => err === boom,
    );
    const { rows } = await t.db.query(`SELECT COUNT(*) AS n FROM gabay.Tenant WHERE Code = $1`, [
      code,
    ]);
    assert.equal(Number(rows[0].n), 0);
  } finally {
    await t.close();
  }
});

test('savepointDb: two withTransaction calls at once are refused (no concurrent requests through one connection)', async () => {
  const t = await openSavepointDb();
  try {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const first = t.db.withTransaction(async (tx) => {
      await tx.query('SELECT 1', []);
      await gate;
    });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      t.db.withTransaction(async () => {}),
      /overlapping|concurrent/i,
    );
    release();
    await first;
    await t.db.withTransaction(async (tx) => tx.query('SELECT 1', [])); // free again
  } finally {
    await t.close();
  }
});

test('savepointDb: the hooks see each statement, and run() stages SQL on the same connection unseen', async () => {
  const tag = uniqueTag();
  const t = await openSavepointDb();
  try {
    const seen = [];
    const after = [];
    t.hooks.onStatement = (text, params) => seen.push({ text, params });
    t.hooks.afterStatement = async (text, params, result, run) => {
      after.push(result.rows.length);
      if (/SELECT 41/.test(text)) {
        await run(`INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $1)`, [`SP_H_${tag}`]);
      }
    };
    await t.db.query('SELECT 40', []);
    await t.db.withTransaction(async (tx) => {
      await tx.query('SELECT 41', []);
    });
    assert.deepEqual(
      seen.map((s) => s.text),
      ['SELECT 40', 'SELECT 41'],
      'the hook sees db.query and tx.query, not the savepoint statements or run()',
    );
    assert.deepEqual(after, [1, 1]);
    const { rows } = await t.db.query(`SELECT COUNT(*) AS n FROM gabay.Tenant WHERE Code = $1`, [
      `SP_H_${tag}`,
    ]);
    assert.equal(Number(rows[0].n), 1);
  } finally {
    await t.close();
  }
  assert.equal(await visibleOutside([`SP_H_${tag}`]), 0);
});
