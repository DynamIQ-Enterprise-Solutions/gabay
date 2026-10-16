// npm run staging:admin: the logic (spec/DEP-0.md r2 AC-37 to AC-40, AC-42, AC-56, AC-57; plan/DEP-0.md 1.0 step 5). A library over an
// injected database object and an injected Admin auth object, so the tests run it on a throwaway database with a fake auth: no
// cloud, no network, no Auth emulator (AC-42). The command line, the environment refusals and the real Admin SDK are
// stagingAdminCli.js (the refusals of AC-41 are NOT reachable from here).
//
// What it does for `<email> <role> [<tenant>]`, in this order (AC-38):
//   1. validate, reading Role and Tenant (AC-37): the email lower-cased and never @gabay.test, the role an ACTIVE row of Role, a
//      platform role (IsPlatformRole) with no tenant and any other role with one active tenant named by Code;
//      refuse an AppUser row that belongs to another sign-in (AC-40) before anything is created
//   2. make sure the Firebase user exists: the Admin SDK creates it with NO password when it is missing, and it is reused when
//      it is there
//   3. in ONE transaction: the AppUser row if absent, the UserRole row if absent, and the venue grants (AC-39): none for a
//      tenant-wide role (server policy TENANT_WIDE_ROLE_CODES, one list, not a copy), a grant for every venue the tenant has
//      now for any other role
//   4. last, the password-setup link, printed once by the caller. It is never written to a file, a log or a table: Gabay never
//      holds a password (PH2 Q4). Every run makes a fresh one, because a link expires, so a re-run is how the owner gets another.
//
// Rules 2 and 3: every value is a bound parameter; the tenant is the Code the owner named, resolved here to its id.
'use strict';

const { TENANT_WIDE_ROLE_CODES } = require('../../functions/src/auth/routeKeys');

/** AppUser.Email and DisplayName widths (db/schema.sql). */
const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 120;
/** The six test accounts have known passwords and never reach a real Firebase project (AC-37). */
const TEST_ACCOUNT_SUFFIX = '@gabay.test';
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = '23505';

/** A refusal: the message is the one plain line the owner reads; nothing was written (unless `partial`, said in the line). */
class StagingAdminRefusal extends Error {}

/** Lower-cases and checks the address. Returns the address, or throws the refusal. */
function checkEmail(raw) {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (email === '' || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) {
    throw new StagingAdminRefusal(
      `"${String(raw ?? '').slice(0, 60)}" is not an email address (at most ${EMAIL_MAX} characters).`,
    );
  }
  if (email.endsWith(TEST_ACCOUNT_SUFFIX)) {
    throw new StagingAdminRefusal(
      `${TEST_ACCOUNT_SUFFIX} addresses are the local test accounts and never go to a real Firebase project: use your own address.`,
    );
  }
  return email;
}

/** The name shown in the admin page: the part of the address before the @ (DC-18), cut to the column's width. */
const displayNameOf = (email) => email.split('@')[0].slice(0, DISPLAY_NAME_MAX);

/**
 * One plain line for a failure of the Admin SDK (AC-57): the cause and the fix, never the SDK's own text, a token or a path.
 * @param {unknown} err
 * @param {string} projectId
 */
function describeAuthFailure(err, projectId) {
  const code = typeof err?.code === 'string' ? err.code : '';
  const text = typeof err?.message === 'string' ? err.message : '';
  // The SDK's own codes come first (a permission error's text also says "credential"), then what the credential library says.
  if (code === 'auth/project-not-found' || /PROJECT_NOT_FOUND/.test(text)) {
    return `The Firebase project "${projectId}" was not found. Check STAGING_PROJECT_ID, and that you are signed in with the Google account that owns it. Nothing was written.`;
  }
  if (code === 'auth/configuration-not-found' || /CONFIGURATION_NOT_FOUND/.test(text)) {
    return `Authentication is not set up for the project "${projectId}". In the Firebase console open Authentication, press Get started and turn on Email/Password. Nothing was written.`;
  }
  if (code === 'auth/operation-not-allowed') {
    return `The Email/Password sign-in method is switched off for the project "${projectId}". Turn it on in the Firebase console under Authentication, then run this again. Nothing was written.`;
  }
  if (
    /quota project|USER_PROJECT_DENIED|has not been used in project|SERVICE_DISABLED/i.test(text)
  ) {
    return `Google asks for a quota project for your login. Run \`gcloud auth application-default set-quota-project ${projectId}\`, then run this again. Nothing was written.`;
  }
  if (
    code === 'auth/insufficient-permission' ||
    /PERMISSION_DENIED|insufficient permission|forbidden/i.test(text)
  ) {
    return `Your Google account may not manage users in the project "${projectId}". Use the account that owns the project (its Owner may), then run this again. Nothing was written.`;
  }
  if (code === 'app/invalid-credential' || /default credentials|invalid_grant|reauth/i.test(text)) {
    if (/invalid_grant|reauth|expired|revoked/i.test(text)) {
      return 'Your Google login has expired. Sign in again with `gcloud auth application-default login`, then run this again. Nothing was written.';
    }
    return 'No Google login was found on this machine. Sign in with `gcloud auth application-default login`, then run this again. Nothing was written.';
  }
  const shown = /^(auth|app)\/[a-z-]+$/.test(code) ? ` (${code})` : '';
  return `Firebase did not accept the request${shown}. Nothing was written. Check the project in the Firebase console and try again.`;
}

