#!/usr/bin/env node
// Writes the app's copy of the one constants file (Blueprint invariant 14; A26's shared shape, R32):
// functions/src/config/closed-sets.json -> app/lib/core/config/closed_sets.dart, one Dart enhanced enum per set.
//
//   npm run gen:closed-sets            write the Dart file
//   node tools/gen-closed-sets.js --check   exit 1, writing nothing, when the Dart file is stale
//
// tools/test/closed-sets.test.js runs the check inside `npm run tools:test`, so a set added to the JSON without
// regenerating fails `npm run verify`. The JSON is validated by the API's own loader, so both sides refuse the same
// faults.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DART_FILE = 'app/lib/core/config/closed_sets.dart';
const LOADER = path.join(ROOT, 'functions', 'src', 'config', 'closedSets.js');
const WRAP = 76;

// Dart's reserved words and built-in identifiers that cannot name an enum value.
const DART_RESERVED = new Set(
  (
    'abstract as assert async await base break case catch class const continue covariant default deferred do ' +
    'dynamic else enum export extends extension external factory false final finally for function get hide if ' +
    'implements import in interface is late library mixin new null of on operator part required rethrow return ' +
    'sealed set show static super switch sync this throw true try type typedef var void when while with yield ' +
    'values index name hashCode runtimeType code'
  ).split(' '),
);

/** 'STORE_CROSSING' -> 'storeCrossing'. */
function dartMemberName(code) {
  const name = code
    .toLowerCase()
    .split('_')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
  if (DART_RESERVED.has(name)) {
    throw new Error(`closed sets: ${code} would be the Dart name ${name}, which Dart reserves`);
  }
  return name;
}

/** Wraps text into `///` doc lines of at most WRAP characters. */
function docLines(text, indent) {
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && `${current} ${word}`.length > WRAP - indent.length - 4) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines.map((l) => `${indent}/// ${l}`);
}

/** The whole Dart file for a { Name: { authority, whyClosed, values } } map. */
function renderDart(sets) {
  const out = [
    '// GENERATED FILE: do not edit. Source: functions/src/config/closed-sets.json,',
    '// the one constants file (Blueprint invariant 14). Regenerate with',
    '// `npm run gen:closed-sets`; `npm run tools:test` fails while this is stale.',
    '',
  ];
  for (const [name, set] of Object.entries(sets)) {
    const members = set.values.map((code) => [dartMemberName(code), code]);
    out.push(...docLines(`A closed set (${name}).`, ''));
    out.push('///');
    out.push(...docLines(`Authority: ${set.authority}`, ''));
    out.push('///');
    out.push(...docLines(`Closed because: ${set.whyClosed}`, ''));
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
  }
  return `${out.join('\n').trimEnd()}\n`;
}

function main(argv) {
  const { CLOSED_SETS } = require(LOADER);
  const target = path.join(ROOT, DART_FILE);
  const expected = renderDart(CLOSED_SETS);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (argv.includes('--check')) {
    if (current === expected) {
      process.stdout.write(`${DART_FILE} is up to date\n`);
      return 0;
    }
    process.stdout.write(`${DART_FILE} is stale: run npm run gen:closed-sets\n`);
    return 1;
  }
  if (current === expected) {
    process.stdout.write(`${DART_FILE} is up to date\n`);
    return 0;
  }
  fs.writeFileSync(target, expected);
  process.stdout.write(`wrote ${DART_FILE} (${Object.keys(CLOSED_SETS).length} sets)\n`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { renderDart, dartMemberName, DART_FILE };
