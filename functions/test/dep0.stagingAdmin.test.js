'use strict';

// DEP-0 AC-37 to AC-40, AC-42, AC-57, EC-11, EC-13, EC-14, EC-21, EC-33, EC-34 (plan/DEP-0.md 1.0 step 5, R6): the logic of
// `npm run staging:admin` (tools/lib/stagingAdmin.js) over a rolled-back savepoint database and a FAKE Admin auth object: no
// network, no emulator, no credential. Each refusal case shows that nothing was written, to the database or to the fake.
// The command line and the environment refusals are tools/test/staging-admin-cli.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { openSavepointDb } = require('./savepointDb');
const { createSeeder } = require('./authHelpers');
const { fakeAdminAuth } = require('./fakeAdminAuth');
const {
  provisionAdmin,
  summaryLines,
  describeAuthFailure,
  StagingAdminRefusal,
} = require('../../tools/lib/stagingAdmin');

const PROJECT = 'gabay-staging';

/** A rolled-back database with a few tenants and venues, and the roles of migration 0002 (created here if the database lacks them). */
async function world(fn) {
  const t = await openSavepointDb();
  try {
    const seed = createSeeder(t.raw);
    for (const [code, platform] of [
      ['SUPERADMIN', true],
      ['MALL_ADMIN', false],
      ['VENUE_EDITOR', false],
      ['VIEWER', false],
    ]) {
      await seed.role(code, { isPlatformRole: platform });
    }
    const tenantA = await seed.tenant('A');
    const tenantB = await seed.tenant('B');
    const empty = await seed.tenant('EMPTY');
    const inactive = await seed.tenant('OFF', { isActive: false });
    let venueNo = 0;
    const venue = async (tenant) => {
      venueNo += 1;
      return (
        await t.raw.query(
          `INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, $2, $2) RETURNING VenueId`,
          [tenant.tenantId, `V${seed.tag}${venueNo}`],
        )
      ).rows[0].venueid;
    };
    const venuesA = [await venue(tenantA), await venue(tenantA)];
    const venuesB = [await venue(tenantB)];
    const rows = async (text, params = []) => (await t.raw.query(text, params)).rows;
    const counts = async () => ({
      users: (await rows('SELECT count(*)::int AS n FROM gabay.AppUser'))[0].n,
      roles: (await rows('SELECT count(*)::int AS n FROM gabay.UserRole'))[0].n,
      grants: (await rows('SELECT count(*)::int AS n FROM gabay.UserVenueGrant'))[0].n,
    });
    await fn({
      db: t.db,
      raw: t.raw,
      seed,
      tenantA,
      tenantB,
      empty,
      inactive,
      venue,
      venuesA,
      venuesB,
      rows,
      counts,
    });
  } finally {
    await t.close();
  }
}

const run = (ctx, auth, input) => provisionAdmin({ db: ctx.db, auth, projectId: PROJECT, input });

/** The refusal a call throws: a StagingAdminRefusal whose message is one plain line. */
async function refusal(promise) {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof StagingAdminRefusal, `a plain refusal, not ${err?.stack ?? err}`);
    assert.ok(!err.message.includes('\n'), 'one line');
    return err.message;
  }
  return assert.fail('expected a refusal');
}

/** The refusal wrote nothing: the same counts in the database, and the fake was not asked to make anything. */
async function assertNothingWritten(ctx, auth, before) {
  assert.deepEqual(await ctx.counts(), before);
  assert.equal(auth.created.length, 0, 'no Firebase user was created');
  assert.ok(!auth.calls.some((c) => c.method === 'generatePasswordResetLink'), 'no link was made');
}

// ------------------------------------------------------------------------------------------------------------------- AC-37

