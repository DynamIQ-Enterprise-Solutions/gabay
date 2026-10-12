// Test support for FF-1 (plan/FF-1-venue-setup.md section 2.5; WORKING_AGREEMENT section 5, L151). Not a test file.
//
//   openSavepointDb()   wraps openRolledBackDb(): one connection held inside a transaction that close() ALWAYS rolls back.
//                       The returned `db` has query() and withTransaction(fn) like the real one, but withTransaction runs
//                       fn between SAVEPOINT / RELEASE (or ROLLBACK TO SAVEPOINT), never BEGIN / COMMIT. The real
//                       withTransaction on this single connection would COMMIT the outer transaction and keep test rows.
//
// DESIGN NOTE (found by savepointDb.test.js): openRolledBackDb's `db.query` goes through pg's Pool, and a Pool drops a client
// whose query errored, which would end the session and lose the outer transaction at the first unique or FK violation. So
// this helper checks the one client out of the pool and sends every statement on it directly: an error is then undone to
// its savepoint and the session, with its outer transaction, lives on. A statement sent outside withTransaction gets a
// savepoint of its own for the same reason.
//
// Two extras for staging a case deterministically (no timing, no concurrent request, plan section 2.5):
//   hooks.onStatement(text, params, inTransaction)     called before each statement a service sends (db.query or tx.query)
//   hooks.afterStatement(text, params, result, run)    called after it returns; run(text, params) sends SQL on the same
//                                                      connection WITHOUT going through the hooks (how a "race" is staged)
// `raw` (for a test's own setup) bypasses the hooks.
//
// One withTransaction at a time: an overlapping call throws, because a second request through one savepoint connection
// would interleave statements (plan G4).
'use strict';

const { openRolledBackDb } = require('./authHelpers');
const { assertParams } = require('../src/db');

async function openSavepointDb() {
  const inner = await openRolledBackDb();
  const client = await inner.db.pool.connect(); // the pool's only connection: the one inside the open transaction
  const hooks = { onStatement: null, afterStatement: null };
  let counter = 0;
  let active = false;
  let released = false;

  const rawQuery = async (text, params) => {
    assertParams(text, params);
    return client.query(text, params);
  };

  /** Outside withTransaction: its own savepoint, so a failing statement does not abort the outer transaction. */
  async function guarded(text, params) {
    counter += 1;
    const name = `ff1_q${counter}`;
    await client.query(`SAVEPOINT ${name}`);
    try {
      const result = await rawQuery(text, params);
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await client.query(`RELEASE SAVEPOINT ${name}`);
      throw err;
    }
  }

  async function send(text, params, inTransaction) {
    if (hooks.onStatement) hooks.onStatement(text, params, inTransaction);
    const result = inTransaction ? await rawQuery(text, params) : await guarded(text, params);
    if (hooks.afterStatement) await hooks.afterStatement(text, params, result, rawQuery);
    return result;
  }

  const db = {
    query: (text, params) => send(text, params, active),
    async withTransaction(fn) {
      if (active) {
        throw new Error('savepointDb: overlapping withTransaction on one connection (plan G4)');
      }
      active = true;
      counter += 1;
      const name = `ff1_${counter}`;
      try {
        await client.query(`SAVEPOINT ${name}`);
        try {
          const result = await fn({ query: (text, params) => send(text, params, true) });
          await client.query(`RELEASE SAVEPOINT ${name}`);
          return result;
        } catch (err) {
          await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
          await client.query(`RELEASE SAVEPOINT ${name}`);
          throw err;
        }
      } finally {
        active = false;
      }
    },
    close: async () => {},
  };

  return {
    db,
    raw: { query: rawQuery },
    hooks,
    async close() {
      if (!released) {
        released = true;
        client.release();
      }
      await inner.close(); // ROLLBACK (always) and end the pool
    },
  };
}

module.exports = { openSavepointDb };
