# SEC-1 step 0: the doc checks (plan/SEC-1.md 1.0 §0; spec/SEC-1.md r2 §11, AC-57, AC-58)

> **Date:** 2026-10-15 · **By:** api-coder · **Read:** the installed packages in `functions/node_modules` (firebase-admin 14.5.0, google-auth-library 11.1.0, cors 2.8.6, express 5.2.1 with router 2.2.0) and four pages fetched this session (firebase.google.com: `docs/auth/admin/verify-id-tokens`, `docs/auth/admin/manage-sessions`, `docs/admin/setup`, `pricing`; nodejs.org: `docs/latest-v22.x/api/async_context.html`, `.../http.html`). Each finding below quotes the source it rests on. The PR description carries this file.

## (a) Credentials for the revocation check

**Finding: a credential is required against a real project. Without one every real-mode request is 503, never an accept. The owner's key steps apply (SEC1.20).**

- `lib/auth/base-auth.js` line 116: `verifyIdToken(idToken, checkRevoked = false)` → `idTokenVerifier.verifyJWT(...)`, then `if (checkRevoked || isEmulator) return this.verifyDecodedJWTNotRevokedOrDisabled(...)` (line 122) → `this.getUser(decodedIdToken.sub)` (line 964) → `authRequestHandler.getAccountInfoByUid` (an `accounts:lookup` call).
- `lib/auth/auth-api-request.js` line 187: `class AuthHttpClient extends AuthorizedHttpClient`; `getToken()` returns the literal `'owner'` **only** when `isEmulator`, otherwise `super.getToken()`, which is `this.app.INTERNAL.getToken()` (`lib/utils/api-request.js` line 862): an OAuth2 access token from the app's credential, sent as `Authorization`. So the lookup is an authenticated Admin API call and needs a credential.
- `lib/app/firebase-app.js` line 147: `if (!('credential' in options)) options.credential = getApplicationDefault(...)`. Gabay's verifier passes `{ projectId }` and no credential, so the credential is `ApplicationDefaultCredential` (`lib/app/credential-internal.js` line 38), a `google-auth-library` `GoogleAuth` with the `identitytoolkit` scope.
- `google-auth-library/build/src/auth/googleauth.js` `getApplicationDefaultAsync` (line 245): the default credential reads `process.env['GOOGLE_APPLICATION_CREDENTIALS']` first (line 316); when unset it tries the gcloud well-known file (line 336) and then the GCE metadata server (line 281, a network probe), and otherwise throws "Could not load the default credentials". So a machine with `gcloud auth application-default login` done for another project would use that identity: the owner's steps set the variable explicitly.
- **Relative path:** line 386, `filePath = fs.realpathSync(filePath)`: a relative path resolves against the process's working directory. The owner's steps use an absolute path, outside the repository, either way.
- **The failure:** a credential that cannot be loaded or refreshed is rethrown by `FirebaseApp` as `FirebaseAppError` with code `app/invalid-credential` (`lib/app/firebase-app.js` lines 77 to 93; `lib/app/error.js` line 32 prefixes `app/`); `auth-api-request.js` line 1706 rethrows non-HTTP errors unchanged. `classifyVerifyError` has no entry for `app/invalid-credential`, so it is **503 `Authentication service unavailable`** and the token is not accepted (AC-58).
- **Firebase docs (fetched):** verify-id-tokens, "Before you begin": *"To verify ID tokens with the Firebase Admin SDK, you must have a service account."* Admin setup: *"You can either set the GOOGLE_APPLICATION_CREDENTIALS environment variable, or you can explicitly pass the path to the service account key in code. The first option is more secure and is strongly recommended."* manage-sessions: *"the additional checkRevoked boolean flag has to be passed to verifyIdToken"*.
- **Spark plan:** the pricing page lists, under Authentication, *"Other Authentication services: check (no-cost Spark plan), check (Blaze)"*; only phone auth is Blaze-only (*"Phone Auth: Not applicable (Spark), billed per SMS sent"*). None of the four pages fetched names a plan restriction on the Admin SDK or on `accounts:lookup`. **This last point stays partly RECALLED** (no page says "the Admin SDK works on Spark" in words); SEC1.20, owner-run, is its check. Nothing automated depends on it.
- **Owner's steps (step 6, INSTALL.md):** create a service-account key for the real project in the Firebase console (Project settings → Service accounts), save the file outside the repository, and set `GOOGLE_APPLICATION_CREDENTIALS=<absolute path>` in the local `.env`. Never committed, printed or logged; agents never create, hold or read it.

## (b) `alg: none` in real-project mode

**Finding: an unsigned (emulator) token is refused by the content check, before any key fetch or network call, when no emulator host is set. AC-57's emulator-token case stays an automated test.**

