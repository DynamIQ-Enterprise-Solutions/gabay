// route-guard-order (SEC-2 spec AC-41 to AC-48; plan step 4): throwaway route trees, a bad sample and a good sample for
// every rule. Each tree has functions/src/routes/api.js (the root, mounted at /api) and the files it mounts.
'use strict';

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { lint, at, tree } = require('./helper');
const { RANK_TABLE } = require('../route-guard-order');

const NAME = 'route-guard-order';
const RUN = path.resolve(__dirname, '..', 'run.js');
const REPO = path.resolve(__dirname, '..', '..', '..');
const API = 'functions/src/routes/api.js';
const THING = 'functions/src/routes/thing.js';

/** An api.js that mounts ./thing under /things behind `chain` (a JS array literal's elements). */
const api = (
  chain = 'auth, requireAdminUser, tenantContext, roleGuard',
  extra = '',
) => `'use strict';
const express = require('express');
const { thingRoutes } = require('./thing');
function apiRoutes({ auth, tenantContext, roleGuard, guards }) {
  const router = express.Router();
  const tenantChain = [${chain}];
  ${extra}
  router.use('/things', ...tenantChain, thingRoutes(guards));
  return router;
}
module.exports = { apiRoutes };
`;

/** A route file: `body` is placed inside the function, after `const router = ...`. */
const routes = (body, head = '') => `'use strict';
const express = require('express');
${head}
function thingRoutes({ requirePermission, requireVenueInScope, venueListScope }) {
  const router = express.Router();
  ${body}
  return router;
}
module.exports = { thingRoutes };
`;

const GOOD_BODY = `router.get('/', requirePermission(['k'], 'read'), venueListScope, validate({}), async (req, res) => { res.json({}); });
  router.post('/', requirePermission(['k'], 'create'), validate({}), async (req, res) => { res.json({}); });
  router.put('/:venueId', requirePermission(['k'], 'update'), requireVenueInScope, validate({}), async (req, res) => { res.json({}); });
  router.delete('/:venueId', requirePermission(['k'], 'delete'), requireVenueInScope, validate({}), async (req, res) => { res.json({}); });`;

const run = (files, extra) => lint(NAME, files, extra);
const messages = (violations) => violations.map((v) => v.message);

test('route-guard-order: a good tree gives no violation', () => {
  assert.deepEqual(run({ [API]: api(), [THING]: routes(GOOD_BODY) }), []);
});

test('route-guard-order: the rank table is one exported constant with the names SEC-1 built', () => {
  assert.deepEqual(
    { ...RANK_TABLE },
    {
      auth: 1,
      requireAdminUser: 1,
      tenantContext: 2,
      requireRole: 3,
      roleGuard: 3,
      requirePermission: 4,
      requireVenueInScope: 4.5,
      venueListScope: 4.5,
      validate: 5,
    },
  );
  assert.ok(Object.isFrozen(RANK_TABLE));
});

test('route-guard-order: a tree with no route files is nothing to read', () => {
  assert.deepEqual(run({ 'functions/src/app.js': '// nothing\n' }), []);
});

// ----------------------------------------------------------------------------------------------- the missing steps

test('route-guard-order: each missing step is named, with the method, the full path and the line', () => {
  const noAuth = run({
    [API]: api('tenantContext, roleGuard'),
    [THING]: routes(GOOD_BODY),
  });
  assert.ok(messages(noAuth).includes('GET /api/things: missing auth'));
  assert.ok(messages(noAuth).includes('PUT /api/things/:venueId: missing auth'));

  const noTenant = run({
    [API]: api('auth, roleGuard'),
    [THING]: routes(GOOD_BODY),
  });
  assert.ok(messages(noTenant).includes('POST /api/things: missing tenantContext'));

  const noRole = run({
    [API]: api('auth, tenantContext'),
    [THING]: routes(GOOD_BODY),
  });
  assert.deepEqual(
    messages(noRole).filter((m) => m.startsWith('GET ')),
    [],
    'a role guard is not required on a get',
  );
  for (const method of [
    'POST /api/things',
    'PUT /api/things/:venueId',
    'DELETE /api/things/:venueId',
  ]) {
    assert.ok(
      messages(noRole).includes(`${method}: missing a role guard (requireRole)`),
      `${method} needs a role guard`,
    );
  }

  const noPermission = run({
    [API]: api(),
    [THING]: routes(`router.get('/', validate({}), async (req, res) => { res.json({}); });`),
  });
  assert.deepEqual(messages(noPermission), [
    'GET /api/things: missing a permission guard (requirePermission)',
  ]);
  assert.equal(noPermission[0].file, THING);
  assert.equal(noPermission[0].line, 6);

  const noValidate = run({
    [API]: api(),
    [THING]: routes(
      `router.get('/', requirePermission(['k'], 'read'), async (req, res) => { res.json({}); });`,
    ),
  });
  assert.deepEqual(messages(noValidate), ['GET /api/things: missing validate']);
});