test('AC-37, EC-21: a bad email, @gabay.test, an unknown, inactive or mis-cased role, and every tenant mistake is refused with nothing written', async () => {
  await world(async (ctx) => {
    const before = await ctx.counts();
    await ctx.raw.query(
      `INSERT INTO gabay.Role (Code, Label, IsPlatformRole, IsActive) VALUES ('ZZ_OFF_ROLE', 'Off', FALSE, FALSE)`,
      [],
    );
    const cases = [
      [{ email: '', role: 'VIEWER', tenant: ctx.tenantA.code }, /not an email/],
      [{ email: 'nope', role: 'VIEWER', tenant: ctx.tenantA.code }, /not an email/],
      [{ email: 'a@b', role: 'VIEWER', tenant: ctx.tenantA.code }, /not an email/],
      [{ email: 'two@@x.com', role: 'VIEWER', tenant: ctx.tenantA.code }, /not an email/],
      [
        { email: `${'x'.repeat(250)}@e.com`, role: 'VIEWER', tenant: ctx.tenantA.code },
        /not an email/,
      ],
      [
        { email: 'viewer@gabay.test', role: 'VIEWER', tenant: ctx.tenantA.code },
        /local test accounts/,
      ],
      [
        { email: 'VIEWER@Gabay.TEST', role: 'VIEWER', tenant: ctx.tenantA.code },
        /local test accounts/,
      ],
      [{ email: 'me@example.com', role: 'NOPE', tenant: ctx.tenantA.code }, /not an active role/],
      [
        { email: 'me@example.com', role: 'ZZ_OFF_ROLE', tenant: ctx.tenantA.code },
        /not an active role/,
      ],
      [{ email: 'me@example.com', role: 'viewer', tenant: ctx.tenantA.code }, /not an active role/],
      [
        { email: 'me@example.com', role: 'SUPERADMIN', tenant: ctx.tenantA.code },
        /platform role: it takes no tenant/,
      ],
      [{ email: 'me@example.com', role: 'MALL_ADMIN', tenant: null }, /needs a tenant/],
      [{ email: 'me@example.com', role: 'VIEWER' }, /needs a tenant/],
      [
        { email: 'me@example.com', role: 'MALL_ADMIN', tenant: 'NO_SUCH_TENANT' },
        /not an active tenant/,
      ],
      [
        { email: 'me@example.com', role: 'MALL_ADMIN', tenant: ctx.inactive.code },
        /not an active tenant/,
      ],
    ];
    for (const [input, pattern] of cases) {
      const auth = fakeAdminAuth();
      const message = await refusal(run(ctx, auth, input));
      assert.match(message, pattern, JSON.stringify(input));
      await assertNothingWritten(ctx, auth, before);
      assert.deepEqual(auth.calls, [], 'the fake was not even asked');
    }
  });
});

test('EC-14: a role code that is not in the Role table is refused, never created', async () => {
  await world(async (ctx) => {
    const roles = (await ctx.rows('SELECT count(*)::int AS n FROM gabay.Role'))[0].n;
    await refusal(
      run(ctx, fakeAdminAuth(), {
        email: 'me@example.com',
        role: 'MERCHANT',
        tenant: ctx.tenantA.code,
      }),
    );
    assert.equal((await ctx.rows('SELECT count(*)::int AS n FROM gabay.Role'))[0].n, roles);
  });
});

// ------------------------------------------------------------------------------------------------------- AC-38, AC-39

test('AC-38, AC-39, EC-13: SUPERADMIN gets a password-less Firebase user, an account row and a platform role with no tenant and no grants', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const r = await run(ctx, auth, { email: 'Owner@Example.COM', role: 'SUPERADMIN' });
    assert.equal(r.email, 'owner@example.com', 'lower-cased');
    assert.equal(r.firebaseUser, 'created');
    assert.equal(auth.created.length, 1);
    assert.ok(!('password' in auth.created[0]), 'the Admin SDK is asked for no password');
    assert.equal(auth.created[0].email, 'owner@example.com');
    const user = (
      await ctx.rows(`SELECT * FROM gabay.AppUser WHERE Email = 'owner@example.com'`)
    )[0];
    assert.equal(user.firebaseuid, r.firebaseUid);
    assert.equal(user.displayname, 'owner');
    assert.equal(user.isactive, true);
    assert.equal(user.createdby, null, 'audit columns NULL, as outside a request');
    const role = (
      await ctx.rows(
        'SELECT r.Code AS code, ur.TenantId AS tenantid FROM gabay.UserRole ur JOIN gabay.Role r ON r.RoleId = ur.RoleId WHERE ur.UserId = $1',
        [user.userid],
      )
    )[0];
    assert.deepEqual({ ...role }, { code: 'SUPERADMIN', tenantid: null });
    assert.equal(
      (
        await ctx.rows('SELECT count(*)::int AS n FROM gabay.UserVenueGrant WHERE UserId = $1', [
          user.userid,
        ])
      )[0].n,
      0,
    );
    assert.match(r.link, /^https:\/\//);
    assert.ok(
      summaryLines(r).every((l) => !l.includes(r.link)),
      'the link is not in the summary lines',
    );
    assert.ok(summaryLines(r).some((l) => /no venue grants/.test(l)));
  });
});