/** True when the error is "no such user" from getUserByEmail. */
const isUserNotFound = (err) => err?.code === 'auth/user-not-found';

/**
 * @param {object} deps
 * @param {{ query: Function, withTransaction: Function }} deps.db  the API's db shape; a pg client in an adapter for the CLI
 * @param {{ getUserByEmail: Function, createUser: Function, generatePasswordResetLink: Function }} deps.auth  the Admin SDK's Auth
 * @param {string} deps.projectId  named in the plain failure lines
 * @param {{ email: string, role: string, tenant?: string|null }} deps.input
 * @returns {Promise<{ email: string, userId: number, firebaseUid: string, firebaseUser: 'created'|'reused', role: string,
 *   tenant: string|null, roleAdded: boolean, accountAdded: boolean, grantsAdded: number, venueCount: number|null,
 *   alreadyThere: boolean, link: string }>}
 * @throws {StagingAdminRefusal} every refusal and failure, as one plain line
 */
async function provisionAdmin({ db, auth, projectId, input }) {
  // 1. validate (AC-37): nothing is written, to the database or to Firebase, until all of it passes.
  const email = checkEmail(input.email);
  const roleRow = (
    await db.query(
      'SELECT RoleId AS id, Code AS code, IsPlatformRole AS platform FROM gabay.Role WHERE Code = $1 AND IsActive',
      [String(input.role ?? '')],
    )
  ).rows[0];
  if (!roleRow)
    throw new StagingAdminRefusal(
      `"${input.role}" is not an active role. The roles are the rows of the Role table.`,
    );
  let tenantRow = null;
  if (roleRow.platform) {
    if (input.tenant)
      throw new StagingAdminRefusal(
        `${roleRow.code} is a platform role: it takes no tenant. Remove "${input.tenant}".`,
      );
  } else {
    if (!input.tenant)
      throw new StagingAdminRefusal(
        `${roleRow.code} needs a tenant: add its code (for example DEMO_MALLS).`,
      );
    tenantRow = (
      await db.query(
        'SELECT TenantId AS id, Code AS code FROM gabay.Tenant WHERE Code = $1 AND IsActive',
        [String(input.tenant)],
      )
    ).rows[0];
    if (!tenantRow)
      throw new StagingAdminRefusal(
        `"${input.tenant}" is not an active tenant. A tenant is named by its code.`,
      );
  }

  // 2. the Firebase user: reuse, or create with no password. An AppUser row for this address that belongs to another sign-in is
  // refused first (AC-40), so no stray Firebase user is made for it.
  const existingRow = (
    await db.query('SELECT UserId AS id, FirebaseUid AS uid FROM gabay.AppUser WHERE Email = $1', [
      email,
    ])
  ).rows[0];
  let firebaseUser = 'reused';
  let uid;
  try {
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch (err) {
      if (!isUserNotFound(err)) throw err;
      if (existingRow) {
        throw new StagingAdminRefusal(
          `An account row for ${email} already exists, but it belongs to a different sign-in than any Firebase user of this project. Nothing was changed: check the project and the address.`,
        );
      }
      uid = (
        await auth.createUser({
          email,
          emailVerified: false,
          displayName: displayNameOf(email),
          disabled: false,
        })
      ).uid;
      firebaseUser = 'created';
    }
  } catch (err) {
    if (err instanceof StagingAdminRefusal) throw err;
    throw new StagingAdminRefusal(describeAuthFailure(err, projectId));
  }
  if (existingRow && existingRow.uid !== uid) {
    throw new StagingAdminRefusal(
      `An account row for ${email} already exists with a different Firebase UID. Nothing was changed, and the UID is never overwritten: check the project and the address.`,
    );
  }

  // 3. one transaction (AC-38, AC-39).
  let written;
  let alreadyThere = false;
  try {
    written = await db.withTransaction(async (tx) => {
      let userId = existingRow?.id;
      let accountAdded = false;
      if (userId === undefined) {
        const made = await tx.query(
          `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName, IsActive) VALUES ($1, $2, $3, TRUE)
           ON CONFLICT DO NOTHING RETURNING UserId AS id`,
          [uid, email, displayNameOf(email)],
        );
        if (made.rows.length > 0) {
          userId = made.rows[0].id;
          accountAdded = true;
        } else {
          // Another run made it a moment ago (or the same UID is on another address): read what is there and compare.
          const found = (
            await tx.query(
              'SELECT UserId AS id, FirebaseUid AS uid FROM gabay.AppUser WHERE Email = $1',
              [email],
            )
          ).rows[0];
          if (!found || found.uid !== uid) {
            throw new StagingAdminRefusal(
              `The Firebase UID of ${email} is already used by another account row. Nothing was changed.`,
            );
          }
          userId = found.id;
        }
      }
      const role = await tx.query(
        `INSERT INTO gabay.UserRole (UserId, RoleId, TenantId) VALUES ($1, $2, $3)
         ON CONFLICT ON CONSTRAINT uq_userrole DO NOTHING RETURNING 1`,
        [userId, roleRow.id, tenantRow?.id ?? null],
      );
      let grantsAdded = 0;
      let venueCount = null;
      if (tenantRow && !TENANT_WIDE_ROLE_CODES.includes(roleRow.code)) {
        const venues = (
          await tx.query(
            'SELECT VenueId AS id FROM gabay.Venue WHERE TenantId = $1 ORDER BY VenueId',
            [tenantRow.id],
          )
        ).rows;
        venueCount = venues.length;
        for (const venue of venues) {
          const granted = await tx.query(
            `INSERT INTO gabay.UserVenueGrant (TenantId, UserId, VenueId) VALUES ($1, $2, $3)
             ON CONFLICT (UserId, VenueId) DO NOTHING RETURNING 1`,
            [tenantRow.id, userId, venue.id],
          );
          grantsAdded += granted.rows.length;
        }
      }
      return { userId, accountAdded, roleAdded: role.rows.length > 0, grantsAdded, venueCount };
    });
  } catch (err) {
    if (err instanceof StagingAdminRefusal) throw err;
    if (err?.code === UNIQUE_VIOLATION) {
      // Two runs at once: the other one's rows are there. Read as "already there", never a stack (AC-40).
      alreadyThere = true;
      const found = (
        await db.query('SELECT UserId AS id FROM gabay.AppUser WHERE Email = $1', [email])
      ).rows[0];
      written = {
        userId: found?.id ?? null,
        accountAdded: false,
        roleAdded: false,
        grantsAdded: 0,
        venueCount: null,
      };
    } else {
      const kept =
        firebaseUser === 'created'
          ? 'The Firebase user was made and stays'
          : 'The Firebase user is untouched';
      throw new StagingAdminRefusal(
        `The database refused the rows (${typeof err?.code === 'string' ? err.code : 'error'}), so none were written. ${kept}: run this again and it will be reused.`,
      );
    }
  }

  // 4. the link, last, a fresh one on every run.
  let link;
  try {
    link = await auth.generatePasswordResetLink(email);
  } catch (err) {
    throw new StagingAdminRefusal(
      `The rows are written, but Firebase would not make the password link. ${describeAuthFailure(err, projectId).replace(' Nothing was written.', '')} Run this again to get a link.`,
    );
  }
  return {
    email,
    firebaseUid: uid,
    firebaseUser,
    role: roleRow.code,
    tenant: tenantRow?.code ?? null,
    alreadyThere,
    link,
    ...written,
  };
}

