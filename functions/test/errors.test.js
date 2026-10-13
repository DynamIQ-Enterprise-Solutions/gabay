'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { httpError, createErrorHandler, notFound } = require('../src/utils/errors');
const { fakeLogger, singleConnectionDb, listen } = require('./helpers');

/** A tiny app with the same tail as the real one (404 then the error handler) plus test routes. */
async function mount(routes, logger = fakeLogger()) {
  const app = express();
  routes(app);
  app.use(notFound);
  app.use(createErrorHandler(logger));
  return { ...(await listen(app)), logger };
}

async function get(url) {
  const res = await fetch(url);
  return { status: res.status, body: await res.json(), type: res.headers.get('content-type') };
}

test('errors: a 404 is { error } JSON', async () => {
  const s = await mount(() => {});
  try {
    const r = await get(`${s.url}/nothing-here`);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: 'Not found' });
    assert.match(r.type, /application\/json/);
  } finally {
    await s.close();
  }
});

test('errors: a domain error keeps its httpStatus and its message', async () => {
  const s = await mount((app) =>
    app.get('/x', () => {
      throw httpError(422, 'The venue name is required.');
    }),
  );
  try {
    const r = await get(`${s.url}/x`);
    assert.equal(r.status, 422);
    assert.deepEqual(r.body, { error: 'The venue name is required.' });
    assert.equal(s.logger.calls.error.length, 0, '4xx domain errors are not server faults');
  } finally {
    await s.close();
  }
});

test('errors: a 5xx domain error is hidden unless it opts in', async () => {
  const s = await mount((app) => {
    app.get('/hidden', () => {
      throw httpError(502, 'upstream said: secret detail');
    });
    app.get('/shown', () => {
      throw httpError(503, 'Maps are being published.', { expose: true });
    });
  });
  try {
    assert.deepEqual((await get(`${s.url}/hidden`)).body, { error: 'Internal server error' });
    const shown = await get(`${s.url}/shown`);
    assert.equal(shown.status, 503);
    assert.deepEqual(shown.body, { error: 'Maps are being published.' });
  } finally {
    await s.close();
  }
});

test('errors: an unexpected Error is a generic 500, logged, never echoed', async () => {
  const s = await mount((app) =>
    app.get('/boom', () => {
      throw new Error('relation gabay.Secret does not exist');
    }),
  );
  try {
    const r = await get(`${s.url}/boom`);
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: 'Internal server error' });
    assert.equal(s.logger.calls.error.length, 1);
  } finally {
    await s.close();
  }
});

test('errors: a real PostgreSQL unique violation (23505) becomes 409 with a human message', async () => {
  const db = singleConnectionDb();
  const s = await mount((app) =>
    app.get('/dup', async () => {
      await db.withTransaction(async (tx) => {
        await tx.query('CREATE TEMP TABLE err_dup (code VARCHAR(10) PRIMARY KEY)', []);
        await tx.query('INSERT INTO err_dup VALUES ($1)', ['A']);
        await tx.query('INSERT INTO err_dup VALUES ($1)', ['A']);
      });
    }),
  );
  try {
    const r = await get(`${s.url}/dup`);
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: 'That record already exists.' });
    assert.doesNotMatch(JSON.stringify(r.body), /err_dup|duplicate key|constraint/i);
    assert.equal(s.logger.calls.error.length, 1, 'the driver error is logged server-side');
  } finally {
    await s.close();
    await db.close();
  }
});

test('errors: any other PostgreSQL error is a generic 500 and its text is not echoed', async () => {
  const db = singleConnectionDb();
  const s = await mount((app) =>
    app.get('/bad', async () => {
      await db.query('SELECT * FROM gabay.no_such_table_for_this_test', []);
    }),
  );
  try {
    const r = await get(`${s.url}/bad`);
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: 'Internal server error' });
  } finally {
    await s.close();
    await db.close();
  }
});

// ---- OA-2 (plan/OA-2-map-storage.md 1.0 sections 4.3 and 6.2): `extra`, and multer's codes (ruling 18a Q2 (a); Q4 (a)) ----