test('AC-39: MALL_ADMIN is tenant-wide, so it gets no venue grant', async () => {
  await world(async (ctx) => {
    const r = await run(ctx, fakeAdminAuth(), {
      email: 'mall@example.com',
      role: 'MALL_ADMIN',
      tenant: ctx.tenantA.code,
    });
    assert.equal(r.grantsAdded, 0);
    assert.equal(r.venueCount, null);
    assert.equal(
      (
        await ctx.rows('SELECT count(*)::int AS n FROM gabay.UserVenueGrant WHERE UserId = $1', [
          r.userId,
        ])
      )[0].n,
      0,
    );
  });
});

test('AC-39: VENUE_EDITOR and VIEWER get a grant for every venue the tenant has now, and a re-run after a new venue adds exactly the missing one', async () => {
  await world(async (ctx) => {
    for (const role of ['VENUE_EDITOR', 'VIEWER']) {
      const auth = fakeAdminAuth();
      const email = `${role.toLowerCase()}@example.com`;
      const expected = ctx.venuesA.length; // two venues for the first role, three for the second
      const first = await run(ctx, auth, { email, role, tenant: ctx.tenantA.code });
      assert.equal(first.grantsAdded, expected, role);
      assert.equal(first.venueCount, expected);
      const granted = (
        await ctx.rows(
          'SELECT VenueId AS v FROM gabay.UserVenueGrant WHERE UserId = $1 ORDER BY VenueId',
          [first.userId],
        )
      ).map((x) => x.v);
      assert.deepEqual(granted, ctx.venuesA);
      assert.ok(
        summaryLines(first).some(
          (l) =>
            l.includes(`Venue grants added: ${expected}`) &&
            /run this again after adding one/.test(l),
        ),
      );

      const same = await run(ctx, auth, { email, role, tenant: ctx.tenantA.code });
      assert.equal(same.grantsAdded, 0, 'a repeat adds nothing');
      assert.equal(same.firebaseUser, 'reused');
      assert.equal(same.accountAdded, false);
      assert.equal(same.roleAdded, false);
      assert.notEqual(same.link, first.link, 'a fresh link on every run');
      assert.equal(auth.created.length, 1, 'the Firebase user was made once');

      const added = await ctx.venue(ctx.tenantA);
      const after = await run(ctx, auth, { email, role, tenant: ctx.tenantA.code });
      assert.equal(after.grantsAdded, 1, 'exactly the missing grant');
      const all = (
        await ctx.rows(
          'SELECT VenueId AS v FROM gabay.UserVenueGrant WHERE UserId = $1 ORDER BY VenueId',
          [first.userId],
        )
      ).map((x) => x.v);
      assert.deepEqual(all, [...ctx.venuesA, added]);
      ctx.venuesA.push(added); // the next role starts from three venues
    }
  });
});

test('EC-33: a VENUE_EDITOR of a tenant with no venues gets the role and no grants, and the output says to run again', async () => {
  await world(async (ctx) => {
    const r = await run(ctx, fakeAdminAuth(), {
      email: 'early@example.com',
      role: 'VENUE_EDITOR',
      tenant: ctx.empty.code,
    });
    assert.equal(r.roleAdded, true);
    assert.equal(r.grantsAdded, 0);
    assert.equal(r.venueCount, 0);
    assert.ok(
      summaryLines(r).some(
        (l) => /has no venues yet/.test(l) && /run this again after a venue is added/.test(l),
      ),
    );
  });
});

