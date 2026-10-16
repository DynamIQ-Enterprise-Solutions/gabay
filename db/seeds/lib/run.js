// The seed's work as a library (plan/FF-2-test-seeds.md section 3.2, D1): runSeed does everything seed.js used to do inside
// its transaction, on a client the caller owns. It never runs BEGIN, COMMIT or ROLLBACK, so a caller can wrap it in its own
// transaction (seed.js) or in a test's rolled-back one (db/seeds/test, functions/test/seed.visible.test.js). Every query
// passes a params array, so the API's own database object can be handed in too.
'use strict';

const fs = require('fs');
const path = require('path');
const { insert } = require('./db');
const { seedPlatform } = require('./lookups');
const { seedDemoVenue } = require('./demo');
const { seedSpikeVenue } = require('./spike');
const { seedAccounts, SEED_EMAILS } = require('./accounts');
const { readExports, skipLine, reasonForFailure, NO_EXPORTS_LINE } = require('./exports');

const SOURCES = path.join(__dirname, '..', 'sources');
const SPIKE_UUID = '87872435-5008-4e48-bd54-a7c561c885c3'; // what the penthouse's real H2s broadcast
const TENANTS = {
  DEMO_MALLS: { Name: 'Demo Malls', BeaconProximityUuid: null },
  SPIKE_VENUES: { Name: 'Spike Venues', BeaconProximityUuid: SPIKE_UUID },
};
const FIRST_EXPORT_MAJOR = 3; // after the penthouse (1) and MEZZ office (2)
const DEMO_VENUES = ['aurora', 'bayview', 'meridian', 'spire'];
// L119: the penthouse keeps Major 1 (its real H2s); MEZZ office gets Major 2. Exports take the next free Major.
const SPIKE_VENUES = [
  // internal: kept out of git (L48, L123); a clean clone has no copy, so it is skipped with a note.
  { file: 'internal/penthouse.json', code: 'PENTHOUSE', major: 1, internal: true },
  { file: 'spike/mezz.json', code: 'MEZZ_OFFICE', major: 2 },
];

// Children before parents. Table names are this file's constants, never input. OA-2 (schema 0.15; the owner's ruling Q2 (a),
// 2026-10-13): a seeded venue's map draft and backdrop images (VenueMapBackdrop, VenueMap, and their StoredFile rows) go with
// it, so a map saved on a seeded venue never stops the next seed. A venue version of any status still does (AC-23,
// refuseIfPublished: a BUILDING, FAILED or PUBLISHED row), because a version is never deleted by the seed. OA-3a (schema
// 0.17; spec/OA-3.md AC-12a): the twelve geometry tables are gone, so this is the list's final form.
const TENANT_TABLES = ['UserVenueGrant', 'UserRole', 'Beacon', 'Occupant', 'VenueMapBackdrop', 'VenueMap', 'StoredFile', 'Venue', 'BuildingType'];

async function removeTenant(client, code) {
  const t = await client.query('SELECT TenantId AS id FROM gabay.Tenant WHERE Code = $1', [code]);
  if (!t.rows.length) return;
  const id = t.rows[0].id;
  for (const table of TENANT_TABLES) await client.query(`DELETE FROM gabay.${table} WHERE TenantId = $1`, [id]);
  await client.query('DELETE FROM gabay.Tenant WHERE TenantId = $1', [id]);
}

async function removeAccounts(client) {
  await client.query('DELETE FROM gabay.UserRole WHERE UserId IN (SELECT UserId FROM gabay.AppUser WHERE Email = ANY($1))', [SEED_EMAILS]);
  await client.query('DELETE FROM gabay.UserVenueGrant WHERE UserId IN (SELECT UserId FROM gabay.AppUser WHERE Email = ANY($1))', [SEED_EMAILS]);
  await client.query('DELETE FROM gabay.AppUser WHERE Email = ANY($1)', [SEED_EMAILS]);
  await client.query('DELETE FROM gabay.ShopperAccount WHERE Email = ANY($1)', [SEED_EMAILS]);
}

/** Raised when the seed must not run: the caller prints its message as one line (AC-23). */
class SeedStopped extends Error {}

/**
 * AC-23, A8: a test tenant that holds any VenueVersion cannot be re-seeded, because a published version is frozen and the
 * tenant's venues cannot be deleted under it. Checked first, before any delete, insert or Auth emulator call. The seed never
 * touches a version or the frozen-version rule: the way out is setup-db, then publish:dev (FF-3).
 */
