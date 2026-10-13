// The catalog (spec/OA-1.md r1 AC-44; Q13 (a); office section 5): the tenant's ObjectType rows over the platform
// ones, shaped as { version, finishes, floorFinishes, types }. Pure, over camelCase rows that OA-2's repository fills
// from its SQL (plan DC-O8): { tenantId, code, label, sortOrder, isActive, defaultW, defaultD, defaultH,
// resize: { w, d, h } each [min, max] or null, blocksWalk, mount, round }. The version is the tenant's catalog
// version counter, given by the caller (section 10 Q2 ruled (b); OA-2 adds its column). Inactive types are served,
// marked inactive (DC-15). Office's category, desk and spots are not served (DC-30).
'use strict';

const { closedSet } = require('../../config/closedSets');
const { tenantFirst } = require('./lookups');

const DIMENSIONS = ['w', 'd', 'h'];
const DEFAULT_OF = { w: 'defaultW', d: 'defaultD', h: 'defaultH' };

const metresOrNull = (value) => (typeof value === 'number' ? value : null);
const rangeOrNull = (range) =>
  Array.isArray(range) && range.length === 2 ? [range[0], range[1]] : null;

/** One served type: { code, label, sortOrder, active, size, resize, blocks, mount, round }. */
function shapeType(row) {
  const size = {};
  const resize = {};
  for (const dim of DIMENSIONS) {
    size[dim] = metresOrNull(row[DEFAULT_OF[dim]]);
    resize[dim] = rangeOrNull(row.resize?.[dim]);
  }
  return {
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    active: row.isActive === true,
    size,
    resize,
    blocks: row.blocksWalk === true,
    mount: row.mount,
    round: row.round === true,
  };
}

/** The catalog for one tenant, sorted by sortOrder and then code. Does not change `rows`. */
function shapeCatalog(rows, version) {
  const types = [...tenantFirst(rows, 'the object types').values()]
    .map(shapeType)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return {
    version,
    finishes: [...closedSet('ItemFinish')],
    floorFinishes: [...closedSet('FloorFinish')],
    types,
  };
}

module.exports = { shapeCatalog };
