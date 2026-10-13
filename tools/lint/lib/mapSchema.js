// Reads the venue map document's schema file for the schema-forms lint's document mode (E-26; spec/OA-1.md r1 AC-39,
// AC-40; plan/OA-1-map-document.md 1.0 sections 3.5 and 6). It reads the JSON itself and never loads functions/ code
// (DC-O10), so the lint does not depend on the API's code loading. For each field it gives what the lint checks:
// the type kind, whether it is required, whether it has a default, its maximum length and its decimals (scale).
'use strict';

/** A constant's value by name, derived constants included. */
function constantsOf(raw) {
  const values = {};
  for (const [name, entry] of Object.entries(raw.constants ?? {})) {
    if (typeof entry.value === 'number') values[name] = entry.value;
  }
  for (const [name, entry] of Object.entries(raw.constants ?? {})) {
    const derived = entry.derived;
    if (derived && typeof values[derived.constant] === 'number') {
      values[name] = values[derived.constant] * derived.times;
    }
  }
  return values;
}

function valueAt(raw, dotted) {
  return dotted
    .split('.')
    .reduce((at, part) => (at && typeof at === 'object' ? at[part] : undefined), raw);
}

/** What the lint needs of one field rule. */
function summarise(rule, raw, constants) {
  const constant = (name) => (typeof name === 'string' ? constants[name] : name);
  const numberKind = rule.type === 'number' ? rule.numberKind : rule.type;
  const decimals = ['metres', 'degrees', 'number'].includes(rule.type)
    ? raw.numberKinds?.[numberKind]?.decimals
    : undefined;
  const equals = rule.equals !== undefined ? valueAt(raw, rule.equals) : undefined;
  let maxLength = rule.maxLength !== undefined ? constant(rule.maxLength) : undefined;
  if (maxLength === undefined && rule.type === 'text' && typeof equals === 'string') {
    maxLength = equals.length;
  }
  const required = rule.required === true;
  const perKindRequired = Object.values(rule.perKind ?? {}).some((p) => p.required === true);
  const hasDefault =
    'default' in rule ||
    'defaultFrom' in rule ||
    'fromContext' in rule ||
    (equals !== undefined && !required);
  return { type: rule.type, required, hasDefault, perKindRequired, maxLength, decimals };
}

/**
 * Parses the schema file's text. Returns { field(kind, dottedName) } where field() gives
 * { summary } for a field, or { problem } naming what is not there. Throws on text that is not JSON.
 */
function parseMapSchema(text) {
  const raw = JSON.parse(text);
  const kinds = raw.kinds ?? {};
  const constants = constantsOf(raw);
  return {
    hasKind: (kind) => Object.hasOwn(kinds, kind),
    field(kind, dottedName) {
      const parts = dottedName.split('.');
      let current = kinds[kind];
      for (let i = 0; i < parts.length; i += 1) {
        const fields = current?.fields ?? {};
        const rule = Object.hasOwn(fields, parts[i]) ? fields[parts[i]] : undefined;
        if (!rule) return { problem: `no field ${parts.slice(0, i + 1).join('.')}` };
        if (i === parts.length - 1) return { summary: summarise(rule, raw, constants) };
        if (rule.type !== 'object' || !kinds[rule.of]) {
          return { problem: `${parts.slice(0, i + 1).join('.')} is not an object with fields` };
        }
        current = kinds[rule.of];
      }
      return { problem: 'no field' };
    },
  };
}

module.exports = { parseMapSchema };
