// The publish engine's one input, the snapshot (spec/P0-03.md r4 AC-89, AC-117; plan/FF-3-prime-A1.md 1.0 section 2):
// a plain object A2′ reads in one REPEATABLE READ transaction. It replaces A1's VenueDraft (draft.js).
//
//   { layout,                 the canonical document (OA-1's validateMap map), backdrops stripped by publishable()
//     venue: { code, name, evacEscalatorsAllowed },
//     tenant: { beaconProximityUuid, catalogVersion },
//     stores: [{ occupantId, unitKey, name, spokenName, keywords, isActive,
//                category: { code, label, sortOrder }, status: { code, label, sortOrder, isRoutable } }],
//     beacons: [{ beaconId, levelKey, proximityUuid, major, minor, x, y, mountHeightM, measuredPower, isActive }],
//     otherVenueBeacons: [{ venueId, venueName, levelKey, major }],
//     context,                shapeMapContext's result (lookups by code, tenant first), each entry of BuildingType,
//                             AmenityType, TransitType and ConnectorType also carrying its label and sortOrder
//                             (AC-79), an AmenityType its synonyms and isAccessible, and a ConnectorType its
//                             isStepFree and its cost pair costBaseS, costPerRiseS (AC-101; OA-3a's columns)
//     settings: { routing: { walkSpeedMps, storeCrossingFactor, stairsSaveS, otherWayMarginS, stepFreeMinWidthM },
//                 publish: { nodeSpacingM, bodyMarginM, addPathSnapM, maxNodesWarn } } }
// (A1′b added the store status's sortOrder and the lookup entries' fields after the plan's section 2, which the model
// needs for AC-79 and AC-116 and the costs for AC-101: DC-B6.)
//
// readSnapshot checks every field once and parses the rows: pg returns DECIMAL and BIGINT as text (EC-34, kept for
// rows), so a number may arrive as "12.500". A missing field, or a value of the wrong kind, throws: no silent
// defaults (C8). A connector type's cost pair must be finite and at least 0, else the build fails: the engine holds
// no default pair (AC-105, AC-106, DC-A4, EC-92). The layout is judged by OA-1's validator, not here (AC-108,
// AC-121: an invalid draft is a finding). Nothing is copied that the engine does not change: the layout and the
// context are passed through as given, the lookup entries are read into new maps, and the input is never changed.
'use strict';

const { LOOKUP_NAMES } = require('../../config/venueMapSchema');

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;
const INTEGER_TEXT = /^-?\d+$/;

function fail(path, why) {
  throw new TypeError(`publish snapshot: ${path} ${why}`);
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value of `name` on `object`, which must have it as its own key (null is a value; absent is not). */
function field(object, name, path) {
  if (!isPlainObject(object)) fail(path, 'must be an object');
  if (!Object.hasOwn(object, name)) fail(`${path}.${name}`, 'is missing');
  return object[name];
}

function text(value, path, { nullable = false } = {}) {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') fail(path, 'must be text');
  return value;
}

function flag(value, path) {
  if (typeof value !== 'boolean') fail(path, 'must be true or false');
  return value;
}

/** A finite number, from a JSON number or pg's DECIMAL text. */
function decimal(value, path, { nullable = false } = {}) {
  if (value === null && nullable) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && DECIMAL_TEXT.test(value.trim())) return Number(value);
  return fail(path, 'must be a finite number');
}

/** A safe integer, from a JSON number or pg's INT or BIGINT text. */
function integer(value, path, { nullable = false } = {}) {
  if (value === null && nullable) return null;
  const n = typeof value === 'string' && INTEGER_TEXT.test(value.trim()) ? Number(value) : value;
  if (!Number.isSafeInteger(n)) fail(path, 'must be a whole number');
  return n;
}

function list(value, path) {
  if (!Array.isArray(value)) fail(path, 'must be a list');
  return value;
}