test('route-guard-order: a no-input route still needs validate() (DC-18)', () => {
  const bad = routes(
    `router.get('/catalog', requirePermission(['k'], 'read'), async (req, res) => {});`,
  );
  assert.deepEqual(messages(run({ [API]: api(), [THING]: bad })), [
    'GET /api/things/catalog: missing validate',
  ]);
  const good = routes(
    `router.get('/catalog', requirePermission(['k'], 'read'), validate(), async (req, res) => {});`,
  );
  assert.deepEqual(run({ [API]: api(), [THING]: good }), []);
});

// ------------------------------------------------------------------------------------------- the swapped neighbours

test('route-guard-order: each swapped pair of neighbouring steps is a violation', () => {
  const swaps = [
    ['tenantContext, auth, requireAdminUser, roleGuard', 'auth must come before tenantContext'],
    ['auth, requireAdminUser, roleGuard, tenantContext', 'roleGuard must come before'],
  ];
  // the second line reads "tenantContext must come before roleGuard" only if rank 2 < 3: here roleGuard (3) is first
  const first = run({ [API]: api(swaps[0][0]), [THING]: routes(GOOD_BODY) });
  assert.ok(
    messages(first).some((m) => m.includes('auth must come before tenantContext')),
    messages(first).join('\n'),
  );
  const second = run({ [API]: api(swaps[1][0]), [THING]: routes(GOOD_BODY) });
  assert.ok(
    messages(second).some((m) => m.includes('tenantContext must come before roleGuard')),
    messages(second).join('\n'),
  );

  const validateFirst = run({
    [API]: api(),
    [THING]: routes(
      `router.get('/', validate({}), requirePermission(['k'], 'read'), async (req, res) => {});`,
    ),
  });
  assert.deepEqual(messages(validateFirst), [
    'GET /api/things: requirePermission must come before validate',
  ]);

  const permissionFirst = run({
    [API]: api('auth, requireAdminUser, tenantContext'),
    [THING]: routes(
      `router.post('/', requirePermission(['k'], 'create'), requireRole(['A']), validate({}), async (req, res) => {});`,
    ),
  });
  assert.ok(
    messages(permissionFirst).some((m) =>
      m.includes('requireRole must come before requirePermission'),
    ),
  );
});

test('route-guard-order: nothing unranked runs before a ranked step', () => {
  const bad = routes(
    `router.post('/up', uploadParser, requirePermission(['k'], 'create'), validate({}), async (req, res) => {});`,
  );
  const found = messages(run({ [API]: api(), [THING]: bad }));
  assert.ok(
    found.some((m) => m.includes('requirePermission comes after uploadParser')),
    found.join('\n'),
  );
  // after every ranked step an unranked one is the upload's own shape and fine
  const good = routes(
    `router.post('/up', requirePermission(['k'], 'create'), validate({}), venueFirst, uploadParser(upload.single('f')), async (req, res) => {});`,
  );
  assert.deepEqual(run({ [API]: api(), [THING]: good }), []);
});

// ---------------------------------------------------------------------------------------------------- the venue scope

test('route-guard-order: the venue scope before validate is good and after it is a violation', () => {
  const before = routes(
    `router.get('/:venueId', requirePermission(['k'], 'read'), requireVenueInScope, validate({}), async (req, res) => {});`,
  );
  assert.deepEqual(run({ [API]: api(), [THING]: before }), []);
  const after = routes(
    `router.get('/:venueId', requirePermission(['k'], 'read'), validate({}), requireVenueInScope, async (req, res) => {});`,
  );
  assert.deepEqual(messages(run({ [API]: api(), [THING]: after })), [
    'GET /api/things/:venueId: requireVenueInScope must come before validate',
  ]);
});