test('AC-39, AC-40: a VIEWER in one tenant who is MALL_ADMIN in another gets grants only for the first, and the second role is added to the same account', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const email = 'two@example.com';
    const viewer = await run(ctx, auth, { email, role: 'VIEWER', tenant: ctx.tenantA.code });
    const admin = await run(ctx, auth, { email, role: 'MALL_ADMIN', tenant: ctx.tenantB.code });
    assert.equal(admin.userId, viewer.userId, 'one account row');
    assert.equal(admin.accountAdded, false);
    assert.equal(admin.roleAdded, true);
    const grants = await ctx.rows(
      'SELECT TenantId AS t, VenueId AS v FROM gabay.UserVenueGrant WHERE UserId = $1 ORDER BY VenueId',
      [viewer.userId],
    );
    assert.deepEqual(
      grants.map((g) => g.v),
      ctx.venuesA,
      "only the VIEWER tenant's venues",
    );
    assert.ok(grants.every((g) => g.t === ctx.tenantA.tenantId));
    assert.equal(
      (
        await ctx.rows('SELECT count(*)::int AS n FROM gabay.UserRole WHERE UserId = $1', [
          viewer.userId,
        ])
      )[0].n,
      2,
    );
  });
});

test('AC-38: a re-run for the same email and role adds no duplicate row and prints a fresh link', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const input = { email: 'again@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code };
    const one = await run(ctx, auth, input);
    const before = await ctx.counts();
    const two = await run(ctx, auth, input);
    assert.deepEqual(await ctx.counts(), before);
    assert.notEqual(one.link, two.link);
    assert.equal(two.firebaseUser, 'reused');
  });
});

test('EC-21: an address in another case finds the same Firebase user and the same account row', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const first = await run(ctx, auth, {
      email: 'Case@Example.com',
      role: 'MALL_ADMIN',
      tenant: ctx.tenantA.code,
    });
    const second = await run(ctx, auth, {
      email: 'CASE@EXAMPLE.COM',
      role: 'MALL_ADMIN',
      tenant: ctx.tenantA.code,
    });
    assert.equal(second.userId, first.userId);
    assert.equal(auth.created.length, 1);
    assert.equal(second.firebaseUser, 'reused');
  });
});

test('AC-38: the Firebase user that already exists is reused: its UID goes into the new account row', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth({ users: { 'pre@example.com': { uid: 'existing-uid-9' } } });
    const r = await run(ctx, auth, {
      email: 'pre@example.com',
      role: 'VIEWER',
      tenant: ctx.tenantA.code,
    });
    assert.equal(r.firebaseUser, 'reused');
    assert.equal(auth.created.length, 0);
    assert.equal(
      (
        await ctx.rows('SELECT FirebaseUid AS uid FROM gabay.AppUser WHERE UserId = $1', [r.userId])
      )[0].uid,
      'existing-uid-9',
    );
  });
});

// ------------------------------------------------------------------------------------------------------------------- AC-40

test('AC-40: if the Firebase call fails, nothing is written to the database', async () => {
  await world(async (ctx) => {
    for (const method of ['getUserByEmail', 'createUser']) {
      const auth = fakeAdminAuth();
      auth.failWith(
        method,
        Object.assign(new Error('secret sdk text project-123'), { code: 'auth/internal-error' }),
      );
      const before = await ctx.counts();
      const message = await refusal(
        run(ctx, auth, { email: 'fail@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code }),
      );
      assert.match(message, /Firebase did not accept the request/);
      assert.ok(!message.includes('secret sdk text'), 'the SDK text is never shown');
      assert.deepEqual(await ctx.counts(), before);
    }
  });
});

test('AC-40: if the transaction fails after the Firebase user was made, the Firebase user stays, the line says so, and a re-run reuses it', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const failing = {
      query: ctx.db.query,
      withTransaction: async () => {
        throw Object.assign(new Error('constraint text that must not be shown'), { code: '23514' });
      },
    };
    const message = await refusal(
      provisionAdmin({
        db: failing,
        auth,
        projectId: PROJECT,
        input: { email: 'tx@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code },
      }),
    );
    assert.match(message, /none were written/);
    assert.match(message, /Firebase user was made and stays/);
    assert.ok(!message.includes('constraint text'));
    assert.equal(auth.created.length, 1, 'the Firebase user stays');
    assert.ok(
      !auth.calls.some((c) => c.method === 'generatePasswordResetLink'),
      'no link for a failed run',
    );
    const again = await run(ctx, auth, {
      email: 'tx@example.com',
      role: 'MALL_ADMIN',
      tenant: ctx.tenantA.code,
    });
    assert.equal(again.firebaseUser, 'reused');
    assert.equal(auth.created.length, 1);
  });
});

