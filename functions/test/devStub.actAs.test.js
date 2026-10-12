'use strict';

// FF-SK (plan/FF-SK-dashboards.md section 5, L157; the client's contract in phase-reports/feature-first/FF-SK-client.md
// section 2): the development stub honours `X-Dev-Act-As: <email>` under its existing guard (NODE_ENV explicitly
// development or test; outside them the stub refuses to exist, devStub.test.js). Only an active seeded admin account
// whose email ends @gabay.test, with at least one UserRole, may be acted as; anything else is 403 and no handler runs.
// The tenant rule is FF-0's: X-Tenant-Id must be a tenant the acted account holds (else 403), none means its first
// tenant by Tenant.Code.
//
// The owner's ruling for this slice: a SUPERADMIN acts with NO tenant when no X-Tenant-Id is sent (req.tenantCompanyID
// null; routes that need one refuse cleanly, superAdminNoTenant.test.js), and with ANY existing tenant when one is sent
// (the Blueprint's superuser override, section 2.4).
//
// Real SQL inside a transaction that is always rolled back (authHelpers.js); the stub sits on a tiny Express app.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createDevStub } = require('../src/middleware/devStub');
const { createIdentityStore } = require('../src/auth/identityStore');
const { createAccessStore } = require('../src/auth/accessStore');
const { actorContext } = require('../src/middleware/actorContext');
const { createRequestId } = require('../src/middleware/requestId');
const { createErrorHandler } = require('../src/utils/errors');
const { getActorId, getTenantId } = require('../src/utils/requestContext');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { openRolledBackDb, createSeeder, uniqueTag } = require('./authHelpers');

const ACT_AS = 'x-dev-act-as';
const TENANT = 'x-tenant-id';

/**
 * The default user D (MALL_ADMIN of A), an account E (MALL_ADMIN of B, VIEWER of C), a SUPERADMIN S (platform row),
 * and the accounts that may NOT be acted as: inactive, no role, another domain, and a shopper.
 */
async function withActAs(fn) {
  const t = await openRolledBackDb();
  const logger = fakeLogger();
  const seed = createSeeder(t.db);
  const mallAdmin = await seed.role('MALL_ADMIN');
  const viewer = await seed.role('VIEWER');
  const superAdmin = await seed.role('SUPERADMIN', { isPlatformRole: true });
  const tenantA = await seed.tenant('A');
  const tenantB = await seed.tenant('B');
  const tenantC = await seed.tenant('C');
  const tenantD = await seed.tenant('D'); // nobody below holds it
  const defaultUser = await seed.user({ name: 'Default' });
  await seed.userRole(defaultUser.userId, mallAdmin, tenantA.tenantId);
  const editor = await seed.user({ name: 'Other account' });
  await seed.userRole(editor.userId, viewer, tenantC.tenantId); // granted first: the default is by Code
  await seed.userRole(editor.userId, mallAdmin, tenantB.tenantId);
  const root = await seed.user({ name: 'Super' });
  await seed.userRole(root.userId, superAdmin, null);
  const inactive = await seed.user({ isActive: false });
  await seed.userRole(inactive.userId, mallAdmin, tenantA.tenantId);
  const roleless = await seed.user();
  const foreign = (
    await t.db.query(
      `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName, IsActive)
       VALUES ($1, $2, 'Elsewhere', TRUE) RETURNING UserId, Email`,
      [`uid-${uniqueTag()}`, `${uniqueTag()}@example.com`],
    )
  ).rows[0];
  await seed.userRole(foreign.userid, mallAdmin, tenantA.tenantId);
  const shopper = await seed.shopper();

  const app = express();
  app.use(createRequestId(logger));
  app.use(actorContext);
  const stub = createDevStub({
    config: testConfig({ DEV_STUB_USER_EMAIL: defaultUser.email }),
    logger,
    identities: createIdentityStore(t.db),
    accessStore: createAccessStore(t.db),
  });
  app.use('/probe', stub);
  app.get('/probe', async (req, res) => {
    await new Promise((resolve) => setImmediate(resolve));
    res.json({
      reached: true,
      user: req.user,
      tenantCompanyID: req.tenantCompanyID,
      actorId: getActorId(),
      contextTenantId: getTenantId(),
    });
  });
  app.use(createErrorHandler(logger));
  const server = await listen(app);
  const call = async (headers = {}) => {
    const res = await fetch(`${server.url}/probe`, { headers });
    return { status: res.status, body: await res.json() };
  };
  try {
    await fn({
      call,
      defaultUser,
      editor,
      root,
      inactive,
      roleless,
      foreign: { userId: foreign.userid, email: foreign.email },
      shopper,
      tenantA,
      tenantB,
      tenantC,
      tenantD,
    });
  } finally {
    await server.close();
    await t.close();
  }
}

const refused = (res, note) => {
  assert.equal(res.status, 403, `${note} ${JSON.stringify(res.body)}`);
  assert.deepEqual(Object.keys(res.body), ['error'], note);
  assert.equal(res.body.reached, undefined, note);
};

test('act-as: X-Dev-Act-As names the account the request acts as: req.user, the actor and its first tenant by Code', async () => {
  await withActAs(async ({ call, editor, tenantB }) => {
    const res = await call({ [ACT_AS]: editor.email });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.user.userId, editor.userId);
    assert.equal(res.body.user.email, editor.email);
    assert.equal(res.body.user.kind, 'admin');
    assert.equal(res.body.actorId, editor.userId);
    assert.equal(res.body.tenantCompanyID, tenantB.tenantId, 'B sorts before C');
    assert.equal(res.body.contextTenantId, tenantB.tenantId);
  });
});

