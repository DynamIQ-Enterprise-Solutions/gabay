'use strict';

// SEC-1 (spec/SEC-1.md r2 section 3.2: AC-3, AC-4, AC-6, AC-8 to AC-12, AC-45, AC-48; EC-5, EC-11, EC-13, EC-15, EC-23,
// EC-36, EC-40, EC-41; plan/SEC-1.md 1.0 step 2): tenantContext, through real HTTP over the real tables inside a
// transaction that is always rolled back (L151).
//
// Part 1, "probe": the real auth, requireAdminUser and tenantContext in front of a probe handler that answers what the
// request ended up with (req.tenantCompanyID, req.actingAsTenantId, req.access, and the three context getters after
// awaits). It isolates tenantContext from the role and permission guards, so each refusal below is tenantContext's.
// Part 2 (added with step 4's rewiring): the same rules through the real routes of createApp.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createRequestId } = require('../src/middleware/requestId');
const { actorContext } = require('../src/middleware/actorContext');
const { createAuth, requireAdminUser } = require('../src/middleware/auth');
const { createTenantContext, MSG } = require('../src/middleware/tenantContext');
const { createIdentityStore } = require('../src/auth/identityStore');
const { createAccessStore } = require('../src/auth/accessStore');
const { createAccessCache } = require('../src/auth/accessCache');
const { createSettings } = require('../src/config/settings');
const { createErrorHandler, notFound } = require('../src/utils/errors');
const { getActorId, getTenantId, getActingAsTenantId } = require('../src/utils/requestContext');
const { fakeLogger, listen } = require('./helpers');
const { createSeeder, loggedText } = require('./authHelpers');
const { openSavepointDb } = require('./savepointDb');

/** The statements that read the access rows (the SQL log's "nothing ran" checks look for these). */
const ACCESS_TABLES =
  /\bgabay\.(UserRole|Role|RolePermission|UserPermission|PermissionRoute|Tenant|UserVenueGrant)\b/i;

const nowS = () => Math.floor(Date.now() / 1000);

/** A token verifier double: token -> uid (extra claims optional); auth_time is "now" when verified. */
function tokenTable(entries) {
  return {
    async verifyIdToken(token) {
      const entry = entries.get(token);
      if (!entry) {
        const err = new Error('Invalid session');
        err.httpStatus = 401;
        throw err;
      }
      return { uid: entry.uid, auth_time: nowS(), ...entry.extra };
    },
  };
}

