// Test support (not a test file): spec/SEC-1.md r2's two tables, written ONCE for the SEC-1 tests (plan/SEC-1.md 1.0
// step 7: "computed from T1/T2 encoded once in the test"). A changed grant or route key in the code or the migration
// fails the tests that read these; a change to the spec changes this file and nothing else.
//
//   T1          the 14 guarded routes: number, method, path (with :venueId, :name, :id, :key), key, action, venue scope
//   T2          the default grants: role -> key -> 'CRUD' with '-' for false (SUPERADMIN has no rows and bypasses)
//   T2_LINES    T2 as sorted text lines "ROLE key CRUD" (what migration0002 writes, read back the same way)
//   allows(role, route)   what T1 and T2 say a role may do on a route (SUPERADMIN: everything)
'use strict';

/** spec section 2.3 (T1). `scope`: 'id' (the route names a venue), 'list' (the list is filtered), null (no venue). */
const T1 = Object.freeze(
  [
    [1, 'GET', '/api/lookups/:name', 'lookups', 'read', null],
    [2, 'GET', '/api/lookups/:name/:id', 'lookups', 'read', null],
    [3, 'GET', '/api/venues', 'venues', 'read', 'list'],
    [4, 'POST', '/api/venues', 'venues', 'create', null],
    [5, 'GET', '/api/venues/:venueId', 'venues', 'read', 'id'],
    [6, 'PUT', '/api/venues/:venueId', 'venues', 'update', 'id'],
    [7, 'GET', '/api/venues/:venueId/map', 'venue-maps', 'read', 'id'],
    [8, 'PUT', '/api/venues/:venueId/map/draft', 'venue-maps', 'update', 'id'],
    [9, 'POST', '/api/venues/:venueId/map/backdrops', 'venue-maps', 'create', 'id'],
    [10, 'GET', '/api/venues/:venueId/map/backdrops/:key', 'venue-maps', 'read', 'id'],
    [11, 'POST', '/api/venues/:venueId/map/clear', 'venue-maps', 'delete', 'id'],
    [12, 'POST', '/api/venues/:venueId/map/publish', 'venue-versions', 'create', 'id'],
    [13, 'POST', '/api/venues/:venueId/map/rollback', 'venue-versions', 'create', 'id'],
    [14, 'GET', '/api/venue-maps/catalog', 'venue-maps', 'read', null],
  ].map(([n, method, path, key, action, scope]) =>
    Object.freeze({ n, method, path, key, action, scope }),
  ),
);

/** spec section 2.4 (T2), the r2 cell included: venue-maps Delete for VENUE_EDITOR (L186 Q1 (a)). */
const T2 = Object.freeze({
  MALL_ADMIN: Object.freeze({
    lookups: '-R--',
    venues: 'CRU-',
    'venue-maps': 'CRUD',
    'venue-versions': 'C---',
  }),
  VENUE_EDITOR: Object.freeze({
    lookups: '-R--',
    venues: '-R--',
    'venue-maps': 'CRUD',
    'venue-versions': '----',
  }),
  VIEWER: Object.freeze({
    lookups: '-R--',
    venues: '-R--',
    'venue-maps': '-R--',
    'venue-versions': '----',
  }),
});

const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const T2_LINES = Object.freeze(
  Object.entries(T2)
    .flatMap(([role, keys]) => Object.entries(keys).map(([key, crud]) => `${role} ${key} ${crud}`))
    .sort(byCodeUnits),
);

const LETTER = Object.freeze({ create: 'C', read: 'R', update: 'U', delete: 'D' });

/** True when T2 lets `role` do `route.action` on `route.key`; SUPERADMIN bypasses (PH2 Q8). */
function allows(role, route) {
  if (role === 'SUPERADMIN') return true;
  const crud = T2[role]?.[route.key];
  return typeof crud === 'string' && crud.includes(LETTER[route.action]);
}

/** T2's flags for `role` as GET /api/me shows them: { key: { create, read, update, delete } }. */
function mePermissions(role) {
  return Object.fromEntries(
    Object.entries(T2[role]).map(([key, crud]) => [
      key,
      {
        create: crud[0] === 'C',
        read: crud[1] === 'R',
        update: crud[2] === 'U',
        delete: crud[3] === 'D',
      },
    ]),
  );
}

module.exports = { T1, T2, T2_LINES, allows, mePermissions, byCodeUnits };