test('AC-40: an account row with this email and a DIFFERENT Firebase UID is refused, and the UID is never overwritten', async () => {
  await world(async (ctx) => {
    await ctx.raw.query(
      `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('old-uid-1', 'clash@example.com', 'clash')`,
      [],
    );
    // The Firebase user exists with another UID.
    const withUser = fakeAdminAuth({ users: { 'clash@example.com': { uid: 'new-uid-2' } } });
    const m1 = await refusal(
      run(ctx, withUser, {
        email: 'clash@example.com',
        role: 'MALL_ADMIN',
        tenant: ctx.tenantA.code,
      }),
    );
    assert.match(m1, /different Firebase UID/);
    // No Firebase user at all: nothing is created for a row that belongs to another sign-in.
    const none = fakeAdminAuth();
    const m2 = await refusal(
      run(ctx, none, { email: 'clash@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code }),
    );
    assert.match(m2, /belongs to a different sign-in/);
    assert.equal(none.created.length, 0);
    assert.equal(
      (
        await ctx.rows(
          `SELECT FirebaseUid AS uid FROM gabay.AppUser WHERE Email = 'clash@example.com'`,
        )
      )[0].uid,
      'old-uid-1',
    );
    assert.equal(
      (
        await ctx.rows(
          `SELECT count(*)::int AS n FROM gabay.UserRole ur JOIN gabay.AppUser u ON u.UserId = ur.UserId WHERE u.Email = 'clash@example.com'`,
        )
      )[0].n,
      0,
    );
  });
});

test('AC-40: a unique violation from two runs at once is read as "already there": a clean result, never a stack', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const racing = {
      query: ctx.db.query,
      withTransaction: async () => {
        // The other run's rows landed first.
        await ctx.raw.query(
          `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('fb-uid-1', 'race@example.com', 'race')`,
          [],
        );
        throw Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
        });
      },
    };
    const r = await provisionAdmin({
      db: racing,
      auth,
      projectId: PROJECT,
      input: { email: 'race@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code },
    });
    assert.equal(r.alreadyThere, true);
    assert.ok(summaryLines(r).some((l) => /Another run added these rows/.test(l)));
    assert.match(r.link, /^https:\/\//);
  });
});

test('AC-40: two real runs for one email, one after the other through the same tables, never raise a unique violation (the inserts are conflict-safe)', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    const input = { email: 'twice@example.com', role: 'VIEWER', tenant: ctx.tenantA.code };
    await run(ctx, auth, input);
    // Remove the account lookup the second run would make: it must still end with the same single rows.
    const r = await run(ctx, auth, input);
    assert.equal(r.alreadyThere, false);
    assert.equal(
      (
        await ctx.rows(
          `SELECT count(*)::int AS n FROM gabay.AppUser WHERE Email = 'twice@example.com'`,
        )
      )[0].n,
      1,
    );
  });
});

test('AC-40: a link that cannot be made after the rows were written says so, and the rows stay', async () => {
  await world(async (ctx) => {
    const auth = fakeAdminAuth();
    auth.failWith(
      'generatePasswordResetLink',
      Object.assign(new Error('raw text'), { code: 'auth/internal-error' }),
    );
    const message = await refusal(
      run(ctx, auth, { email: 'link@example.com', role: 'MALL_ADMIN', tenant: ctx.tenantA.code }),
    );
    assert.match(message, /rows are written/);
    assert.match(message, /Run this again to get a link/);
    assert.ok(!message.includes('raw text'));
    assert.equal(
      (
        await ctx.rows(
          `SELECT count(*)::int AS n FROM gabay.AppUser WHERE Email = 'link@example.com'`,
        )
      )[0].n,
      1,
    );
  });
});