/** A number that must be above 0, or at least 0. */
function bounded(value, path, { above, atLeast }) {
  if (above !== undefined && !(value > above)) fail(path, `must be above ${above}`);
  if (atLeast !== undefined && !(value >= atLeast)) fail(path, `must be at least ${atLeast}`);
  return value;
}

function readStore(row, path) {
  const category = field(row, 'category', path);
  const status = field(row, 'status', path);
  const at = (name) => field(row, name, path);
  return {
    occupantId: integer(at('occupantId'), `${path}.occupantId`),
    unitKey: text(at('unitKey'), `${path}.unitKey`),
    name: text(at('name'), `${path}.name`),
    spokenName: text(at('spokenName'), `${path}.spokenName`, { nullable: true }),
    keywords: text(at('keywords'), `${path}.keywords`, { nullable: true }),
    isActive: flag(at('isActive'), `${path}.isActive`),
    category: {
      code: text(field(category, 'code', `${path}.category`), `${path}.category.code`),
      label: text(field(category, 'label', `${path}.category`), `${path}.category.label`),
      sortOrder: integer(
        field(category, 'sortOrder', `${path}.category`),
        `${path}.category.sortOrder`,
      ),
    },
    status: {
      code: text(field(status, 'code', `${path}.status`), `${path}.status.code`),
      label: text(field(status, 'label', `${path}.status`), `${path}.status.label`),
      sortOrder: integer(field(status, 'sortOrder', `${path}.status`), `${path}.status.sortOrder`),
      isRoutable: flag(field(status, 'isRoutable', `${path}.status`), `${path}.status.isRoutable`),
    },
  };
}

function readBeacon(row, path) {
  const at = (name) => field(row, name, path);
  return {
    beaconId: integer(at('beaconId'), `${path}.beaconId`),
    levelKey: text(at('levelKey'), `${path}.levelKey`),
    proximityUuid: text(at('proximityUuid'), `${path}.proximityUuid`),
    major: integer(at('major'), `${path}.major`),
    minor: integer(at('minor'), `${path}.minor`),
    x: decimal(at('x'), `${path}.x`),
    y: decimal(at('y'), `${path}.y`),
    mountHeightM: decimal(at('mountHeightM'), `${path}.mountHeightM`, { nullable: true }),
    measuredPower: integer(at('measuredPower'), `${path}.measuredPower`, { nullable: true }),
    isActive: flag(at('isActive'), `${path}.isActive`),
  };
}

function readOtherVenueBeacon(row, path) {
  const at = (name) => field(row, name, path);
  return {
    venueId: integer(at('venueId'), `${path}.venueId`),
    venueName: text(at('venueName'), `${path}.venueName`),
    levelKey: text(at('levelKey'), `${path}.levelKey`),
    major: integer(at('major'), `${path}.major`),
  };
}

function readContext(context) {
  const lookups = field(context, 'lookups', 'snapshot.context');
  integer(field(context, 'catalogVersion', 'snapshot.context'), 'snapshot.context.catalogVersion');
  for (const name of LOOKUP_NAMES) {
    if (!(field(lookups, name, 'snapshot.context.lookups') instanceof Map)) {
      fail(`snapshot.context.lookups.${name}`, 'must be a Map from code to entry');
    }
  }
  return context;
}

/** What each lookup's entries carry beyond their code, for the model and the costs (AC-79, AC-101, AC-116). */
const LOOKUP_EXTRAS = Object.freeze({
  BuildingType: () => ({}),
  AmenityType: (entry, path) => ({
    synonyms: text(field(entry, 'synonyms', path), `${path}.synonyms`, { nullable: true }),
    isAccessible: flag(field(entry, 'isAccessible', path), `${path}.isAccessible`),
  }),
  TransitType: () => ({}),
  ConnectorType: (entry, path) => {
    const cost = (name) =>
      bounded(decimal(field(entry, name, path), `${path}.${name}`), `${path}.${name}`, {
        atLeast: 0,
      });
    return {
      costModel: text(field(entry, 'costModel', path), `${path}.costModel`),
      isStepFree: flag(field(entry, 'isStepFree', path), `${path}.isStepFree`),
      costBaseS: cost('costBaseS'),
      costPerRiseS: cost('costPerRiseS'),
    };
  },
});