test('route-guard-order: a :venueId route needs requireVenueInScope; venueListScope alone is not it', () => {
  const missing = routes(
    `router.get('/:venueId', requirePermission(['k'], 'read'), validate({}), async (req, res) => {});`,
  );
  assert.deepEqual(messages(run({ [API]: api(), [THING]: missing })), [
    'GET /api/things/:venueId: missing the venue scope (requireVenueInScope)',
  ]);
  const listOnly = routes(
    `router.get('/:venueId', requirePermission(['k'], 'read'), venueListScope, validate({}), async (req, res) => {});`,
  );
  assert.deepEqual(messages(run({ [API]: api(), [THING]: listOnly })), [
    'GET /api/things/:venueId: missing the venue scope (requireVenueInScope)',
  ]);
  // The venue scope is allowed, never required, on a route with no :venueId (the list), and the list scope is fine there.
  const list = routes(
    `router.get('/', requirePermission(['k'], 'read'), venueListScope, validate({}), async (req, res) => {});
  router.get('/plain', requirePermission(['k'], 'read'), validate({}), async (req, res) => {});`,
  );
  assert.deepEqual(run({ [API]: api(), [THING]: list }), []);
});

// ------------------------------------------------------------------------------------------------------ fails closed

test('route-guard-order: patch, all and route() are refused (the audit covers POST, PUT and DELETE only)', () => {
  const bad =
    routes(`router.patch('/x', requirePermission(['k'], 'update'), validate({}), async (req, res) => {});
  router.all('/y', requirePermission(['k'], 'read'), validate({}), async (req, res) => {});
  router.route('/z').get(async (req, res) => {});`);
  const found = run({ [API]: api(), [THING]: bad });
  assert.equal(found.length, 3, messages(found).join('\n'));
  assert.ok(found[0].message.includes('router.patch'));
  assert.ok(found[0].message.includes('audit trail'));
  assert.ok(found[1].message.includes('router.all'));
  assert.ok(found[2].message.includes('router.route'));
  assert.deepEqual(at(found), [`${THING}:6:${NAME}`, `${THING}:7:${NAME}`, `${THING}:8:${NAME}`]);
});

test('route-guard-order: a registration in a loop is refused', () => {
  const forLoop = routes(`for (const p of ['a', 'b']) {
    router.get(p, requirePermission(['k'], 'read'), validate({}), async (req, res) => {});
  }`);
  assert.ok(
    messages(run({ [API]: api(), [THING]: forLoop })).some((m) => m.includes('inside a loop')),
  );
  const each = routes(`['a', 'b'].forEach((p) => {
    router.get('/' + p, requirePermission(['k'], 'read'), validate({}), async (req, res) => {});
  });`);
  assert.ok(
    messages(run({ [API]: api(), [THING]: each })).some((m) => m.includes('inside a loop')),
  );
});

test('route-guard-order: a spread it cannot resolve and a variable path are refused', () => {
  const spread = routes(
    `router.get('/', ...others, requirePermission(['k'], 'read'), validate({}), async (req, res) => {});`,
  );
  assert.ok(
    messages(run({ [API]: api(), [THING]: spread })).some((m) =>
      m.includes('the spread ...others cannot be resolved'),
    ),
  );
  const varPath = routes(
    `router.get(somePath, requirePermission(['k'], 'read'), validate({}), async (req, res) => {});`,
  );
  assert.ok(
    messages(run({ [API]: api(), [THING]: varPath })).some((m) =>
      m.includes('the path is not a string literal'),
    ),
  );
  // a spread of a const array declared once is read (DC-36)
  const ok = routes(`const guards = [requirePermission(['k'], 'read'), validate({})];
  router.get('/', ...guards, async (req, res) => {});`);
  assert.deepEqual(run({ [API]: api(), [THING]: ok }), []);
  // declared twice: not resolvable
  const twice = routes(`const guards = [requirePermission(['k'], 'read'), validate({})];
  const guards2 = 1; const guards3 = 2;
  router.get('/', ...guards, async (req, res) => {});
  { const guards = []; }`);
  assert.ok(
    messages(run({ [API]: api(), [THING]: twice })).some((m) => m.includes('cannot be resolved')),
  );
});

