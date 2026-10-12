'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2): the seed's sources. The penthouse present or absent, no
// exports, valid exports, and every kind of export the seed must skip. Each case builds its own temporary sources folder
// content (fixtures are invented data, never the owner's exports or the penthouse), runs the seed command in a transaction
// of its own that is rolled back, and reads what it wrote. Covers AC-5, AC-6, AC-7, AC-8, AC-9 (an export) and AC-25, and the edge
// cases "a new export added later" and "an export with no rooms, doors or beacons".

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { inTransaction, makeSources, runMain, fixture, exportWith, committedSource, tenantId } = require('./helpers');

const NO_EXPORTS_LINE =
  "Spike Venues · no spike exports found: put the spike app's .json exports in db/seeds/sources/spike-exports/ and run npm run seed again.";
const SKIP_PREFIX = 'Spike Venues · skipped spike-exports/';
const SKIP_SUFFIX = '; fix or remove it and run npm run seed again.';

let sources;

before(() => {
  sources = makeSources();
});

after(() => {
  sources?.remove();
});

// Set by seedCase for the case that is running: the helpers below read through it.
let db;

/** Runs one case: resets the temporary folder, runs the seed through the adapter, then `check({ run, rows })`. */
function seedCase(title, folder, check) {
  test(title, async () => {
    await inTransaction(async (client) => {
      db = { client };
      sources.reset(folder);
      const run = await runMain(client, { sourcesDir: sources.dir });
      const rows = async (text, params = []) => (await client.query(text, params)).rows;
      await check({ run, rows });
    });
  });
}

const skipLines = (run) => run.out.filter((l) => l.startsWith(SKIP_PREFIX));
const lineFor = (file, reason) => `${SKIP_PREFIX}${file}: ${reason}${SKIP_SUFFIX}`;
const committed = (run) => {
  assert.deepEqual(run.err, []);
  assert.equal(run.code, 0);
  assert.deepEqual(run.events, ['BEGIN', 'COMMIT']);
};

/** The venue of Spike Venues with this code: { id, majors, reviews }. */
async function spikeVenue(rows, code) {
  const spike = await tenantId(db.client, 'SPIKE_VENUES');
  const [venue] = await rows('SELECT VenueId AS id, Name AS name FROM gabay.Venue WHERE TenantId = $1 AND Code = $2', [spike, code]);
  if (!venue) return null;
  const majors = await rows('SELECT DISTINCT Major AS major FROM gabay.Beacon WHERE TenantId = $1 AND VenueId = $2 ORDER BY Major', [spike, venue.id]);
  const review = await rows('SELECT count(*) AS n FROM gabay.Opening WHERE TenantId = $1 AND VenueId = $2 AND NeedsReview', [spike, venue.id]);
  return { id: venue.id, name: venue.name, majors: majors.map((m) => m.major), reviews: Number(review[0].n) };
}

const spikeCodes = async (rows) => {
  const spike = await tenantId(db.client, 'SPIKE_VENUES');
  return (await rows('SELECT Code AS code FROM gabay.Venue WHERE TenantId = $1', [spike])).map((r) => r.code).sort(); // sorted here, not by the database collation
};

/** The independent form of AC-9's rule: unsure doors, or doors to a room the source never drew. */
function expectedReviews(source) {
  const drawn = new Set((source.rooms ?? []).map((r) => r.id));
  return (source.doors ?? []).filter((d) => (d.confidence && d.confidence !== 'high') || d.rooms.some((id) => id !== 'OUTSIDE' && !drawn.has(id))).length;
}

// ---- AC-5 and AC-6: the penthouse ------------------------------------------------------------------------------------

seedCase('AC-5: penthouse absent: skip line, commit, exit 0', {}, async ({ run, rows }) => {
  committed(run);
  const skip = run.out.filter((l) => l.includes('skipped PENTHOUSE'));
  assert.equal(skip.length, 1);
  assert.match(skip[0], /sources\/internal\/penthouse\.json/);
  assert.match(skip[0], /L123/);
  assert.deepEqual(await spikeCodes(rows), ['MEZZ_OFFICE'], 'the other venues are written');
  assert.ok(run.out.includes('Seed committed.'));
});

seedCase(
  'AC-6 (stand-in): penthouse present: PENTHOUSE on Major 1, MEZZ office on Major 2',
  // Invented stand-in: mezz.json copied at test time under another name. Never the real penthouse (L48).
  { internal: { 'penthouse.json': { ...committedSource('spike/mezz.json'), name: 'Stand-in penthouse (test data)' } } },
  async ({ run, rows }) => {
    committed(run);
    assert.deepEqual(await spikeCodes(rows), ['MEZZ_OFFICE', 'PENTHOUSE']);
    assert.deepEqual((await spikeVenue(rows, 'PENTHOUSE')).majors, [1]);
    assert.deepEqual((await spikeVenue(rows, 'MEZZ_OFFICE')).majors, [2]);
    assert.equal(run.out.filter((l) => l.includes('skipped PENTHOUSE')).length, 0);
  },
);

// ---- AC-7: no exports ------------------------------------------------------------------------------------------------

