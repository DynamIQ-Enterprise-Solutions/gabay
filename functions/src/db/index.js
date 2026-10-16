// The DB layer (standard §3.9): one pg Pool, parameterized queries only, explicit transactions.
// Raw SQL with $1...$n placeholders; no ORM, no query builder (Blueprint Part 1).
'use strict';

const pg = require('pg');
const { getConfig } = require('../config');
const { createLogger } = require('../utils/logger');
const { isConnectionError } = require('./connectionError');
const { createConnectorHandle } = require('./connector');

const PG_DATE_OID = 1082;

/**
 * DESIGN CHOICE (UTC everywhere, Blueprint invariant 12; standard §3.10): a DATE column is returned as
 * its 'YYYY-MM-DD' text instead of a Date at the server's local midnight, which JSON would shift a
 * day. TIMESTAMPTZ still arrives as a Date, an exact instant. NUMERIC arrives as text (for Decimal).
 */
const types = {
  getTypeParser: (oid, format) =>
    oid === PG_DATE_OID ? (value) => value : pg.types.getTypeParser(oid, format),
};

/** Guard shared by every query path: a call without a params array is a programming error. */
function assertParams(text, params) {
  if (typeof text !== 'string') throw new TypeError('query(text, params): text must be a string');
  if (!Array.isArray(params)) {
    throw new TypeError(
      'query(text, params): params must be an array, use [] when there are none. Every query is parameterized.',
    );
  }
}

/**
 * Builds the db access object for a validated config. Tests build their own against a
 * different config (for example an unreachable database).
 *
 * Two connection modes (DEP-0 AC-13, config.db.mode):
 *   host       the pool dials config.db.host and port, and is built here, as it always was
 *   connector  the pool takes the Cloud SQL connector's options (E-29, connector.js). The connector, and so the pool, are made on
 *              the FIRST connection, not here, and a failure there is not remembered: the next call tries again. Any failure
 *              raised while obtaining the pool is tagged dbUnavailable (503), whatever its code (AC-16).
 * @param {object} config
 * @param {object} [logger]
 * @param {{ connectorFactory?: Function }} [options]  a test passes a fake connector factory (no network, no package)
 */
function createDb(config, logger = createLogger(config.logLevel), { connectorFactory } = {}) {
  const { db } = config;
  const connector =
    db.mode === 'connector'
      ? createConnectorHandle({ instance: db.instance, connectorFactory })
      : null;
  /** Everything about the pool that does not depend on where it dials. */
  const poolSettings = {
    database: db.database,
    user: db.user,
    password: db.password,
    max: db.poolMax,
    idleTimeoutMillis: db.idleTimeoutMs,
    connectionTimeoutMillis: db.connectTimeoutMs,
    // Raised on purpose (§3.9): bulk writes and publishes legitimately run long.
    statement_timeout: db.statementTimeoutMs,
    types,
  };
  const newPool = (target) => {
    const created = new pg.Pool({ ...target, ...poolSettings });
    // An idle client that errors (server restart) must not crash the process.
    created.on('error', (err) => logger.error({ err }, 'idle database client error'));
    return created;
  };

  /** The pool: built now in host mode, on the first connection in connector mode. */
  let pool = connector ? null : newPool({ host: db.host, port: db.port });
  let opening = null;

  /** The pool, opening it first in connector mode. A failure is tagged dbUnavailable, never remembered, and never crashes. */
  async function getPool() {
    if (pool) return pool;
    opening ??= connector
      .poolOptions()
      .then((options) => {
        pool = newPool(options);
        return pool;
      })
      .catch((err) => {
        opening = null; // the next request tries again (the instance may have been starting)
        throw err;
      });
    try {
      return await opening;
    } catch (err) {
      const tagged = err instanceof Error ? err : new Error(String(err));
      tagged.dbUnavailable = true;
      throw tagged;
    }
  }

  // Boot log (§3.9, AC-17): where we point, never the password.
  logger.info(
    connector
      ? { mode: 'connector', instance: db.instance, database: db.database, user: db.user }
      : { mode: 'host', host: db.host, port: db.port, database: db.database, user: db.user },
    'database pool created',
  );

  /**
   * Tags a connection-level failure (refused, unknown host, pool timeout, server shutdown) with
   * `dbUnavailable`, so the error handler can answer 503 on any route (S2 review, Important 2).
   * Statement errors (a unique violation, a bad column) are left alone: those are 4xx or 500.
   */
  async function tagUnavailable(run) {
    try {
      return await run();
    } catch (err) {
      if (isConnectionError(err)) err.dbUnavailable = true;
      throw err;
    }
  }

  /** Runs one parameterized statement on the pool. */
  async function query(text, params) {
    assertParams(text, params);
    const ready = await getPool();
    return tagUnavailable(() => ready.query(text, params));
  }

  /**
   * BEGIN -> fn(tx) -> COMMIT; any throw rolls back and rethrows (§3.9). `tx.query` has the same
   * params rule as `query` and runs on the transaction's own connection.
   *
   * Only failures raised by the database layer's own calls (pool.connect, BEGIN, COMMIT, tx.query)
   * are tagged `dbUnavailable` and make the connection count as lost. A failed ROLLBACK is logged and
   * also marks the connection lost, but it is not tagged (the original error is the one rethrown). An
   * error thrown by the caller's fn itself (an ECONNRESET from some other service) is passed through
   * untouched, and the healthy connection goes back to the pool (S2 re-review N1).
   */
  async function withTransaction(fn) {
    const client = await tagUnavailable(async () => (await getPool()).connect());
    let lost = false;
    // The pool only listens for errors on IDLE clients. While this one is checked out, a dropped
    // connection can emit 'error' with no listener, which would crash the process (found by a test
    // that kills the backend mid-transaction). Note it, log it, and let the failing query report it.
    const onClientError = (err) => {
      lost = true;
      logger.error({ err }, 'transaction connection error');
    };
    client.on('error', onClientError);
    /** Runs one call on the transaction's own connection, noting a connection-level failure. */
    const onClient = async (run) => {
      try {
        return await run();
      } catch (err) {
        if (isConnectionError(err)) {
          err.dbUnavailable = true;
          lost = true;
        }
        throw err;
      }
    };
    const tx = {
      query: async (text, params) => {
        assertParams(text, params);
        return onClient(() => client.query(text, params));
      },
    };
    try {
      await onClient(() => client.query('BEGIN'));
      const result = await fn(tx);
      await onClient(() => client.query('COMMIT'));
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        lost = true; // a connection that cannot roll back is not safe to reuse
        logger.error({ err: rollbackErr }, 'rollback failed');
      }
      throw err;
    } finally {
      client.off('error', onClientError);
      client.release(lost); // a lost connection is destroyed, not returned to the pool
    }
  }

  /** Ends the pool, then the connector (once). A connector-mode pool that was never opened has nothing to end. */
  async function close() {
    try {
      if (!pool && opening) await opening.catch(() => {}); // a connection still being opened is let finish
      if (pool) await pool.end();
    } finally {
      connector?.close();
    }
  }

  return {
    query,
    withTransaction,
    close,
    /** The pg Pool: null in connector mode until the first connection. */
    get pool() {
      return pool;
    },
  };
}

let shared = null;

/** The process-wide db (created on first use, so importing this file never connects). */
function getDb() {
  if (!shared) shared = createDb(getConfig());
  return shared;
}

module.exports = { createDb, getDb, assertParams };