test('route-guard-order: a const holding one ranked call is read (DC-36: canRead)', () => {
  const ok = routes(`const canRead = requirePermission(['k'], 'read');
  router.get('/', canRead, validate({}), async (req, res) => {});`);
  assert.deepEqual(run({ [API]: api(), [THING]: ok }), []);
});

test('route-guard-order: a mounted router it cannot resolve to a file is refused', () => {
  const held = api().replace('thingRoutes(guards)', 'someRouterVariable');
  assert.ok(
    messages(run({ [API]: held, [THING]: routes(GOOD_BODY) })).some((m) =>
      m.includes('cannot be resolved to a route file'),
    ),
  );
  const unknownCall = api().replace('thingRoutes(guards)', 'buildRouter(guards)');
  assert.ok(
    messages(run({ [API]: unknownCall, [THING]: routes(GOOD_BODY) })).some((m) =>
      m.includes('cannot be resolved'),
    ),
  );
  const missingFile = api().replace("'./thing'", "'./gone'");
  assert.ok(
    messages(run({ [API]: missingFile, [THING]: routes(GOOD_BODY) })).some((m) =>
      m.includes('does not exist'),
    ),
  );
});

test('route-guard-order: a route file no mount reaches is a violation (EC-37)', () => {
  const found = run({
    [API]: api(),
    [THING]: routes(GOOD_BODY),
    'functions/src/routes/orphan.js': routes(`router.get('/', async (req, res) => {});`),
  });
  assert.deepEqual(at(found), [`functions/src/routes/orphan.js:1:${NAME}`]);
  assert.match(found[0].message, /not mounted by any router/);
});

test('route-guard-order: a missing routes/api.js is a violation, not a pass', () => {
  const found = run({ [THING]: routes(GOOD_BODY) });
  assert.ok(found.length >= 1);
  assert.ok(found.some((v) => /api\.js is missing/.test(v.message)));
});

// ---------------------------------------------------------------------------------------------------- the exemptions

test('route-guard-order: // guard-exempt: <reason> above a mount or a route skips the rule for it', () => {
  const exemptMount = api(
    'auth',
    '// guard-exempt: public probe\n  router.use(thingRoutes(guards));',
  ).replace("router.use('/things', ...tenantChain, thingRoutes(guards));", '');
  const bare = routes(`router.get('/health', async (req, res) => { res.json({}); });`);
  assert.deepEqual(run({ [API]: exemptMount, [THING]: bare }), []);
  const exemptRoute = routes(`// guard-exempt: the self-service route
  router.get('/me', async (req, res) => { res.json({}); });`);
  assert.deepEqual(run({ [API]: api(), [THING]: exemptRoute }), []);
});

test('route-guard-order: an empty or missing exemption reason is a violation, and a missing one exempts nothing', () => {
  const empty = routes(`// guard-exempt:
  router.get('/me', async (req, res) => { res.json({}); });`);
  const found = run({ [API]: api(), [THING]: empty });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /needs a reason/);
  const none = routes(`// guard-exempt
  router.get('/me', async (req, res) => { res.json({}); });`);
  assert.ok(
    messages(run({ [API]: api(), [THING]: none })).some((m) => m.includes('missing validate')),
  );
});

// ---------------------------------------------------------------------------------------------- reading what is there

