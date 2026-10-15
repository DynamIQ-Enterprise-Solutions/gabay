// Test support for the publish engine (plan/FF-3-prime-A1.md 1.0 sections 2 and 4): a snapshot around a venue map
// document, over OA-1's mapBuilder fixtures. Not a test file. INVENTED DATA ONLY: no penthouse, no seed sources (L48).
//
//   snapshotOf(doc, opts)     the snapshot of section 2: the document validated with OA-1's validateMap and made
//                             publishable (a fixture that is not a valid document throws here, naming its problems);
//                             opts: context, stores, beacons, otherVenueBeacons, routing, publish, venue, tenant
//   venueDoc({ levels, buildings, connectors })   a document with the site boundary and one MAIN building
//   floor(id, over)           a level of building b1 at the origin, 20 x 20 m unless `over` says otherwise
//   storeRow(), beaconRow()   rows shaped as pg returns them (BIGINT and DECIMAL as text, EC-34)
'use strict';

const { DEFAULTS } = require('../../src/config/settings');
const { makeContext, vm, level, BOUNDARY } = require('./mapBuilder');

/**
 * The routing.* values a snapshot carries: spec/P0-03.md r4 section 3.14.7's rates and AC-120's defaults (test
 * inputs; the DEFAULTS and their GlobalSetting rows are OA-3a's, plan section 6).
 */
const ROUTING = Object.freeze({
  walkSpeedMps: 1.2,
  storeCrossingFactor: 1.25,
  stairsSaveS: 120,
  otherWayMarginS: 0.417,
  stepFreeMinWidthM: 1.2,
});

/** The publish.* values, from settings.js DEFAULTS (the platform values a tenant without overrides gets). */
const PUBLISH = Object.freeze({
  nodeSpacingM: DEFAULTS['publish.nodeSpacingM'],
  bodyMarginM: DEFAULTS['publish.bodyMarginM'],
  addPathSnapM: DEFAULTS['publish.addPathSnapM'],
  maxNodesWarn: DEFAULTS['publish.maxNodesWarn'],
});

const TENANT_UUID = '0f8e2c1a-4b6d-4e8f-9a1b-2c3d4e5f6a7b';

/** The document as the engine receives it: validated (canonical) and publishable (no backdrop). */
function canonical(doc, context) {
  const result = vm().validateMap(doc, context);
  if (!result.ok) {
    throw new Error(
      `fixture is not a valid venue map document:\n  ${result.problems.join('\n  ')}`,
    );
  }
  return vm().publishable(result.map);
}

function snapshotOf(doc, opts = {}) {
  const context = opts.context ?? makeContext();
  return {
    layout: canonical(doc, context),
    venue: { code: 'TEST', name: 'Test venue', evacEscalatorsAllowed: false, ...opts.venue },
    tenant: { beaconProximityUuid: TENANT_UUID, catalogVersion: 5, ...opts.tenant },
    stores: opts.stores ?? [],
    beacons: opts.beacons ?? [],
    otherVenueBeacons: opts.otherVenueBeacons ?? [],
    context,
    settings: {
      routing: { ...ROUTING, ...opts.routing },
      publish: { ...PUBLISH, ...opts.publish },
    },
  };
}

/** A level of building b1, 20 x 20 m at the origin, with `over` on top (arrays, origin, size, elevation, ...). */
function floor(id, over = {}) {
  return level(id, { building: 'b1', ordinal: 1, size: [20, 20], ...over });
}

function venueDoc({ levels, buildings, connectors = [] }) {
  return {
    spec: 1,
    site: { boundary: BOUNDARY() },
    buildings: buildings ?? [{ id: 'b1', name: 'Main building', type: 'MAIN' }],
    levels,
    connectors,
  };
}

/** An active store row on unit `unitKey`, as A2′'s SQL returns it. */
function storeRow(occupantId, unitKey, over = {}) {
  return {
    occupantId,
    unitKey,
    name: `Store ${unitKey}`,
    spokenName: null,
    keywords: null,
    isActive: true,
    category: { code: 'FASHION', label: 'Fashion', sortOrder: 0 },
    status: { code: 'OPEN', label: 'Open', isRoutable: true },
    ...over,
  };
}

/** An active beacon row on level `levelKey`: BIGINT and DECIMAL columns as text, as pg returns them (EC-34). */
function beaconRow(beaconId, levelKey, over = {}) {
  return {
    beaconId: String(beaconId),
    levelKey,
    proximityUuid: TENANT_UUID,
    major: 1,
    minor: beaconId,
    x: '10.000',
    y: '12.500',
    mountHeightM: null,
    measuredPower: null,
    isActive: true,
    ...over,
  };
}

module.exports = {
  ROUTING,
  PUBLISH,
  TENANT_UUID,
  canonical,
  snapshotOf,
  floor,
  venueDoc,
  storeRow,
  beaconRow,
};
