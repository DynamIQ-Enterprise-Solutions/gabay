// Test support: walks a venue map document by the loaded schema file (spec/OA-1.md r1 AC-37). Not a test file.
// The generated cases of AC-2 (required), AC-3 (ranges) and AC-39 (what each field states) read the schema through
// this, so a new field gets its cases without a test edit (plan section 9: "generated from the schema file").
'use strict';

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The value that decides which per-kind rules apply to `inst` (e.g. a connector's `kind`, a level's `outdoor`). */
function discriminatorValue(schema, kind, inst) {
  const name = schema.kinds[kind].discriminator;
  if (!name) return undefined;
  if (inst[name] !== undefined) return inst[name];
  return schema.kinds[kind].fields[name].default;
}

/** Does a rule apply to an instance? (`appliesTo` lists discriminator values.) */
function applies(schema, kind, rule, inst) {
  if (!rule.appliesTo) return true;
  return rule.appliesTo.includes(discriminatorValue(schema, kind, inst));
}

/** The range properties in force for `rule` on `inst`: the rule's own, over the perKind entry's for its kind. */
function effectiveRule(schema, kind, rule, inst) {
  const per = rule.perKind?.[discriminatorValue(schema, kind, inst)];
  return per ? { ...rule, ...per } : rule;
}

/** Every object instance of the document: { kind, value, path, level } (level: the level object it sits on, or null). */
function* instances(schema, doc, kind = 'document', path = '', level = null) {
  yield { kind, value: doc, path, level };
  const fields = schema.kinds[kind].fields;
  const here = kind === 'level' ? doc : level;
  for (const [name, rule] of Object.entries(fields)) {
    const v = doc[name];
    if (!isObject(v) && !Array.isArray(v)) continue;
    const child = path ? `${path}.${name}` : name;
    if (rule.type === 'object' && rule.of && isObject(v)) {
      yield* instances(schema, v, rule.of, child, here);
    } else if (rule.type === 'array' && rule.of && Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {
        if (isObject(v[i])) yield* instances(schema, v[i], rule.of, `${child}[${i}]`, here);
      }
    }
  }
}

/** The kinds of the document tree in the schema, each with the rules of its fields (the export kinds are not included). */
const documentKinds = (schema) => Object.keys(schema.kinds);

module.exports = { isObject, discriminatorValue, applies, effectiveRule, instances, documentKinds };
