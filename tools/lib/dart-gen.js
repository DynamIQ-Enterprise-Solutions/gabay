// What the two Dart generators share (plan/OA-1-map-document.md 1.0 section 3.4, DC-O15; C2, extracted on its second
// use): tools/gen-closed-sets.js (the constants file) and tools/gen-venue-map-schema.js (the venue map document's
// schema file). The generated-file header, `///` wrapping, Dart names (the reserved-word rule), Dart string literals,
// and the write-or---check step, where --check exits 1 and writes nothing while the Dart file is stale.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WRAP = 76;
const RESERVED_SUFFIX = 'Value';

// Dart's reserved words and built-in identifiers, and the names an enum already has (values, index, name, hashCode,
// runtimeType) or that the closed-sets generator gives it (code): none can name an enum value.
const DART_RESERVED = new Set(
  (
    'abstract as assert async await base break case catch class const continue covariant default deferred do ' +
    'dynamic else enum export extends extension external factory false final finally for function get hide if ' +
    'implements import in interface is late library mixin new null of on operator part required rethrow return ' +
    'sealed set show static super switch sync this throw true try type typedef var void when while with yield ' +
    'values index name hashCode runtimeType code'
  ).split(' '),
);

/**
 * A code as a lowerCamelCase Dart name, split on `_` and `.`: 'STORE_CROSSING' -> 'storeCrossing',
 * 'restroom.female.wheelchair' -> 'restroomFemaleWheelchair'. A name Dart reserves gets the suffix `Value`
 * ('default' -> 'defaultValue'; DC-O7).
 */
function dartMemberName(code) {
  const name = code
    .toLowerCase()
    .split(/[_.]/)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
  return DART_RESERVED.has(name) ? `${name}${RESERVED_SUFFIX}` : name;
}

/** 'WalkableUnitCategory' -> 'walkableUnitCategory': a PascalCase name as a lowerCamelCase Dart constant. */
function dartConstName(pascalName) {
  return pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
}

/** Wraps text into `///` doc lines of at most WRAP characters. */
function docLines(text, indent = '') {
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

/** A Dart single-quoted string literal. */
function dartString(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
}

/** The three header lines every generated Dart file starts with. */
function generatedHeader({ source, what, command }) {
  return [
    `// GENERATED FILE: do not edit. Source: ${source},`,
    `// ${what}. Regenerate with`,
    `// \`npm run ${command}\`; \`npm run tools:test\` fails while this is stale.`,
  ];
}

/**
 * Writes `expected` to `file` (relative to `root`), or with --check only compares. Prints what it did and returns the
 * exit code: 0 when written or current, 1 when --check finds the file stale.
 */
function writeOrCheck({ root, file, expected, command, summary, argv }) {
  const target = path.join(root, file);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current === expected) {
    process.stdout.write(`${file} is up to date\n`);
    return 0;
  }
  if (argv.includes('--check')) {
    process.stdout.write(`${file} is stale: run npm run ${command}\n`);
    return 1;
  }
  fs.writeFileSync(target, expected);
  process.stdout.write(`wrote ${file} (${summary})\n`);
  return 0;
}

module.exports = {
  DART_RESERVED,
  dartMemberName,
  dartConstName,
  docLines,
  dartString,
  generatedHeader,
  writeOrCheck,
};