for (const [title, folder] of [
  ['no folder', {}],
  ['an empty folder', { exports: {} }],
  ['a README only', { exports: { 'README.md': '# not an export\n' } }],
  ['a file that is not .json', { exports: { 'notes.txt': 'not an export' } }],
]) {
  seedCase(`AC-7: ${title}: the no-exports line once, commit, exit 0`, folder, async ({ run, rows }) => {
    committed(run);
    assert.equal(run.out.filter((l) => l === NO_EXPORTS_LINE).length, 1);
    assert.equal(skipLines(run).length, 0);
    assert.deepEqual(await spikeCodes(rows), ['MEZZ_OFFICE']);
  });
}

// ---- AC-8 and AC-9: valid exports ------------------------------------------------------------------------------------

const LONG_FILE = `${'long'.repeat(15)}.json`; // 60 characters of name, then .json
seedCase(
  'AC-8: a valid export becomes SPIKE_<NAME>; a long file name is cut to a 40-character code; Majors are 3 and 4 in name order, printed',
  {
    exports: {
      'Test Kiosk Lane.json': fixture('valid.json'),
      [LONG_FILE]: exportWith({ name: 'Long Name Venue' }),
    },
  },
  async ({ run, rows }) => {
    committed(run);
    assert.equal(run.out.filter((l) => l === NO_EXPORTS_LINE).length, 0);
    const longCode = `SPIKE_${'LONG'.repeat(15)}`.slice(0, 40);
    assert.equal(longCode.length, 40);
    assert.deepEqual(await spikeCodes(rows), ['MEZZ_OFFICE', longCode, 'SPIKE_TEST_KIOSK_LANE'].sort());
    const kiosk = await spikeVenue(rows, 'SPIKE_TEST_KIOSK_LANE');
    const long = await spikeVenue(rows, longCode);
    assert.deepEqual(kiosk.majors, [3]);
    assert.deepEqual(long.majors, [4]);
    assert.ok(run.out.some((l) => l.startsWith('Spike Venues · Test Kiosk Lane (Major 3):')), 'each export venue prints its Major');
    assert.ok(run.out.some((l) => l.startsWith('Spike Venues · Long Name Venue (Major 4):')));
    // AC-9 for an export: the same rule as MEZZ office's
    const expected = expectedReviews(fixture('valid.json'));
    assert.equal(expected, 2, 'the fixture has one unsure door and one door to a room it never drew');
    assert.equal(kiosk.reviews, expected);
    assert.equal(long.reviews, expected);
  },
);

// ---- the edge cases of a changing export folder ----------------------------------------------------------------------

seedCase('a new export added later (alone): b.json gets Major 3', { exports: { 'b.json': exportWith({ name: 'Venue B' }) } }, async ({ run, rows }) => {
  committed(run);
  assert.deepEqual((await spikeVenue(rows, 'SPIKE_B')).majors, [3]);
  assert.ok(run.out.some((l) => l.startsWith('Spike Venues · Venue B (Major 3):')));
});

seedCase(
  'a new export added later (a file that sorts earlier): a.json gets 3 and b.json moves to 4, both printed',
  { exports: { 'a.json': exportWith({ name: 'Venue A' }), 'b.json': exportWith({ name: 'Venue B' }) } },
  async ({ run, rows }) => {
    committed(run);
    assert.deepEqual((await spikeVenue(rows, 'SPIKE_A')).majors, [3]);
    assert.deepEqual((await spikeVenue(rows, 'SPIKE_B')).majors, [4]);
    assert.ok(run.out.some((l) => l.startsWith('Spike Venues · Venue A (Major 3):')));
    assert.ok(run.out.some((l) => l.startsWith('Spike Venues · Venue B (Major 4):')));
  },
);

seedCase('an export with no rooms, doors or beacons seeds its venue, building and "Floor 1" level, with no error', { exports: { 'empty.json': fixture('no-content.json') } }, async ({ run, rows }) => {
  committed(run);
  assert.equal(skipLines(run).length, 0);
  const venue = await spikeVenue(rows, 'SPIKE_EMPTY');
  assert.ok(venue, 'the venue is seeded');
  assert.deepEqual(venue.majors, []);
  const spike = await tenantId(db.client, 'SPIKE_VENUES');
  const buildings = await rows('SELECT count(*) AS n FROM gabay.Building WHERE TenantId = $1 AND VenueId = $2', [spike, venue.id]);
  assert.equal(Number(buildings[0].n), 1);
  const levels = await rows('SELECT Name AS name FROM gabay.Level WHERE TenantId = $1 AND VenueId = $2', [spike, venue.id]);
  assert.deepEqual(
    levels.map((l) => l.name),
    ['Floor 1'],
  );
  for (const table of ['Unit', 'Opening', 'Beacon', 'FloorObject']) {
    const n = await rows(`SELECT count(*) AS n FROM gabay.${table} WHERE TenantId = $1 AND VenueId = $2`, [spike, venue.id]);
    assert.equal(Number(n[0].n), 0, `${table}: none`);
  }
});