test('errors: httpError extra keys are added after error in a 4xx body (AC-14 { error, problems, total }, AC-16 { error, draftVersion })', async () => {
  const s = await mount((app) => {
    app.get('/problems', () => {
      throw httpError(400, 'This map has 2 problems.', {
        extra: { problems: ['a: x', 'b: y'], total: 2 },
      });
    });
    app.get('/stale', () => {
      throw httpError(409, 'Someone else changed this map. Reload to see their change', {
        extra: { draftVersion: 4 },
      });
    });
  });
  try {
    const problems = await get(`${s.url}/problems`);
    assert.equal(problems.status, 400);
    assert.deepEqual(problems.body, {
      error: 'This map has 2 problems.',
      problems: ['a: x', 'b: y'],
      total: 2,
    });
    assert.deepEqual(Object.keys(problems.body), ['error', 'problems', 'total'], 'error first');
    const stale = await get(`${s.url}/stale`);
    assert.equal(stale.status, 409);
    assert.deepEqual(stale.body, {
      error: 'Someone else changed this map. Reload to see their change',
      draftVersion: 4,
    });
    assert.equal(s.logger.calls.error.length, 0, '4xx domain errors are not server faults');
  } finally {
    await s.close();
  }
});

test('errors: a 5xx never carries extra keys, exposed or not (standard 3.8)', async () => {
  const s = await mount((app) => {
    app.get('/hidden', () => {
      throw httpError(500, 'detail', { extra: { problems: ['secret'], draftVersion: 1 } });
    });
    app.get('/shown', () => {
      throw httpError(503, 'Maps are being published.', {
        expose: true,
        extra: { problems: ['secret'], draftVersion: 1 },
      });
    });
  });
  try {
    assert.deepEqual((await get(`${s.url}/hidden`)).body, { error: 'Internal server error' });
    const shown = await get(`${s.url}/shown`);
    assert.equal(shown.status, 503);
    assert.deepEqual(shown.body, { error: 'Maps are being published.' });
  } finally {
    await s.close();
  }
});

test('errors: multer LIMIT_FILE_SIZE is a 413 "Request body too large", never with multer\'s own text', async () => {
  const { MulterError } = require('multer');
  const s = await mount((app) =>
    app.get('/big', () => {
      throw new MulterError('LIMIT_FILE_SIZE', 'file');
    }),
  );
  try {
    const r = await get(`${s.url}/big`);
    assert.equal(r.status, 413);
    assert.deepEqual(r.body, { error: 'Request body too large' });
    assert.equal(s.logger.calls.error.length, 0, "a client's oversize file is not a server fault");
  } finally {
    await s.close();
  }
});

test("errors: multer's other LIMIT_* codes are a 400 in the standard shape, never with multer's own text", async () => {
  const { MulterError } = require('multer');
  const codes = [
    'LIMIT_PART_COUNT',
    'LIMIT_FILE_COUNT',
    'LIMIT_FIELD_KEY',
    'LIMIT_FIELD_VALUE',
    'LIMIT_FIELD_COUNT',
    'LIMIT_UNEXPECTED_FILE',
  ];
  const s = await mount((app) =>
    app.get('/limit/:code', (req) => {
      throw new MulterError(req.params.code, 'file');
    }),
  );
  try {
    for (const code of codes) {
      const r = await get(`${s.url}/limit/${code}`);
      assert.equal(r.status, 400, code);
      assert.deepEqual(Object.keys(r.body), ['error'], code);
      assert.equal(typeof r.body.error, 'string', code);
      assert.doesNotMatch(
        r.body.error,
        /unexpected field|too many|field name|multer|LIMIT_/i,
        `${code}: no raw text`,
      );
    }
    for (const code of ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE']) {
      const r = await get(`${s.url}/limit/${code}`);
      assert.equal(r.body.error, 'Choose one PNG, JPEG or WebP image to upload', code);
    }
    assert.equal(s.logger.calls.error.length, 0);
  } finally {
    await s.close();
  }
});
