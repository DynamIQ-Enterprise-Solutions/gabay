// The names the guards use (SEC-1; spec/SEC-1.md r2 sections 2.3 and 2.4, AC-13, AC-26, AC-38; DC-12, DC-14). One module,
// so a guard can only name a key that exists here, and sec1.routeKeys.test.js ties these keys to the PermissionRoute
// rows migration 0002 writes, in both directions (SEC-2's route-guard-order lint checks the order, not the names).
//
//   ROUTE_KEYS              the PermissionRoute.RouteKey of each guarded route group (T1). A new route group adds its
//                           key here and its row and default grants by its own migration
//   ACTIONS                 the four bits of a permission row (standard §3.4: route x Create/Read/Update/Delete)
//   ADMIN_ROLE_CODES        the four admin roles of L41: the role guard's list on every admin route (DC-1: the closed-
//                           role-set floor; the permission rows make the distinctions between them)
//   TENANT_WIDE_ROLE_CODES  the roles that see every venue of the named tenant (L186 Q2 (a); L41's scope column: "one
//                           tenant" for MALL_ADMIN, the platform for SUPERADMIN). The others need a UserVenueGrant row
//                           per venue. A server policy, not a client option list (DC-14): it is replaced by a Role
//                           column when next release's MERCHANT, UNIT and MAINTENANCE roles are specified
'use strict';

const ROUTE_KEYS = Object.freeze({
  lookups: 'lookups',
  venues: 'venues',
  venueMaps: 'venue-maps',
  venueVersions: 'venue-versions',
});

const ACTIONS = Object.freeze(['create', 'read', 'update', 'delete']);

const ADMIN_ROLE_CODES = Object.freeze(['SUPERADMIN', 'MALL_ADMIN', 'VENUE_EDITOR', 'VIEWER']);

const TENANT_WIDE_ROLE_CODES = Object.freeze(['SUPERADMIN', 'MALL_ADMIN']);

/** Every route key, as a list (what a guard may name). */
const ROUTE_KEY_LIST = Object.freeze(Object.values(ROUTE_KEYS));

module.exports = {
  ROUTE_KEYS,
  ROUTE_KEY_LIST,
  ACTIONS,
  ADMIN_ROLE_CODES,
  TENANT_WIDE_ROLE_CODES,
};