async function refuseIfPublished(client) {
  const { rows } = await client.query(
    'SELECT t.Code AS code FROM gabay.Tenant t WHERE t.Code = ANY($1) AND EXISTS (SELECT 1 FROM gabay.VenueVersion v WHERE v.TenantId = t.TenantId) ORDER BY t.Code',
    [Object.keys(TENANTS)],
  );
  if (!rows.length) return;
  const codes = rows.map((r) => r.code);
  const publish = codes.map((c) => `npm run publish:dev -- ${c} --all`).join(' and ');
  throw new SeedStopped(
    `Seed stopped: ${codes.join(', ')} ${codes.length > 1 ? 'hold' : 'holds'} venue versions, which the seed never deletes. Run npm run setup-db (it recreates every table and re-seeds), then ${publish} to publish again.`,
  );
}

/**
 * Removes the two test tenants and six accounts, then writes the platform rows, tenants, venues and accounts.
 * @param {{query: (text: string, params: any[]) => Promise<{rows: any[]}>}} client  inside the caller's transaction
 * @param {{sourcesDir?: string, withAccounts?: boolean, log?: (line: string) => void}} [options]
 * @returns {Promise<{venues: Array<{tenant: string, code: string, name: string, major: number|null, counts: object}>}>}
 */
async function runSeed(client, { sourcesDir = SOURCES, withAccounts = true, log = console.log } = {}) {
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(sourcesDir, rel), 'utf8'));
  const venues = [];

  await refuseIfPublished(client);
  await removeAccounts(client);
  for (const code of Object.keys(TENANTS)) await removeTenant(client, code);
  const ids = await seedPlatform(client);

  const tenants = {};
  for (const [code, t] of Object.entries(TENANTS)) tenants[code] = await insert(client, 'Tenant', { Code: code, ...t }, 'TenantId');
  const venuesByTenant = { DEMO_MALLS: [], SPIKE_VENUES: [] };

  for (const id of DEMO_VENUES) {
    const v = readJson(`demo/${id}.json`);
    const { venueId, counts } = await seedDemoVenue(client, tenants.DEMO_MALLS, ids, v);
    venuesByTenant.DEMO_MALLS.push(venueId);
    venues.push({ tenant: 'DEMO_MALLS', code: v.id.toUpperCase(), name: v.name, major: null, counts });
    log(`Demo Malls  · ${v.name}: ${JSON.stringify(counts)}`);
  }
  const spikeVenue = async (s, v) => {
    const { venueId, counts } = await seedSpikeVenue(client, tenants.SPIKE_VENUES, ids, v, s);
    venuesByTenant.SPIKE_VENUES.push(venueId);
    venues.push({ tenant: 'SPIKE_VENUES', code: s.code, name: v.name, major: s.major, counts });
    log(`Spike Venues · ${v.name} (Major ${s.major}): ${JSON.stringify(counts)}`);
  };
  for (const s of SPIKE_VENUES) {
    if (s.internal && !fs.existsSync(path.join(sourcesDir, s.file))) {
      log(`Spike Venues · skipped ${s.code}: sources/${s.file} is internal and not in git (L123); copy it in from an internal source to seed it.`);
      continue;
    }
    await spikeVenue(s, readJson(s.file));
  }

  // The owner's exports (AC-7, AC-8, AC-25): checked before anything is written, then one savepoint each (D7), so a refusal the
  // checks did not foresee undoes only that file.
  const exported = readExports(sourcesDir, FIRST_EXPORT_MAJOR, SPIKE_UUID);
  if (!exported.length) log(NO_EXPORTS_LINE);
  for (const e of exported) {
    if (e.reason) {
      log(skipLine(e.file, e.reason));
      continue;
    }
    await client.query('SAVEPOINT seed_export', []);
    try {
      await spikeVenue({ code: e.code, major: e.major }, e.venue);
      await client.query('RELEASE SAVEPOINT seed_export', []);
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT seed_export', []);
      await client.query('RELEASE SAVEPOINT seed_export', []);
      log(skipLine(e.file, reasonForFailure(error)));
    }
  }

  if (withAccounts) for (const line of await seedAccounts(client, ids, tenants, venuesByTenant)) log(`Account · ${line}`);
  return { venues };
}

module.exports = { runSeed, SeedStopped, TENANT_TABLES, TENANTS };