test('route-guard-order: a three-file tree inherits the chain all the way down (AC-42)', () => {
  const deep = `'use strict';
const express = require('express');
function leafRoutes({ requirePermission, requireVenueInScope }) {
  const router = express.Router({ mergeParams: true });
  router.post('/publish', requirePermission(['k'], 'create'), requireVenueInScope, validate({}), async (req, res) => {});
  router.get('/bare', async (req, res) => {});
  return router;
}
module.exports = { leafRoutes };
`;
  const middle = routes(
    `router.use('/:venueId/map', leafRoutes({ guards }));`,
    `const { leafRoutes } = require('./leaf');`,
  );
  const found = run({
    [API]: api(),
    [THING]: middle,
    'functions/src/routes/leaf.js': deep,
  });
  assert.deepEqual(
    messages(found).sort(),
    [
      'GET /api/things/:venueId/map/bare: missing a permission guard (requirePermission)',
      'GET /api/things/:venueId/map/bare: missing the venue scope (requireVenueInScope)',
      'GET /api/things/:venueId/map/bare: missing validate',
    ].sort(),
  );
  assert.ok(found.every((v) => v.file === 'functions/src/routes/leaf.js' && v.line === 6));
  // the chain of the first mount is inherited: dropping tenantContext there fails the deepest route too
  const noTenant = run({
    [API]: api('auth, requireAdminUser, roleGuard'),
    [THING]: middle,
    'functions/src/routes/leaf.js': deep,
  });
  assert.ok(
    messages(noTenant).includes('POST /api/things/:venueId/map/publish: missing tenantContext'),
  );
});

test('route-guard-order: a locally defined guard is not the real one (EC-35)', () => {
  const fake = routes(
    `router.get('/', requirePermission(['k'], 'read'), validate({}), async (req, res) => {});`,
    `function requirePermission() { return (req, res, next) => next(); }
const validate = () => (req, res, next) => next();`,
  );
  const found = run({ [API]: api(), [THING]: fake });
  assert.equal(found.length, 2);
  assert.ok(found.every((v) => /is defined in this route file/.test(v.message)));
  assert.deepEqual(found.map((v) => v.line).sort(), [3, 4]);
});

test('route-guard-order: a guard name in a comment or a string is not a guard (EC-35)', () => {
  const body = `// requirePermission(['k'], 'read') and validate({}) are mentioned here, not used
  router.get('/', async (req, res) => { res.json('requirePermission validate'); /* validate({}) */ });`;
  const found = run({ [API]: api(), [THING]: routes(body) });
  assert.deepEqual(messages(found), [
    'GET /api/things: missing a permission guard (requirePermission)',
    'GET /api/things: missing validate',
  ]);
});

test('route-guard-order: a handler with commas, strings, a template and braces does not confuse the argument split (EC-36)', () => {
  const body = `router.get('/', requirePermission(['k'], 'read'), validate({}), async (req, res) => {
    const text = 'a, b, (c';
    const t = \`x, \${req.a}, y\`;
    const obj = { a: [1, 2, 3], b: { c: ')' } };
    res.json({ text, t, obj });
  });
  router.post('/', requirePermission(['k'], 'create'), validate({ body: z.object({ a: z.string(), b: [1, 2] }) }), async (req, res) => {});`;
  assert.deepEqual(run({ [API]: api(), [THING]: routes(body) }), []);
});

// ------------------------------------------------------------------------------------------------------- --files mode

test('route-guard-order: --files reports the staged file and any route reached through a staged mount (AC-47)', () => {
  const files = {
    [API]: api(),
    [THING]: routes(`router.get('/', async (req, res) => {});`),
  };
  // the sub-router is staged, its mount (api.js) is not: its own violations are reported
  assert.equal(run(files, { files: [THING] }).length, 2);
  // neither is staged: nothing is reported
  assert.deepEqual(run(files, { files: ['functions/src/app.js'] }), []);
  // only the MOUNT is staged: the routes reached through it are checked (a chain change there can break them)
  assert.equal(run(files, { files: [API] }).length, 2);
  // a staged change to the lint itself widens to every route
  const widened = run(
    { ...files, 'tools/lint/route-guard-order.js': '// staged\n' },
    {
      files: ['tools/lint/route-guard-order.js'],
    },
  );
  assert.equal(widened.length, 2);
});

// ------------------------------------------------------------------------------------------------- the real repository

test('route-guard-order: the real repository gives 0 violations (AC-46)', () => {
  const r = spawnSync(process.execPath, [RUN, NAME, '--root', REPO], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok\s+route-guard-order \(\d+ files\)/);
});

