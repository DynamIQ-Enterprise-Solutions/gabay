// Test support for DEP-0 (plan/DEP-0.md 1.0 step 5, AC-42; not a test file): a fake Firebase Admin `Auth` object, the three calls
// staging:admin makes, so its logic runs with no network, no emulator and no credential.
//
//   fakeAdminAuth({ users })     users: email -> { uid }   (Firebase keeps addresses in lower case)
//     .calls                     every call in order: { method, args }
//     .created                   the properties of every createUser call (a test shows there is no `password`)
//     .users                     the Map of email -> { uid, ...properties }
//     .failWith(method, error)   makes that method reject with `error` from now on (null clears it)
//   links are fresh on every call and carry a counter, as a real link expires and differs.
'use strict';

/** Module-wide: two fakes in one test never hand out the same UID, as two Firebase users never share one. */
let uidCounter = 0;

function notFound() {
  return Object.assign(
    new Error('There is no user record corresponding to the provided identifier.'),
    {
      code: 'auth/user-not-found',
    },
  );
}

function fakeAdminAuth({ users = {} } = {}) {
  const table = new Map(Object.entries(users).map(([email, user]) => [email, { ...user }]));
  const calls = [];
  const created = [];
  const failures = new Map();
  let linkCounter = 0;

  async function run(method, args, action) {
    calls.push({ method, args });
    if (failures.has(method)) throw failures.get(method);
    return action();
  }

  return {
    calls,
    created,
    users: table,
    failWith(method, error) {
      if (error) failures.set(method, error);
      else failures.delete(method);
    },
    getUserByEmail: (email) =>
      run('getUserByEmail', [email], () => {
        const user = table.get(email);
        if (!user) throw notFound();
        return { ...user };
      }),
    createUser: (properties) =>
      run('createUser', [properties], () => {
        created.push({ ...properties });
        uidCounter += 1;
        const user = { uid: `fb-uid-${uidCounter}`, ...properties };
        table.set(properties.email, user);
        return { ...user };
      }),
    generatePasswordResetLink: (email) =>
      run('generatePasswordResetLink', [email], () => {
        linkCounter += 1;
        return `https://fake-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fake-code-${linkCounter}&email=${encodeURIComponent(email)}`;
      }),
  };
}

module.exports = { fakeAdminAuth };