// ------------------------------------------------------------------------------------------------------- AC-57, EC-34

test('AC-57, EC-34: each way the login or the project can fail is one plain line naming the cause and the fix, with nothing written and no raw text', async () => {
  const RAW = 'RAW-SDK-TEXT-with-token-ya29.secret and C:\\Users\\me\\key.json';
  const cases = [
    [
      Object.assign(new Error(`Could not load the default credentials. ${RAW}`), {
        code: 'app/invalid-credential',
      }),
      /No Google login was found.*gcloud auth application-default login/,
    ],
    [
      Object.assign(
        new Error(
          `Credential implementation provided to initializeApp() failed to fetch a valid Google OAuth2 access token with the following error: invalid_grant ${RAW}`,
        ),
        { code: 'app/invalid-credential' },
      ),
      /Your Google login has expired.*gcloud auth application-default login/,
    ],
    [
      Object.assign(new Error(`Reauthentication needed. ${RAW}`), {
        code: 'app/invalid-credential',
      }),
      /Your Google login has expired/,
    ],
    [
      Object.assign(new Error(`no project ${RAW}`), { code: 'auth/project-not-found' }),
      /project "gabay-staging" was not found.*STAGING_PROJECT_ID/,
    ],
    [
      Object.assign(new Error(`CONFIGURATION_NOT_FOUND ${RAW}`), {
        code: 'auth/configuration-not-found',
      }),
      /Authentication is not set up.*Get started.*Email\/Password/,
    ],
    [
      Object.assign(new Error(`off ${RAW}`), { code: 'auth/operation-not-allowed' }),
      /Email\/Password sign-in method is switched off/,
    ],
    [
      Object.assign(
        new Error(
          `Credential implementation provided to initializeApp() via the "credential" property has insufficient permission ${RAW}`,
        ),
        { code: 'auth/insufficient-permission' },
      ),
      /may not manage users.*Owner/,
    ],
    [
      Object.assign(
        new Error(
          `Your application is authenticating by using local Application Default Credentials. The identitytoolkit.googleapis.com API requires a quota project, which is not set by default ${RAW}`,
        ),
        { code: 'auth/internal-error' },
      ),
      /set-quota-project gabay-staging/,
    ],
    [
      Object.assign(new Error(`strange ${RAW}`), { code: 'auth/quota-exceeded' }),
      /did not accept the request \(auth\/quota-exceeded\)/,
    ],
    [new Error(`totally unknown ${RAW}`), /did not accept the request\. Nothing was written/],
  ];
  await world(async (ctx) => {
    for (const method of ['getUserByEmail', 'createUser']) {
      for (const [error, pattern] of cases) {
        const auth = fakeAdminAuth();
        auth.failWith(method, error);
        const before = await ctx.counts();
        const message = await refusal(
          run(ctx, auth, {
            email: 'who@example.com',
            role: 'MALL_ADMIN',
            tenant: ctx.tenantA.code,
          }),
        );
        assert.match(message, pattern, `${method}: ${error.message.slice(0, 50)}`);
        for (const raw of ['RAW-SDK-TEXT', 'ya29', 'key.json'])
          assert.ok(!message.includes(raw), `${raw} is never printed`);
        assert.deepEqual(await ctx.counts(), before, 'nothing was written');
      }
    }
  });
});

test('AC-57: describeAuthFailure names the project in its lines and never throws on a strange value', () => {
  assert.match(describeAuthFailure(null, PROJECT), /did not accept the request/);
  assert.match(describeAuthFailure('text', PROJECT), /did not accept the request/);
  assert.match(
    describeAuthFailure({ code: 42, message: 7 }, PROJECT),
    /did not accept the request/,
  );
  assert.match(describeAuthFailure({ code: 'auth/project-not-found' }, 'other-id'), /other-id/);
});