test('route-guard-order: run.js over a bad tree exits non-zero and names the file and the line', () => {
  const root = tree({
    [API]: api(),
    [THING]: routes(`router.get('/', async (req, res) => {});`),
    'db/schema.sql': '-- none\n',
  });
  try {
    const r = spawnSync(process.execPath, [RUN, NAME, '--root', root, '--allow-partial'], {
      encoding: 'utf8',
    });
    assert.notEqual(r.status, 0);
    assert.match(
      r.stdout,
      /functions\/src\/routes\/thing\.js:6: route-guard-order: GET \/api\/things: missing/,
    );
    assert.match(r.stdout, /FAIL route-guard-order/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------- review: fail closed on what it cannot read

/** A route file with `decl` as the router's declaration and `body` after it; ends with `return router;`. */
const withRouter = (decl, body) => `'use strict';
const express = require('express');
const { Router } = require('express');
function thingRoutes({ requirePermission }) {
  ${decl}
  ${body}
  return router;
}
module.exports = { thingRoutes };
`;
const UNGUARDED = "router.post('/x', async (req, res) => res.json({}));";

test('route-guard-order: every way of making a router is read (Router(), new express.Router(), require(...).Router())', () => {
  for (const decl of [
    'const router = express.Router();',
    'const router = Router();',
    'const router = new express.Router();',
    "const router = require('express').Router();",
    'let router = express.Router({ mergeParams: true });',
  ]) {
    const found = run({ [API]: api(), [THING]: withRouter(decl, UNGUARDED) });
    assert.deepEqual(
      messages(found),
      [
        'POST /api/things/x: missing a permission guard (requirePermission)',
        'POST /api/things/x: missing validate',
      ],
      decl,
    );
  }
});

test('route-guard-order: a reached route file with no router it recognises is a violation', () => {
  const none = `'use strict';
function thingRoutes() {
  return buildRouterSomewhere();
}
module.exports = { thingRoutes };
`;
  const found = run({ [API]: api(), [THING]: none });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /no router is recognised/);
  // a router that is made but not assigned to a const
  const unassigned = `'use strict';
const express = require('express');
function thingRoutes() {
  return express.Router();
}
module.exports = { thingRoutes };
`;
  assert.ok(messages(run({ [API]: api(), [THING]: unassigned })).length >= 1);
  // an exempt mount may hold a file the linter reads nothing from
  const exempt = api(
    'auth',
    '// guard-exempt: public probe\n  router.use(thingRoutes(guards));',
  ).replace("router.use('/things', ...tenantChain, thingRoutes(guards));", '');
  assert.deepEqual(run({ [API]: exempt, [THING]: none }), []);
});

test('route-guard-order: an alias of the router is refused', () => {
  const found = run({
    [API]: api(),
    [THING]: withRouter(
      'const router = express.Router(); const r = router;',
      "r.post('/x', async (req, res) => res.json({}));",
    ),
  });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /router is used in a way that cannot be read/);
});

test('route-guard-order: a computed member is refused', () => {
  const found = run({
    [API]: api(),
    [THING]: withRouter(
      'const router = express.Router();',
      "router['post']('/x', async (req, res) => res.json({}));",
    ),
  });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /router is used in a way that cannot be read/);
});

test('route-guard-order: head, options, purge, param and every other method of the router are refused', () => {
  for (const method of [
    'head',
    'options',
    'purge',
    'param',
    'checkout',
    'copy',
    'lock',
    'search',
    'mkcol',
  ]) {
    const found = run({
      [API]: api(),
      [THING]: withRouter(
        'const router = express.Router();',
        `router.${method}('/x', async (req, res) => res.end());`,
      ),
    });
    assert.equal(found.length, 1, method);
    assert.ok(found[0].message.startsWith(`router.${method}(...) is not allowed`), method);
  }
});

test('route-guard-order: a route registered in a helper that takes the router is refused', () => {
  const found = run({
    [API]: api(),
    [THING]: withRouter(
      "const router = express.Router(); function add(r) { r.post('/x', async (req, res) => res.json({})); }",
      'add(router);',
    ),
  });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /passed to a function/);
});

test('route-guard-order: a router property read and `return router` are told apart', () => {
  const read = withRouter('const router = express.Router();', 'const n = router.stack.length;');
  assert.equal(run({ [API]: api(), [THING]: read }).length, 1);
  assert.deepEqual(run({ [API]: api(), [THING]: routes(GOOD_BODY) }), []);
});
