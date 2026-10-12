// The product owner's own spike exports (sources/spike-exports/*.json), read and checked before anything is written
// (FF-2, plan/FF-2-test-seeds.md section 3.3; spec/P0-02.md AC-7, AC-8, AC-25). Each file takes a slot in name order, and the
// slot gives its Major (C1: from 3; a skipped file keeps its slot, D8). A file that fails a check is skipped with a fixed
// reason, never with anything from the file beyond its name (the parser's own message can quote the content).
'use strict';

const fs = require('fs');
const path = require('path');

const NAME_MAX = 200; // Venue.Name
const CODE_MAX = 40; // Venue.Code

const NO_EXPORTS_LINE = "Spike Venues · no spike exports found: put the spike app's .json exports in db/seeds/sources/spike-exports/ and run npm run seed again.";

/** The reasons a file is skipped (AC-25), fixed text. */
const REASON = Object.freeze({
  unreadable: 'could not be read',
  notJson: 'not valid JSON',
  notExport: 'not a spike venue export',
  nameTooLong: 'name longer than 200 characters',
  sameCode: (earlier) => `same venue code as ${earlier}`,
  duplicateMinor: 'duplicate beacon Minor',
  foreignUuid: "beacon UUID is not Spike Venues'",
});

const skipLine = (file, reason) => `Spike Venues · skipped spike-exports/${file}: ${reason}; fix or remove it and run npm run seed again.`;

/** SPIKE_ plus the upper-cased file name, any run of other characters turned into _, cut to the code column (AC-8). */
const codeOf = (file) => `SPIKE_${path.basename(file, '.json').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`.slice(0, CODE_MAX);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPositive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const arrayOrMissing = (v) => v === undefined || Array.isArray(v);

/** True for the shape of the spike's bundled assets: a positive extent, and rooms, doors, obstacles and beacons each missing or an array. */
function isSpikeShape(v) {
  return (
    isPlainObject(v) &&
    isPlainObject(v.extent) &&
    isPositive(v.extent.width) &&
    isPositive(v.extent.height) &&
    ['rooms', 'doors', 'obstacles', 'beacons'].every((key) => arrayOrMissing(v[key])) &&
    typeof v.name === 'string' &&
    v.name.length > 0
  );
}

/**
 * The checks of AC-25, in order, on one parsed export. Returns the reason to skip it, or null.
 * @param {object} v  the parsed file
 * @param {string} spikeUuid  the Spike Venues tenant's UUID
 * @param {string|null} earlierWithCode  the earlier file that already holds this file's code, if any
 */
function reasonToSkip(v, spikeUuid, earlierWithCode) {
  if (!isSpikeShape(v)) return REASON.notExport;
  if ([...v.name].length > NAME_MAX) return REASON.nameTooLong;
  if (earlierWithCode) return REASON.sameCode(earlierWithCode);
  const beacons = v.beacons ?? [];
  if (new Set(beacons.map((b) => b?.minor)).size < beacons.length) return REASON.duplicateMinor;
  if (beacons.length > 0 && String(v.spikeUuid).toLowerCase() !== spikeUuid.toLowerCase()) return REASON.foreignUuid;
  return null;
}

/**
 * Every .json file of the exports folder, in name order, each with its slot's Major and code, and either `venue` (the parsed
 * file, to be seeded) or `reason` (why it is skipped). A missing, empty or README-only folder gives an empty list.
 * @returns {Array<{file: string, major: number, code: string, venue?: object, reason?: string}>}
 */
function readExports(sourcesDir, firstMajor, spikeUuid) {
  const dir = path.join(sourcesDir, 'spike-exports');
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const seeded = new Map(); // code -> the earlier file that holds it
  return files.map((file, slot) => {
    const found = { file, major: firstMajor + slot, code: codeOf(file) };
    let text;
    try {
      text = fs.readFileSync(path.join(dir, file), 'utf8');
    } catch {
      return { ...found, reason: REASON.unreadable }; // the system's message names a path: only the fixed reason is printed
    }
    let venue;
    try {
      venue = JSON.parse(text.replace(/^﻿/, '')); // a byte-order mark is not part of the JSON
    } catch {
      return { ...found, reason: REASON.notJson }; // the parser's message can quote the file: it is never printed
    }
    const reason = reasonToSkip(venue, spikeUuid, seeded.get(found.code) ?? null);
    if (reason) return { ...found, reason };
    seeded.set(found.code, file);
    return { ...found, venue };
  });
}

/** True for an error the database raised (a SQLSTATE code and a severity), as opposed to one from the seed's own code. */
const isDatabaseError = (error) => typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) && typeof error.severity === 'string';

/** The reason for an export that passed every check and was still refused while it was being written. */
function reasonForFailure(error) {
  return isDatabaseError(error) ? `the database refused it (${error.constraint ?? error.code})` : REASON.notExport;
}

module.exports = { readExports, skipLine, reasonForFailure, NO_EXPORTS_LINE, codeOf };
