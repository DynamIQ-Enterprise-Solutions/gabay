'use strict';

// Fixture self-check for the venue map document's tests (spec/OA-1.md r1; plan/OA-1-map-document.md 1.0 section 9).
// This is NOT the validator. It is a small independent reading of the schema file's rules, run over the test fixtures
// (fullDoc, smallDoc, the seeded random documents) so that a failing validator test means the validator is wrong, not
// that the fixture broke a rule. It needs no venueMap module, so it passes now.

const test = require('node:test');
const assert = require('node:assert/strict');
const { VENUE_MAP_SCHEMA: S, constant } = require('../src/config/venueMapSchema');
const { closedSet } = require('../src/config/closedSets');
const walk = require('./fixtures/schemaWalk');
const b = require('./fixtures/mapBuilder');

const codes = (rows) => new Set(rows.map((r) => r.code));
const LOOKUPS = {
  BuildingType: codes(b.lookupRows().buildingTypes),
  AmenityType: codes(b.lookupRows().amenityTypes),
  TransitType: codes(b.lookupRows().transitTypes),
  ConnectorType: codes(b.lookupRows().connectorTypes),
  ObjectType: codes(b.objectRows()),
};

const codePoints = (s) => [...s].length;

/** Problems found by the independent reading; [] means the document follows the schema file's rules. */
function selfCheck(doc) {
  const errs = [];
  const all = [...walk.instances(S, doc)];
  const idsByKind = new Map();
  const seen = new Map();
  for (const { kind, value, path, level } of all) {
    const idRule = S.kinds[kind].fields.id;
    if (idRule?.type === 'id' && typeof value.id === 'string') {
      if (!S.patterns.ID.test(value.id)) errs.push(`${path}.id: pattern`);
      if (seen.has(value.id)) errs.push(`${path}.id: duplicate of ${seen.get(value.id)}`);
      seen.set(value.id, path);
      if (!idsByKind.has(kind)) idsByKind.set(kind, new Map());
      idsByKind.get(kind).set(value.id, { level: level?.id ?? null, value });
    }
  }
  for (const { kind, value, path, level } of all) {
    for (const [name, rule] of Object.entries(S.kinds[kind].fields)) {
      const at = path ? `${path}.${name}` : name;
      const v = value[name];
      const ok = walk.applies(S, kind, rule, value);
      const per = rule.perKind?.[walk.discriminatorValue(S, kind, value)];
      if (v === undefined) {
        if (ok && (rule.required || per?.required)) errs.push(`${at}: required`);
        continue;
      }
      if (!ok) {
        errs.push(`${at}: does not apply`);
        continue;
      }
      const r = walk.effectiveRule(S, kind, rule, value);
      if (['metres', 'degrees', 'number', 'integer'].includes(rule.type) && typeof v === 'number') {
        if (r.min !== undefined && v < r.min) errs.push(`${at}: below ${r.min}`);
        if (r.max !== undefined && v > r.max) errs.push(`${at}: above ${r.max}`);
        if (r.minExclusive !== undefined && !(v > r.minExclusive)) errs.push(`${at}: not above`);
      }
      if (rule.type === 'text' && typeof v === 'string' && rule.maxLength !== undefined) {
        if (codePoints(v) > rule.maxLength) errs.push(`${at}: too long`);
      }
      if (rule.type === 'closedSet' && !closedSet(rule.closedSet).includes(v))
        errs.push(`${at}: set`);
      if (rule.type === 'code' && !LOOKUPS[rule.lookup].has(v)) errs.push(`${at}: lookup ${v}`);
      const refs = rule.type === 'idRef' ? [v] : rule.type === 'idRefs' ? v : [];
      for (const ref of refs) {
        const target = idsByKind.get(rule.refKind)?.get(ref);
        if (!target) errs.push(`${at}: dangling ${ref}`);
        else if (rule.sameLevel && target.level !== (level?.id ?? null))
          errs.push(`${at}: other level`);
        else if (rule.refWhere) {
          for (const [f, want] of Object.entries(rule.refWhere)) {
            const got = target.value[f] ?? S.kinds[rule.refKind].fields[f].default;
            if (got !== want) errs.push(`${at}: ${ref} is not ${want}`);
          }
        }
      }
      if (rule.within === 'level' && level) {
        const [ox, oz] = level.origin;
        const [w, d] = level.size;
        const inside = (p) => p[0] >= ox && p[0] <= ox + w && p[1] >= oz && p[1] <= oz + d;
        const points = rule.type === 'point' ? [v] : Array.isArray(v) ? v : [];
        if (rule.axis === 'x' && (v < ox || v > ox + w)) errs.push(`${at}: outside`);
        if (rule.axis === 'z' && (v < oz || v > oz + d)) errs.push(`${at}: outside`);
        if (!rule.axis && !points.every(inside)) errs.push(`${at}: outside`);
      }
    }
  }
  return errs;
}

test('fixtures: fullDoc follows every rule of the schema file it is built against', () => {
  assert.deepEqual(selfCheck(b.fullDoc()), []);
});

test('fixtures: the last element of each array in fullDoc is one nothing refers to (AC-2 relies on it)', () => {
  const doc = b.fullDoc();
  const referenced = new Set();
  for (const { kind, value } of walk.instances(S, doc)) {
    for (const [name, rule] of Object.entries(S.kinds[kind].fields)) {
      const v = value[name];
      if (rule.type === 'idRef' && v) referenced.add(v);
      if (rule.type === 'idRefs' && v) v.forEach((x) => referenced.add(x));
    }
  }
  const lastOf = [
    doc.buildings.at(-1),
    doc.levels.at(-1),
    doc.connectors.at(-1),
    ...doc.levels.flatMap((l) => b.ELEMENT_ARRAYS.map((n) => l[n]?.at(-1))).filter(Boolean),
  ];
  const lvl1 = doc.levels[1];
  for (const name of b.ELEMENT_ARRAYS) {
    assert.ok(!referenced.has(lvl1[name].at(-1).id), `${name} last is referenced`);
  }
  assert.ok(!referenced.has(doc.buildings.at(-1).id));
  assert.ok(!referenced.has(doc.levels.at(-1).id));
  assert.ok(!referenced.has(doc.connectors.at(-1).id));
  assert.ok(lastOf.length > 0);
});

test('fixtures: smallDoc, twoLevelDoc and EC-6 documents follow the schema file', () => {
  for (const make of [b.smallDoc, b.twoLevelDoc, b.minimalOutdoorDoc, b.minimalBuildingDoc]) {
    assert.deepEqual(selfCheck(make()), [], make.name);
  }
});

test('fixtures: 60 seeded random documents follow the schema file (the generator of AC-12 and AC-25)', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    assert.deepEqual(selfCheck(b.randomDoc(seed)), [], `seed ${seed}`);
  }
});

test('fixtures: fullDoc stays inside the document caps, and its backdrop is the only draft-only part', () => {
  const doc = b.fullDoc();
  assert.ok(doc.levels.length <= constant('MAX_LEVELS'));
  assert.ok(doc.connectors.length <= constant('MAX_CONNECTORS'));
  assert.equal(doc.levels.filter((l) => l.backdrop).length, 1);
  assert.equal(S.kinds.level.fields.backdrop.draftOnly, true);
});
