#!/usr/bin/env node
// Writes the app's copy of the one constants file (Blueprint invariant 14; A26's shared shape, R32):
// functions/src/config/closed-sets.json -> app/lib/core/config/closed_sets.dart, one Dart enhanced enum per set and
// one const Set of the parent enum per subset.
//
//   npm run gen:closed-sets            write the Dart file
//   node tools/gen-closed-sets.js --check   exit 1, writing nothing, when the Dart file is stale
//
// tools/test/closed-sets.test.js runs the check inside `npm run tools:test`, so a set added to the JSON without
// regenerating fails `npm run verify`. The JSON is validated by the API's own loader, so both sides refuse the same
// faults. The header, the doc wrapping, the Dart names and the --check step are tools/lib/dart-gen.js (shared with
// tools/gen-venue-map-schema.js).
'use strict';

const path = require('node:path');
const {
  dartMemberName,
  dartConstName,
  docLines,
  generatedHeader,
  writeOrCheck,
} = require('./lib/dart-gen');

const ROOT = path.resolve(__dirname, '..');
const DART_FILE = 'app/lib/core/config/closed_sets.dart';
const LOADER = path.join(ROOT, 'functions', 'src', 'config', 'closedSets.js');

/** [[dartName, code], ...] for one set; throws when two of its codes would make the same Dart name. */
function membersOf(name, values) {
  const byDartName = new Map();
  for (const code of values) {
    const member = dartMemberName(code);
    if (byDartName.has(member)) {
      throw new Error(
        `closed sets: ${name}: ${byDartName.get(member)} and ${code} would both be the Dart name ${member}`,
      );
    }
    byDartName.set(member, code);
  }
  return [...byDartName.entries()];
}

function renderSet(name, set) {
  const members = membersOf(name, set.values);
  const out = [];
  out.push(...docLines(`A closed set (${name}).`));
  out.push('///');
  out.push(...docLines(`Authority: ${set.authority}`));
  out.push('///');
  out.push(...docLines(`Closed because: ${set.whyClosed}`));
  out.push(`enum ${name} {`);
  members.forEach(([member, code], i) => {
    out.push(`  ${member}('${code}')${i === members.length - 1 ? ';' : ','}`);
  });
  out.push('');
  out.push(`  const ${name}(this.code);`);
  out.push('');
  out.push('  /// The value as the API and the package carry it.');
  out.push('  final String code;');
  out.push('');
  out.push('  /// The member whose [code] is [value], or null when none is.');
  out.push(`  static ${name}? fromCode(String value) {`);
  out.push(`    for (final member in ${name}.values) {`);
  out.push('      if (member.code == value) return member;');
  out.push('    }');
  out.push('    return null;');
  out.push('  }');
  out.push('}');
  out.push('');
  return out;
}

function renderSubset(name, subset, sets) {
  const parent = sets[subset.of];
  if (!parent)
    throw new Error(`closed sets: subset ${name} names ${subset.of}, which is not a set`);
  const memberOf = new Map(
    membersOf(subset.of, parent.values).map(([member, code]) => [code, member]),
  );
  const out = [];
  out.push(...docLines(`A closed subset (${name}) of [${subset.of}].`));
  out.push('///');
  out.push(...docLines(`Authority: ${subset.authority}`));
  out.push('///');
  out.push(...docLines(`Closed because: ${subset.whyClosed}`));
  out.push(`const Set<${subset.of}> ${dartConstName(name)} = {`);
  for (const code of subset.values) {
    if (!memberOf.has(code)) {
      throw new Error(`closed sets: subset ${name}: ${code} is not a value of ${subset.of}`);
    }
    out.push(`  ${subset.of}.${memberOf.get(code)},`);
  }
  out.push('};');
  out.push('');
  return out;
}

/**
 * The whole Dart file for a { Name: { authority, whyClosed, values } } map of sets and a
 * { Name: { of, authority, whyClosed, values } } map of subsets.
 */
function renderDart(sets, subsets = {}) {
  const out = [
    ...generatedHeader({
      source: 'functions/src/config/closed-sets.json',
      what: 'the one constants file (Blueprint invariant 14)',
      command: 'gen:closed-sets',
    }),
    '',
  ];
  for (const [name, set] of Object.entries(sets)) out.push(...renderSet(name, set));
  for (const [name, subset] of Object.entries(subsets))
    out.push(...renderSubset(name, subset, sets));
  return `${out.join('\n').trimEnd()}\n`;
}

function main(argv) {
  const { CLOSED_SETS, CLOSED_SUBSETS } = require(LOADER);
  return writeOrCheck({
    root: ROOT,
    file: DART_FILE,
    expected: renderDart(CLOSED_SETS, CLOSED_SUBSETS),
    command: 'gen:closed-sets',
    summary: `${Object.keys(CLOSED_SETS).length} sets, ${Object.keys(CLOSED_SUBSETS).length} subsets`,
    argv,
  });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { renderDart, dartMemberName, dartConstName, DART_FILE };