test('act-as: with no header, or a blank one, the stub acts as DEV_STUB_USER_EMAIL as before', async () => {
  await withActAs(async ({ call, defaultUser, tenantA }) => {
    for (const headers of [{}, { [ACT_AS]: '' }, { [ACT_AS]: '   ' }]) {
      const res = await call(headers);
      assert.equal(res.status, 200, JSON.stringify(headers));
      assert.equal(res.body.user.userId, defaultUser.userId);
      assert.equal(res.body.tenantCompanyID, tenantA.tenantId);
    }
  });
});

test('act-as: the email matches in any letter case and with surrounding spaces', async () => {
  await withActAs(async ({ call, editor }) => {
    for (const value of [editor.email.toUpperCase(), `  ${editor.email}  `]) {
      const res = await call({ [ACT_AS]: value });
      assert.equal(res.status, 200, value);
      assert.equal(res.body.user.userId, editor.userId);
    }
  });
});

test('act-as: X-Tenant-Id must be a tenant the acted account holds; a tenant only the default user holds is 403', async () => {
  await withActAs(async ({ call, editor, tenantA, tenantC, tenantD }) => {
    const held = await call({ [ACT_AS]: editor.email, [TENANT]: String(tenantC.tenantId) });
    assert.equal(held.status, 200);
    assert.equal(held.body.tenantCompanyID, tenantC.tenantId);
    refused(await call({ [ACT_AS]: editor.email, [TENANT]: String(tenantA.tenantId) }), 'A');
    refused(await call({ [ACT_AS]: editor.email, [TENANT]: String(tenantD.tenantId) }), 'D');
    refused(await call({ [ACT_AS]: editor.email, [TENANT]: 'abc' }), 'malformed');
  });
});

test('act-as: an account that is unknown, inactive, roleless, outside @gabay.test, a shopper or not an email is 403, and nothing runs', async () => {
  await withActAs(async ({ call, inactive, roleless, foreign, shopper }) => {
    for (const [note, value] of [
      ['unknown', `nobody-${uniqueTag()}@gabay.test`],
      ['inactive', inactive.email],
      ['no UserRole', roleless.email],
      ['another domain', foreign.email],
      ['a shopper', shopper.email],
      ['not an email', 'malladmin'],
      ['a lookalike domain', foreign.email.replace('@example.com', '@gabay.test.example.com')],
    ]) {
      refused(await call({ [ACT_AS]: value }), note);
    }
  });
});

test('act-as: the 403 says what to send and never echoes the header', async () => {
  await withActAs(async ({ call }) => {
    const res = await call({ [ACT_AS]: 'someone@example.com' });
    refused(res, 'message');
    assert.match(res.body.error, /X-Dev-Act-As/);
    assert.match(res.body.error, /@gabay\.test/);
    assert.equal(res.body.error.includes('someone@example.com'), false);
  });
});

test('act-as, SUPERADMIN (owner ruling): with no X-Tenant-Id it acts with no tenant, never a 500', async () => {
  await withActAs(async ({ call, root }) => {
    const res = await call({ [ACT_AS]: root.email });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.user.userId, root.userId);
    assert.equal(res.body.actorId, root.userId);
    assert.equal(res.body.tenantCompanyID, null);
    assert.equal(res.body.contextTenantId, null);
  });
});

test('act-as, SUPERADMIN (owner ruling): any existing tenant may be named, held or not; one that does not exist is 403', async () => {
  await withActAs(async ({ call, root, tenantA, tenantD }) => {
    for (const tenant of [tenantA, tenantD]) {
      const res = await call({ [ACT_AS]: root.email, [TENANT]: String(tenant.tenantId) });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.tenantCompanyID, tenant.tenantId);
      assert.equal(res.body.contextTenantId, tenant.tenantId);
    }
    refused(await call({ [ACT_AS]: root.email, [TENANT]: '999999999' }), 'no such tenant');
    refused(await call({ [ACT_AS]: root.email, [TENANT]: '0' }), 'zero');
    refused(await call({ [ACT_AS]: root.email, [TENANT]: 'x1' }), 'malformed');
  });
});

test('SUPERADMIN as DEV_STUB_USER_EMAIL (no act-as header) also acts with no tenant, not the old 500', async () => {
  const t = await openRolledBackDb();
  const logger = fakeLogger();
  try {
    const seed = createSeeder(t.db);
    const role = await seed.role('SUPERADMIN', { isPlatformRole: true });
    const root = await seed.user();
    await seed.userRole(root.userId, role, null);
    const app = express();
    app.use(actorContext);
    app.use(
      '/probe',
      createDevStub({
        config: testConfig({ DEV_STUB_USER_EMAIL: root.email }),
        logger,
        identities: createIdentityStore(t.db),
        accessStore: createAccessStore(t.db),
      }),
    );
    app.get('/probe', (req, res) => res.json({ tenantCompanyID: req.tenantCompanyID }));
    app.use(createErrorHandler(logger));
    const server = await listen(app);
    try {
      const res = await fetch(`${server.url}/probe`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { tenantCompanyID: null });
    } finally {
      await server.close();
    }
  } finally {
    await t.close();
  }
});