- `lib/auth/token-verifier.js` line 117 `verifyJWT` → `ensureProjectId()` (line 152) → `util.findProjectId(app)` (`lib/utils/index.js` line 116): an explicit `projectId` app option is returned with no network call.
- `decodeAndVerify` (line 162): `safeDecode` (no network), then `verifyContent(...)` **before** `verifySignature(...)`.
- `verifyContent` (line 191): `if (!isEmulator && typeof header.kid === 'undefined')` → `"Firebase ID token has no "kid" claim."`; `else if (!isEmulator && header.alg !== 'RS256')` → incorrect algorithm. Both throw `FirebaseAuthError(INVALID_ARGUMENT)`, code `auth/argument-error`, which `TOKEN_REFUSALS` maps to **401 `Invalid session`**.
- `lib/utils/jwt.js` line 174: the real verifier allows only `[RS256, ES256]`; line 215: `EmulatorSignatureVerifier` allows `['none']`, chosen only when `isEmulator` (`token-verifier.js` line 254).
- `isEmulator` is `this.emulatorMode = !!this.authRequestHandler.emulatorHostValue` (`base-auth.js` line 62), read from `process.env.FIREBASE_AUTH_EMULATOR_HOST` (`auth-api-request.js` line 2050) when the Auth service is created. `firebaseVerifier.js` sets that variable only when `config.firebase.authEmulatorHost` is set, and config reads the same `process.env` (an empty value is "unset" in both: `parseConfig` drops `''`, and the SDK tests `!!host`). So config's mode and the SDK's mode agree. `sec1.authModes.test.js` deletes the variable in its own process and records `http`, `https` and `http2` requests to show that no request is made.

## (c) `AsyncLocalStorage`: a nested `run` gives the inner chain its own store

**Finding: confirmed by the docs and by a test.** Node 22 docs, `asyncLocalStorage.run(store, callback)`: *"Runs a function synchronously within a context and returns its return value. The store is not accessible outside of the callback function. The store is accessible to any asynchronous operations created within the callback."* The page does not say "nested" in words, so the behaviour is proven by `requestContext.test.js` (a nested `run` sees the inner store, and the outer store returns after it). `actorContext` → `auth` already relies on it (S1).

## (d) `cors`: a preflight is answered by the app-level middleware, and the requested headers are reflected

**Finding: confirmed from `cors/lib/index.js` 2.8.6.**
- line 11: defaults `preflightContinue: false`, `optionsSuccessStatus: 204`; line 163: `if (method === 'OPTIONS')` sets the headers, then with `preflightContinue` false does `res.statusCode = options.optionsSuccessStatus; res.end()`, so no later middleware runs.
- `configureAllowedHeaders` (line 94): with no `allowedHeaders` option, *"reflect the request headers"*: `Access-Control-Allow-Headers` = the request's `Access-Control-Request-Headers`.
- Caveat for AC-50: in `corsMiddleware`, `originCallback(origin, (err2, origin) => { if (err2 || !origin) next(err2); ... })`: an Origin **not** on the allow-list falls through to the route chain (so it meets `auth`, 401). AC-50 is about an allowed Origin, which is what `sec1.cors.test.js` sends; the test also shows the not-allowed case for the record.

## (e) Express 5 ordering

**Finding: confirmed from `router` 2.2.0 (Express 5.2.1's router).**
- A rejected async middleware reaches the error handler: `lib/layer.js` line 142 `handleRequest`: `const ret = fn(req, res, next); if (isPromise(ret)) ret.then(null, (error) => next(error || new Error('Rejected promise')))`.
- `router.use(path, ...fns)` runs for every path under it, matched or not: `index.js` line 397: `new Layer(path, { sensitive, strict: false, end: false }, fn)` (a prefix match), one layer per function in the list. So `router.use('/venues', ...tenantChain, venueRoutes)` runs the chain for `/venues/anything` before the sub-router's 404 (EC-43).
- `HEAD` runs the `GET` route (EC-45, not tested): `lib/route.js` line 111: `if (method === 'head' && !this.methods.head) method = 'get'`.

## (f) Node joins a repeated custom header with `, `

**Finding: confirmed by the Node 22 docs (http, `message.headers`).** *"Duplicates of age, authorization, content-length, content-type, ... are discarded. ... For all other headers, the values are joined together with , ."* So two `X-Tenant-Id` lines arrive as `"<a>, <b>"`, which fails the strict pattern (AC-4). `sec1.tenantContext.test.js` sends a repeated header through a raw `http.request` and asserts the 403 (the assertion is the check). Also noted: a repeated `Authorization` is **discarded** (the first is kept), not joined.

## What stays RECALLED

- That a Spark-plan project may call the Admin Auth API (`accounts:lookup`): supported by the pricing page's "Other Authentication services: no-cost on Spark", not stated in words; SEC1.20 checks it.
- EC-39 (Node refuses an over-size header before Express): not checked, not tested, not load-bearing.