// ---- AC-25: an export the seed cannot use ----------------------------------------------------------------------------
// One case per kind, each an invented fixture next to one valid fixture. 'bad...' sorts before 'valid.json', so the bad file
// holds slot Major 3 and the valid one gets Major 4 (a skipped export keeps its slot, D8).

const SENTINEL = 'SENTINEL-FILE-CONTENT-do-not-print';
const SKIP_KINDS = [
  ['invalid JSON', { 'bad.json': `{ "name": "${SENTINEL}", ` }, 'bad.json', 'not valid JSON'],
  ['a shape that is not a spike venue export (no extent)', { 'bad.json': { name: SENTINEL, rooms: [] } }, 'bad.json', 'not a spike venue export'],
  ['a name of 201 characters', { 'bad.json': exportWith({ name: 'N'.repeat(201) }) }, 'bad.json', 'name longer than 200 characters'],
  [
    'two file names that give one code',
    // 'kiosk a.json' sorts before 'kiosk-a.json' (space before hyphen), so the hyphen one is the later file and is skipped.
    { 'kiosk a.json': exportWith({ name: 'Kiosk A first' }), 'kiosk-a.json': exportWith({ name: 'Kiosk A second' }) },
    'kiosk-a.json',
    'same venue code as kiosk a.json',
  ],
  [
    'duplicate beacon Minors',
    { 'bad.json': exportWith({ beacons: [{ id: 'B1', minor: 7, x: 2, y: 2 }, { id: 'B2', minor: 7, x: 3, y: 3 }] }) },
    'bad.json',
    'duplicate beacon Minor',
  ],
  ['a beacon UUID that is not Spike Venues', { 'bad.json': exportWith({ spikeUuid: '11111111-2222-4333-8444-555555555555' }) }, 'bad.json', "beacon UUID is not Spike Venues'"],
];

for (const [kind, files, skippedFile, reason] of SKIP_KINDS) {
  const exportsFolder = { ...files, 'valid.json': exportWith({ name: 'Valid Next To It' }) };
  seedCase(`AC-25: ${kind}: one skip line, the valid export is seeded with its slot's Major, commit, exit 0`, { exports: exportsFolder }, async ({ run, rows }) => {
    committed(run);
    assert.deepEqual(skipLines(run), [lineFor(skippedFile, reason)]);
    assert.equal(
      run.out.concat(run.err).filter((l) => l.includes(SENTINEL)).length,
      0,
      'the line never carries file content beyond the file name',
    );
    const slot = Object.keys(exportsFolder).sort().indexOf('valid.json');
    const valid = await spikeVenue(rows, 'SPIKE_VALID');
    assert.deepEqual(valid.majors, [3 + slot], "the valid export keeps its slot's Major");
    const codes = await spikeCodes(rows);
    assert.ok(codes.includes('SPIKE_VALID'));
    const skippedCode = `SPIKE_${skippedFile.replace(/\.json$/, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    if (kind.startsWith('two file names')) {
      assert.ok(codes.includes(skippedCode), 'the earlier of the two is seeded');
      assert.equal(codes.filter((c) => c === skippedCode).length, 1);
      assert.equal((await spikeVenue(rows, skippedCode)).name, 'Kiosk A first', 'the later file did not replace it');
    } else {
      assert.ok(!codes.includes(skippedCode), 'the skipped export is not seeded');
    }
  });
}

seedCase(
  'AC-25: a database refusal the checks did not foresee rolls back only that file: the same line, the rest seeded',
  // Minor 70000 passes every check and is refused by CK_Beacon_Minor.
  { exports: { 'refused.json': exportWith({ name: 'Refused By The Database', beacons: [{ id: 'B1', minor: 70000, x: 2, y: 2 }] }), 'valid.json': exportWith({ name: 'Valid Next To It' }) } },
  async ({ run, rows }) => {
    committed(run);
    assert.deepEqual(skipLines(run), [lineFor('refused.json', 'the database refused it (ck_beacon_minor)')]);
    assert.equal(await spikeVenue(rows, 'SPIKE_REFUSED'), null, 'nothing of the refused file is left');
    assert.deepEqual((await spikeVenue(rows, 'SPIKE_VALID')).majors, [4]);
  },
);

seedCase(
  'AC-25: an export that passes every check but fails on write for a reason other than the database (a door with no rooms list): skipped as not a spike venue export, the rest seeded',
  // The shape check does not look inside a door, so the converter throws a TypeError at d.rooms.find: the catch-all branch.
  {
    exports: {
      'broken-door.json': exportWith({ name: 'Broken Door', doors: [{ id: 'D1', a: [1, 1], b: [2, 1] }] }),
      'valid.json': exportWith({ name: 'Valid Next To It' }),
    },
  },
  async ({ run, rows }) => {
    committed(run);
    assert.deepEqual(skipLines(run), [lineFor('broken-door.json', 'not a spike venue export')]);
    assert.equal(await spikeVenue(rows, 'SPIKE_BROKEN_DOOR'), null, 'nothing of the failed file is left (its savepoint was rolled back)');
    assert.deepEqual((await spikeVenue(rows, 'SPIKE_VALID')).majors, [4]);
  },
);