/** The lookup entries of LOOKUP_EXTRAS read into new maps, code -> { code, label, sortOrder, ...extras }. */
function readLookups(context) {
  const out = {};
  for (const [name, extras] of Object.entries(LOOKUP_EXTRAS)) {
    const read = new Map();
    for (const [code, entry] of context.lookups[name]) {
      const path = `snapshot.context.lookups.${name}[${code}]`;
      read.set(code, {
        code,
        label: text(field(entry, 'label', path), `${path}.label`),
        sortOrder: integer(field(entry, 'sortOrder', path), `${path}.sortOrder`),
        ...extras(entry, path),
      });
    }
    out[name] = read;
  }
  return out;
}

function readSettings(settings) {
  const group = (name) => field(settings, name, 'snapshot.settings');
  const number = (groupName, name, range, parse = decimal) => {
    const path = `snapshot.settings.${groupName}`;
    return bounded(
      parse(field(group(groupName), name, path), `${path}.${name}`),
      `${path}.${name}`,
      range,
    );
  };
  return {
    routing: {
      walkSpeedMps: number('routing', 'walkSpeedMps', { above: 0 }),
      storeCrossingFactor: number('routing', 'storeCrossingFactor', { atLeast: 0 }),
      stairsSaveS: number('routing', 'stairsSaveS', { atLeast: 0 }),
      otherWayMarginS: number('routing', 'otherWayMarginS', { atLeast: 0 }),
      stepFreeMinWidthM: number('routing', 'stepFreeMinWidthM', { above: 0 }),
    },
    publish: {
      nodeSpacingM: number('publish', 'nodeSpacingM', { above: 0 }),
      bodyMarginM: number('publish', 'bodyMarginM', { atLeast: 0 }),
      addPathSnapM: number('publish', 'addPathSnapM', { atLeast: 0 }),
      maxNodesWarn: number('publish', 'maxNodesWarn', { atLeast: 0 }, integer),
    },
  };
}

/**
 * The snapshot checked and its rows parsed: a new object; the layout and context are the given ones, unchanged.
 * @throws {TypeError} naming the first missing or malformed field
 */
function readSnapshot(snapshot) {
  const at = (name) => field(snapshot, name, 'snapshot');
  const layout = at('layout');
  const venue = at('venue');
  const tenant = at('tenant');
  const context = readContext(at('context'));
  return {
    layout,
    venue: {
      code: text(field(venue, 'code', 'snapshot.venue'), 'snapshot.venue.code'),
      name: text(field(venue, 'name', 'snapshot.venue'), 'snapshot.venue.name'),
      evacEscalatorsAllowed: flag(
        field(venue, 'evacEscalatorsAllowed', 'snapshot.venue'),
        'snapshot.venue.evacEscalatorsAllowed',
      ),
    },
    tenant: {
      beaconProximityUuid: text(
        field(tenant, 'beaconProximityUuid', 'snapshot.tenant'),
        'snapshot.tenant.beaconProximityUuid',
        { nullable: true },
      ),
      catalogVersion: integer(
        field(tenant, 'catalogVersion', 'snapshot.tenant'),
        'snapshot.tenant.catalogVersion',
      ),
    },
    stores: list(at('stores'), 'snapshot.stores').map((row, i) =>
      readStore(row, `snapshot.stores[${i}]`),
    ),
    beacons: list(at('beacons'), 'snapshot.beacons').map((row, i) =>
      readBeacon(row, `snapshot.beacons[${i}]`),
    ),
    otherVenueBeacons: list(at('otherVenueBeacons'), 'snapshot.otherVenueBeacons').map((row, i) =>
      readOtherVenueBeacon(row, `snapshot.otherVenueBeacons[${i}]`),
    ),
    context,
    lookups: readLookups(context),
    settings: readSettings(at('settings')),
  };
}

module.exports = { readSnapshot };