/** The probe app over a rolled-back savepoint connection, with the users and tenants the cases need. */
async function withProbe(fn) {
  const t = await openSavepointDb();
  try {
    await t.raw.query('LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE', []);
    const seed = createSeeder(t.raw);
    const roles = {
      superadmin: await seed.role('SUPERADMIN', { isPlatformRole: true }),
      mallAdmin: await seed.role('MALL_ADMIN'),
      venueEditor: await seed.role('VENUE_EDITOR'),
      viewer: await seed.role('VIEWER'),
      inactive: await seed.role(`SEC1_OFF_${seed.tag}`, { isActive: false }),
    };
    const tenantA = await seed.tenant('A');
    const tenantB = await seed.tenant('B');
    const tenantC = await seed.tenant('C');
    const tenantD = await seed.tenant('D', { isActive: false }); // inactive (AC-11)

    const tokens = new Map();
    const users = {};
    async function user(name, rows, extra = {}) {
      const u = await seed.user({ name: `SEC1 ${name}` });
      for (const [roleId, tenantId] of rows) await seed.userRole(u.userId, roleId, tenantId);
      const token = `tok-${name}-${seed.tag}-${u.userId}`;
      tokens.set(token, { uid: u.uid, extra });
      users[name] = { ...u, token };
      return users[name];
    }
    await user('mall', [
      [roles.mallAdmin, tenantA.tenantId],
      [roles.mallAdmin, tenantD.tenantId],
    ]);
    await user('two', [
      [roles.mallAdmin, tenantA.tenantId],
      [roles.viewer, tenantB.tenantId],
    ]);
    await user('editor', [[roles.venueEditor, tenantA.tenantId]]);
    await user('sa', [[roles.superadmin, null]]);
    await user('saPlus', [
      [roles.superadmin, null],
      [roles.viewer, tenantA.tenantId],
    ]);
    await user('offRole', [[roles.inactive, tenantA.tenantId]]);
    await user('noRole', []);
    await user('badPlatform', [[roles.viewer, null]]); // a NULL-tenant row of a non-platform role (bad data)
    await user(
      'claims',
      [[roles.mallAdmin, tenantA.tenantId]],
      // AC-6: claims naming tenant B in every shape a client could try; none may pick the tenant
      {
        tenantId: tenantB.tenantId,
        companyId: tenantB.tenantId,
        tenant: String(tenantB.tenantId),
        firebase: { tenant: String(tenantB.tenantId), sign_in_provider: 'password' },
      },
    );

    const logger = fakeLogger();
    const settings = createSettings((text, params) => t.raw.query(text, params), logger);
    const accessStore = createAccessStore(t.db);
    const accessCache = createAccessCache({ accessStore });
    const auth = createAuth({
      verifier: tokenTable(tokens),
      identities: createIdentityStore(t.db),
      settings,
    });
    const tenantContext = createTenantContext({ accessCache, accessStore });
    const app = express();
    app.use(express.json());
    app.use(createRequestId(logger));
    app.use(actorContext);
    app.use('/probe', auth, requireAdminUser, tenantContext, async (req, res) => {
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setTimeout(resolve, 1));
      res.json({
        tenantCompanyID: req.tenantCompanyID,
        actingAsTenantId: req.actingAsTenantId,
        access: {
          roles: [...req.access.roles].sort(),
          permissions: req.access.permissions,
          isSuperAdmin: req.access.isSuperAdmin,
          isTenantWide: req.access.isTenantWide,
        },
        context: [getActorId(), getTenantId(), getActingAsTenantId()],
      });
    });
    app.use(notFound);
    app.use(createErrorHandler(logger));
    const server = await listen(app);

    const log = [];
    t.hooks.onStatement = (text) => log.push(text);

    async function probe(who, tenantHeader, { path = '/probe', method = 'GET', body } = {}) {
      const headers = {};
      if (who) headers.authorization = `Bearer ${users[who].token}`;
      if (tenantHeader !== undefined) headers['x-tenant-id'] = tenantHeader;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const res = await fetch(`${server.url}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    }

    /** One request with the tenant header sent on TWO header lines (http.request; fetch would join them itself). */
    function probeTwoLines(who, values) {
      return new Promise((resolve, reject) => {
        const req = http.request(`${server.url}/probe`, { method: 'GET' }, (res) => {
          let text = '';
          res.on('data', (c) => (text += c));
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
        });
        req.on('error', reject);
        req.setHeader('authorization', `Bearer ${users[who].token}`);
        req.setHeader('x-tenant-id', values); // an array: one header line per value
        req.end();
      });
    }

    try {
      await fn({
        t,
        seed,
        roles,
        users,
        tenantA,
        tenantB,
        tenantC,
        tenantD,
        logger,
        log,
        probe,
        probeTwoLines,
        accessCache,
      });
    } finally {
      t.hooks.onStatement = null;
      await server.close();
    }
  } finally {
    await t.close();
  }
}

const id = (tenant) => String(tenant.tenantId);

/** The refusal body of tenantContext: exactly { error } with the message. */
function assertRefusal(res, status, message, note = '') {
  assert.equal(res.status, status, `${note} ${JSON.stringify(res.body)}`);
  assert.deepEqual(res.body, { error: message }, note);
}

test('AC-3, EC-36: X-Tenant-Id missing, empty or blank is 400 M-NO-TENANT for every role, SUPERADMIN included, before any access query', async () => {
  await withProbe(async ({ probe, log }) => {
    for (const who of ['mall', 'editor', 'two', 'sa', 'saPlus', 'noRole']) {
      for (const value of [undefined, '', '   ', '\t']) {
        log.length = 0;
        const res = await probe(who, value);
        assertRefusal(res, 400, MSG.noTenant, `${who} ${JSON.stringify(value)}`);
        assert.deepEqual(
          log.filter((s) => ACCESS_TABLES.test(s)),
          [],
          `${who}: no access statement for a missing tenant`,
        );
      }
    }
    assert.equal(MSG.noTenant, 'Choose a tenant: this works inside one tenant');
  });
});

test('AC-4, EC-11, EC-36: a malformed value, a tenant not held and no tenant at all are the same 403 M-NOT-HELD; a malformed one runs no access query', async () => {
  await withProbe(async ({ probe, log, tenantA, tenantC }) => {
    const realWithInnerSpace = `${id(tenantA).slice(0, 1)} ${id(tenantA).slice(1) || '0'}`;
    const malformed = [
      '0',
      '007',
      '-1',
      '1.5',
      '1e3',
      '0x10',
      'abc',
      '1,2',
      '1 OR 1=1',
      // Arabic-Indic digits: a header carries bytes, so a client sends their UTF-8 encoding (what the server reads)
      Buffer.from('١٢٣', 'utf8').toString('latin1'),
      '1234567890', // ten digits
      '12345678901234567890',
      realWithInnerSpace,
      `${id(tenantA)};`,
      `+${id(tenantA)}`,
    ];
    const bodies = [];
    for (const value of malformed) {
      log.length = 0;
      const res = await probe('mall', value);
      assertRefusal(res, 403, MSG.notHeld, `malformed ${JSON.stringify(value)}`);
      bodies.push(JSON.stringify(res.body));
      assert.deepEqual(
        log.filter((s) => ACCESS_TABLES.test(s)),
        [],
        `malformed ${JSON.stringify(value)}: refused before any access query`,
      );
    }
    for (const [label, value] of [
      ['a tenant not held', id(tenantC)],
      ['no tenant at all', '999999999'],
    ]) {
      const res = await probe('mall', value);
      assertRefusal(res, 403, MSG.notHeld, label);
      bodies.push(JSON.stringify(res.body));
    }
    assert.equal(
      new Set(bodies).size,
      1,
      'one body for every case: "exists" cannot be told from "does not"',
    );
    // surrounding blanks are trimmed (spec: "after trimming surrounding blanks")
    const padded = await probe('mall', `  ${id(tenantA)}  `);
    assert.equal(padded.status, 200, JSON.stringify(padded.body));
    assert.equal(padded.body.tenantCompanyID, tenantA.tenantId);
  });
});

test('AC-4 (step 0 (f)): a repeated X-Tenant-Id arrives comma-joined and is refused 403, even when both lines name a held tenant', async () => {
  await withProbe(async ({ probeTwoLines, tenantA }) => {
    const res = await probeTwoLines('mall', [id(tenantA), id(tenantA)]);
    assertRefusal(res, 403, MSG.notHeld, 'two header lines');
  });
});

test('AC-5 (probe), AC-45: a held tenant proceeds; req.tenantCompanyID and the three getters carry it after awaits', async () => {
  await withProbe(async ({ probe, users, tenantA }) => {
    const res = await probe('mall', id(tenantA));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.tenantCompanyID, tenantA.tenantId);
    assert.equal(res.body.actingAsTenantId, null);
    assert.deepEqual(res.body.context, [users.mall.userId, tenantA.tenantId, null]);
    assert.deepEqual(res.body.access.roles, ['MALL_ADMIN']);
    assert.equal(res.body.access.isTenantWide, true, 'MALL_ADMIN is tenant-wide (L186 Q2 (a))');
    assert.equal(res.body.access.isSuperAdmin, false);
  });
});

test('AC-6, EC-13: token claims, the query string and the body never pick the tenant; a claim of B with the header A acts in A, the header B is 403', async () => {
  await withProbe(async ({ probe, tenantA, tenantB }) => {
    const inA = await probe('claims', id(tenantA), {
      path: `/probe?tenantId=${tenantB.tenantId}&tenant=${tenantB.tenantId}`,
      method: 'POST',
      body: { tenantId: tenantB.tenantId, companyId: tenantB.tenantId },
    });
    assert.equal(inA.status, 200, JSON.stringify(inA.body));
    assert.equal(inA.body.tenantCompanyID, tenantA.tenantId, 'the header and the database decide');
    assert.equal(inA.body.context[1], tenantA.tenantId);
    assertRefusal(await probe('claims', id(tenantB)), 403, MSG.notHeld, 'B is not held');
    // and with no header the claims do not supply one
    assertRefusal(
      await probe('claims', undefined, { path: `/probe?tenantId=${tenantA.tenantId}` }),
      400,
      MSG.noTenant,
    );
  });
});

test('AC-8, EC-20, EC-32: one user, two tenants, two sets of rights; each request is judged alone', async () => {
  await withProbe(async ({ probe, tenantA, tenantB }) => {
    const a = await probe('two', id(tenantA));
    const b = await probe('two', id(tenantB));
    const a2 = await probe('two', id(tenantA));
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(a.body.access.roles, ['MALL_ADMIN']);
    assert.deepEqual(b.body.access.roles, ['VIEWER']);
    assert.equal(
      a.body.access.permissions['venue-versions'].create,
      true,
      'MALL_ADMIN publishes in A',
    );
    assert.equal(b.body.access.permissions['venue-versions'].create, false, 'VIEWER does not in B');
    assert.equal(a.body.access.isTenantWide, true);
    assert.equal(b.body.access.isTenantWide, false, 'a VIEWER is venue-scoped');
    assert.deepEqual(a2.body, a.body, 'switching tenants between requests leaves nothing behind');
  });
});

test('AC-9, AC-10, EC-15, EC-23: SUPERADMIN names any existing tenant (an act-as, logged with ids only), none is 400, a nonexistent one is 403', async () => {
  await withProbe(async ({ probe, users, logger, tenantA, tenantB, tenantC }) => {
    assertRefusal(await probe('sa', undefined), 400, MSG.noTenant, 'no header');
    assertRefusal(await probe('sa', '999999999'), 403, MSG.notHeld, 'no such tenant');
    for (const tenant of [tenantA, tenantB, tenantC]) {
      logger.calls.info.length = 0;
      const res = await probe('sa', id(tenant));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.tenantCompanyID, tenant.tenantId);
      assert.equal(res.body.actingAsTenantId, tenant.tenantId, 'an act-as');
      assert.deepEqual(res.body.context, [users.sa.userId, tenant.tenantId, tenant.tenantId]);
      assert.equal(res.body.access.isSuperAdmin, true);
      assert.equal(res.body.access.isTenantWide, true);
      const lines = logger.calls.info.filter((c) => c[1] === 'acting as another tenant');
      assert.equal(lines.length, 1, 'one act-as line');
      const fields = lines[0][0];
      assert.equal(fields.userId, users.sa.userId);
      assert.equal(fields.tenantId, tenant.tenantId);
      assert.equal(fields.actingAsTenantId, tenant.tenantId, 'the request logger carries it too');
      assert.doesNotMatch(
        JSON.stringify(fields),
        /@gabay\.test|SEC1 |Tenant [A-D] |tok-/,
        'ids only',
      );
    }
    // EC-23: SUPERADMIN with its own tenant role there is not an act-as; elsewhere it is
    const own = await probe('saPlus', id(tenantA));
    assert.equal(own.status, 200);
    assert.equal(own.body.actingAsTenantId, null, 'its own tenant: not an act-as');
    assert.deepEqual(own.body.access.roles, ['SUPERADMIN', 'VIEWER']);
    const other = await probe('saPlus', id(tenantB));
    assert.equal(other.body.actingAsTenantId, tenantB.tenantId);
  });
});

test('AC-9, I2: a NULL-tenant row of a role that is not a platform role grants nothing, and is logged by ids', async () => {
  await withProbe(async ({ probe, users, logger, tenantA }) => {
    logger.calls.warn.length = 0;
    assertRefusal(await probe('badPlatform', id(tenantA)), 403, MSG.notHeld);
    const warned = logger.calls.warn.filter((c) => /not a platform role/.test(String(c[1])));
    assert.equal(warned.length, 1);
    assert.equal(warned[0][0].userId, users.badPlatform.userId);
    assert.doesNotMatch(JSON.stringify(warned[0][0]), /@gabay\.test|SEC1 /);
  });
});

test('AC-11, EC-40: an inactive tenant is 403 M-INACTIVE-TENANT for a tenant role; SUPERADMIN proceeds and its act-as is logged', async () => {
  await withProbe(async ({ probe, logger, tenantD }) => {
    assertRefusal(
      await probe('mall', id(tenantD)),
      403,
      MSG.inactiveTenant,
      'MALL_ADMIN of the inactive tenant',
    );
    assert.equal(MSG.inactiveTenant, 'This tenant is not active');
    logger.calls.info.length = 0;
    const sa = await probe('sa', id(tenantD));
    assert.equal(sa.status, 200, JSON.stringify(sa.body));
    assert.equal(sa.body.actingAsTenantId, tenantD.tenantId);
    assert.equal(logger.calls.info.filter((c) => c[1] === 'acting as another tenant').length, 1);
  });
});

test('AC-12, EC-5, EC-41: an inactive role is not counted, a user with no role is 403 on every tenant, a user set inactive is 401 on the next request', async () => {
  await withProbe(async ({ probe, t, users, tenantA, tenantB, tenantC }) => {
    assertRefusal(
      await probe('offRole', id(tenantA)),
      403,
      MSG.notHeld,
      'only an inactive role there',
    );
    for (const tenant of [tenantA, tenantB, tenantC]) {
      assertRefusal(await probe('noRole', id(tenant)), 403, MSG.notHeld, 'no UserRole row at all');
    }
    assert.equal((await probe('editor', id(tenantA))).status, 200, 'active first');
    await t.raw.query('UPDATE gabay.AppUser SET IsActive = FALSE WHERE UserId = $1', [
      users.editor.userId,
    ]);
    const after = await probe('editor', id(tenantA));
    assertRefusal(
      after,
      401,
      'Account is not active',
      'no cache between auth and AppUser.IsActive',
    );
  });
});

test('AC-48: the token never reaches a log line or a body, after refusals and successes', async () => {
  await withProbe(async ({ probe, logger, users, tenantA, tenantC }) => {
    const answers = [
      await probe('mall', id(tenantA)),
      await probe('mall', id(tenantC)),
      await probe('mall', 'abc'),
      await probe('sa', id(tenantC)),
      await probe('mall', undefined),
    ];
    const text = loggedText(logger.calls) + JSON.stringify(answers);
    for (const u of Object.values(users)) {
      assert.ok(!text.includes(u.token), 'no token in the logs or bodies');
      assert.ok(!text.includes(u.token.slice(4, 20)), 'no part of a token either');
    }
  });
});
