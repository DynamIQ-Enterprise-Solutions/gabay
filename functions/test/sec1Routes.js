// Test support (not a test file): T1's 14 routes as concrete requests, for the SEC-1 API tests (chain, cross-tenant,
// matrix, scope). Built on the venue and map harnesses (venueApp.js, mapApp.js).
//
//   requestOf(route, ids, ctx)   { method, path, body | upload } for a T1 row (sec1Tables.js), with the venue, the lookup
//                                name and id, and the backdrop key filled in; bodies are well formed (a valid small map,
//                                a valid venue) so a request that reaches its handler gets the route's own answer
//   send(ctx, request, headers)  sends it through ctx.call (an upload as multipart form data with a valid PNG)
//   FEATURE_TABLES               the statements a handler (not the chain) would send: venue, map, version, backdrop,
//                                file, object catalog and lookup tables
'use strict';

const b = require('./fixtures/mapBuilder');
const { MAP_KEY, uploadForm } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');

const FEATURE_TABLES =
  /\bgabay\.(Venue|VenueMap|VenueMapBackdrop|VenueVersion|StoredFile|ObjectType|BuildingType|AmenityType|TransitType|ConnectorType|OccupantCategory)\b/i;

/**
 * @param {{ n: number, method: string, path: string }} route  a T1 row
 * @param {{ venueId?: number|string, lookupName?: string, lookupId?: number|string, key?: string }} ids
 * @param {{ tag: string, next: () => number }} ctx  for unique venue codes
 */
function requestOf(route, ids, ctx) {
  const path = route.path
    .replace(':venueId', String(ids.venueId ?? 1))
    .replace(':name', ids.lookupName ?? 'building-types')
    .replace(':id', String(ids.lookupId ?? 1))
    .replace(':key', ids.key ?? MAP_KEY);
  const venueBody = () => ({
    code: `V${ctx.tag}${ctx.next()}`,
    name: `Venue ${ctx.tag}`,
    isActive: true,
  });
  switch (route.n) {
    case 4:
      return { method: route.method, path, body: venueBody() };
    case 6:
      return { method: route.method, path, body: { ...venueBody(), updatedAt: null } };
    case 8:
      return { method: route.method, path, body: { layout: b.smallDoc(), baseVersion: 0 } };
    case 9:
      return { method: route.method, path, upload: true };
    case 11:
    case 12:
      return { method: route.method, path, body: { baseVersion: 0 } };
    case 13:
      return { method: route.method, path, body: { version: 1, baseVersion: 0 } };
    default:
      return { method: route.method, path };
  }
}

/** Sends a requestOf() request with `headers` (merged over the harness's default MALL_ADMIN-in-A headers). */
function send(ctx, request, headers = {}) {
  if (request.upload) {
    return ctx.call('POST', request.path, { form: uploadForm(pngBytes(100, 80)), headers });
  }
  return ctx.call(request.method, request.path, { body: request.body, headers });
}

module.exports = { requestOf, send, FEATURE_TABLES };