/**
 * The plain lines the command prints for a result, without the link (the command prints that last, once).
 * @param {Awaited<ReturnType<typeof provisionAdmin>>} r
 * @returns {string[]}
 */
function summaryLines(r) {
  const lines = [
    `Firebase user ${r.email}: ${r.firebaseUser === 'created' ? 'created, with no password' : 'already there, reused'}.`,
    `Account row: ${r.accountAdded ? 'added' : 'already there'}. Role ${r.role}${r.tenant ? ` in ${r.tenant}` : ' (platform)'}: ${r.roleAdded ? 'added' : 'already held'}.`,
  ];
  if (r.alreadyThere)
    lines.push('Another run added these rows at the same moment: they are there.');
  if (r.venueCount === null) {
    lines.push(
      `${r.role} sees every venue of its ${r.tenant ? 'tenant' : 'platform'}: no venue grants are written.`,
    );
  } else if (r.venueCount === 0) {
    lines.push(
      `${r.tenant} has no venues yet, so ${r.role} has no venue grants: run this again after a venue is added.`,
    );
  } else {
    lines.push(
      `Venue grants added: ${r.grantsAdded} (${r.venueCount} venue(s) in ${r.tenant}). A venue drawn later is not covered: run this again after adding one.`,
    );
  }
  return lines;
}

/** An adapter that gives a single pg client the API's db shape (query, withTransaction) for the command line. */
function dbOfClient(client) {
  return {
    query: (text, params) => client.query(text, params),
    async withTransaction(fn) {
      await client.query('BEGIN');
      try {
        const result = await fn({ query: (text, params) => client.query(text, params) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    },
  };
}

module.exports = {
  provisionAdmin,
  summaryLines,
  describeAuthFailure,
  dbOfClient,
  checkEmail,
  displayNameOf,
  StagingAdminRefusal,
  TEST_ACCOUNT_SUFFIX,
};
