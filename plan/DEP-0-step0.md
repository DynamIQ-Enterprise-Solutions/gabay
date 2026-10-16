Step 0 of plan/DEP-0.md 1.0 (spec/DEP-0.md r2, AC-1, AC-55): the doc checks of plan section 0, run on 2026-10-16 on branch `dep-0` (from origin/main 76ba8ac) under Node 22.23.3 (fnm). Pages were fetched with a small Node script (HTML stripped to text) and read; installed sources were read from `node_modules`. Nothing here used a credential or a cloud resource.

# DEP-0 step 0: findings

Legend: **CONFIRMED** (read this session), **CORRECTED** (the doc says something else), **UNCONFIRMED** (not found in what was read; the criterion it feeds says what happens), **DEFERRED** (needs a real resource: DEP-1).

## Row 1: the Cloud SQL connector (before step 2, E-29) — CONFIRMED

`npm view @google-cloud/cloud-sql-connector version license engines dependencies time.modified --json`, 2026-10-16:

```
version 1.12.1 · license Apache-2.0 · engines { node: ">=22" } · time.modified 2026-10-12T20:31:33.682Z
dependencies: gaxios ^8.1.0, p-throttle ^8.1.1, @grpc/grpc-js ^1.14.5, @google-cloud/sql ^0.25.0, google-auth-library ^11.1.0, @googleapis/sqladmin ^38.1.1
```

README (raw.githubusercontent.com/GoogleCloudPlatform/cloud-sql-nodejs-connector/main/README.md, 2026-10-16), "Using with PostgreSQL":

```
const connector = new Connector();
const clientOpts = await connector.getOptions({ instanceConnectionName: 'my-project:region:my-instance', ipType: 'PUBLIC' });
const pool = new Pool({ ...clientOpts, user, password, database, max: 5 });
await pool.end();
connector.close();
```

"By default, connections will be configured to 'PUBLIC' and connect over public IP". Also read: cloud.google.com/sql/docs/postgres/connect-connectors (fetched, 200). Node 22 is the project's engine, so the `>=22` range fits. **Consequences:** `getOptions` is async and returns the options for a `pg` pool (the stream), so the pool is built after the first `await`; `db/connector.js` creates the connector on first use and `close()` calls `pool.end()` then `connector.close()` (plan step 2). E-29 row: 1.12.1, Apache-2.0, expiry 2027-04-02.

## Row 1b: `@google-cloud/storage` under firebase-admin 14.5.0 (before step 1) — CONFIRMED

`npm ls @google-cloud/storage firebase-admin` in `functions/`:

```
+-- firebase-admin@14.5.0
| `-- @google-cloud/storage@8.2.0
`-- firebase-functions@7.4.0 (firebase-admin deduped)
```

## Row 7: Cloud Storage from Node (before step 1) — CONFIRMED from the installed 8.2.0 source (the hosted reference page is an index only)

`functions/node_modules/@google-cloud/storage/build/cjs/src/`:

- `file.d.ts` 189-257: `preconditionOpts?: PreconditionOptions` on `CreateResumableUploadOptions`, `CreateWriteStreamOptions` and `SaveOptions` (312). `file.js` 3633: `Object.assign(reqOpts.qs, this.instancePreconditionOpts, options.preconditionOpts)` (the simple upload); 3556 `params: options.preconditionOpts || ...` (the resumable upload). So `file.save(bytes, { preconditionOpts: { ifGenerationMatch: 0 } })` sends `ifGenerationMatch=0` on either path (a create-only write).
- `file.js` 3337-3380: `save` retries only when a precondition is set (`shouldRetryBasedOnPreconditionAndIdempotencyStrat`); with `ifGenerationMatch: 0` it is retry-safe by the library's own rule. Known edge, listed in the fake's table: a retry after a lost acknowledgement of a write that did land answers 412 "exists".
- Error shapes: `nodejs-common/util.js` 107-119 `ApiError { code = errorBody.code }`, with `code` the HTTP status number (line 233 `code: httpRespMessage.statusCode`); `resumable-upload.js` 483 and 710 set `code` to `resp.status` (number). `nodejs-common/service-object.js` 120-136: `delete({ ignoreNotFound: true })` swallows a 404. The store therefore reads `Number(err.code ?? err.status ?? err.response?.status)`: 412 = exists, 404 = missing, anything else is thrown.
- `bucket.d.ts` 121 and `file.d.ts` 170: `DeleteFileOptions.ignoreNotFound`.
- The object-name length limit (1024 bytes) was not found in the pages fetched: **UNCONFIRMED**, and not load-bearing (the services' keys are about 70 characters, EC-6). The contract suite uses the longest key the services make.

## Row 14: PostgreSQL 18 and `pg` (before step 3) — CONFIRMED

postgresql.org/docs/18, fetched 2026-10-16:

- `sql-alterdefaultprivileges.html`: "allows you to set the privileges that will be applied to objects created in the future. (It does not affect privileges assigned to already-existing objects.)"; `IN SCHEMA schema_name`: "the default privileges are altered for objects later created in that schema"; `FOR ROLE admin` form. So the grants step applies both a one-off `GRANT ... ON ALL TABLES` and `ALTER DEFAULT PRIVILEGES FOR ROLE gabay_migrate IN SCHEMA gabay`.
- `ddl-schemas.html`: "In PostgreSQL 15 and later, the default configuration supports this usage pattern" (no `CREATE` on `public` for everyone), so `gabay_api` has no `CREATE` on `public` by default; the test shows it.
- `runtime-config-logging.html`: `log_statement` values none, ddl, mod, all; "ddl logs all data definition statements". A `CREATE ROLE ... PASSWORD` can therefore reach a server log under `ddl` or `all` (the runbook says to keep it off during `--init-roles`).
- `functions-admin.html`: `pg_advisory_lock` (session-level, waits) and `pg_try_advisory_lock`; `runtime-config-client.html`: `lock_timeout`.
- Sequence privileges on identity columns: `sql-grant.html` covers sequence USAGE; whether an INSERT into a `GENERATED ALWAYS AS IDENTITY` column needs it is **settled by the integration test** (plan step 3), not by the page.
- `pg` 8.23.1 (`functions/node_modules/pg/lib/client.js` 605-613): `Client#escapeIdentifier` and `Client#escapeLiteral` exist. A multi-statement text with no parameters runs as one implicit transaction (the existing `setup-db` and runner rely on it).

## Row 2: IAM roles (before step 9) — CONFIRMED

docs.cloud.google.com/iam/docs/roles-permissions/{cloudsql,secretmanager,storage}, 2026-10-16:

- Cloud SQL Client `roles/cloudsql.client`: "Provides connectivity access to Cloud SQL instances" (`cloudsql.instances.connect`, `.get`); the function's account and the owner (proxy) need it.
- Secret Manager Secret Accessor `roles/secretmanager.secretAccessor`: "Allows accessing the payload of secrets"; grantable on the single secret.
- Storage Object User `roles/storage.objectUser`: "create, read, update and delete objects and multipart uploads". `roles/storage.objectCreator` "does not give permission to view, delete, or overwrite objects", so it cannot serve `get`, `exists` or `remove`. **The narrowest role that covers the store's four calls is `roles/storage.objectUser`, on the one bucket** (runbook text).
- The role that lets an owner account create users and links: the Admin SDK pages name no role; the project Owner has it. A narrower role name was not found in the pages read: **UNCONFIRMED**, so AC-56 names the Owner and the tool's AC-57 line covers a refusal. (RECALLED, was "Firebase Authentication Admin".)

## Row 4: SQL Connect (before step 9, docs only) — PARTLY CONFIRMED, rest DEFERRED

firebase.google.com/pricing, 2026-10-16: "Cloud SQL for PostgreSQL — 3 month no-cost trial. Limit 1 per project. If you have not upgraded your project to a paid plan (Blaze) by the end of your trial, your instance will be archived. After an additional 90 days, it will be deleted." (The docs have moved to firebase.google.com/docs/sql-connect.) Instance creation, the admin user's rights, the public IP and the stop control: **DEFERRED to DEP-1** (they need the instance; runbook text names them as "to confirm at DEP-1").

## Row 5: `defineSecret` (before step 6) — CONFIRMED

firebase.google.com/docs/functions/config-env, 2026-10-16:

- "Secret parameters must be bound to individual functions that should have access to them": `onRequest({ secrets: [discordApiKey] }, ...)`; `defineSecret` from `firebase-functions/params`.
- Secrets created with `firebase functions:secrets:set SECRET_NAME`: "Now you'll be able to access it like any other environment variable" (`process.env.SECRET_NAME`), and `secrets: ["SECRET_NAME"]`.
- "Whenever you set a new value for a secret, you must redeploy all functions that reference that secret for them to pick up the latest value." (AC-29's rotation order.)
- "Parameters and parameter expressions that are only used at runtime ..."; a secret read at deploy time is not needed: loading stays inert (index.test.js unchanged).
- `firebase-functions` 7.4.0 `v2/https` takes `secrets` in `HttpsOptions`: read locally (plan step 6 test reads the declared list from the exported function's `__endpoint.secretEnvironmentVariables`, confirmed when the test is written).

## Row 6: `.env.<projectId>`, reserved names, NODE_ENV (before step 6) — CONFIRMED, NODE_ENV UNCONFIRMED

Same page: the file is `.env.<project_ID>` in the `functions/` directory ("Loaded environment variables from .env, .env.prod."). **Reserved:** "All keys starting with X_GOOGLE_, All keys starting EXT_, All keys starting with FIREBASE_, and CLOUD_RUNTIME_CONFIG, ENTRY_POINT, GCP_PROJECT, GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT, FUNCTION_TRIGGER_TYPE, FUNCTION_NAME, FUNCTION_MEMORY_MB, FUNCTION_TIMEOUT_SEC, FUNCTION_IDENTITY, FUNCTION_REGION, FUNCTION_TARGET, FUNCTION_SIGNATURE_TYPE, K_SERVICE, K_REVISION, PORT, K_CONFIGURATION". `dep0.envTable.test.js` carries exactly this list. `docs.cloud.google.com/run/docs/container-contract` lists `PORT`, `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`. **`NODE_ENV` is not mentioned in either page** (UNCONFIRMED what the runtime sets), which is why the env table writes `NODE_ENV=production` explicitly and AC-27/AC-28 do not rely on it. `verify-id-tokens` (row 18) says the Admin SDK takes the project from `GOOGLE_CLOUD_PROJECT`, "available for code running on Google infrastructure", so the deployed verifier needs no `FIREBASE_PROJECT_ID`.

## Rows 10 and 17: Admin SDK, ADC, Spark (before step 5) — CONFIRMED, two points UNCONFIRMED

- firebase.google.com/docs/auth/admin/manage-users: `createUser` "Any combination of the following properties can be provided" (uid, email, emailVerified, phoneNumber, password, displayName, disabled, photoURL), so a user with no password is valid. firebase.google.com/docs/auth/admin/email-action-links: `generatePasswordResetLink(userEmail, actionCodeSettings)` takes "the existing user's email" and returns a link.
- **UNCONFIRMED:** the link's lifetime, that both calls work with sign-up switched off, and that email case is folded: none is stated on these pages. The tool never depends on a number: every run prints a fresh link (DC-18) and lower-cases the email itself (AC-37), so a wrong guess costs nothing. AC-58 (the owner's first real use) settles the first two.
- docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment: `gcloud auth application-default login` creates user-credential ADC; "ADC configured with a user account might not work for some APIs without extra configuration steps. If you see an error message about the API not being enabled in the project, or that there is no quota project available, see User credentials not working." So a quota project may be needed: plan owner step 2c and the AC-57 line name it (`gcloud auth application-default set-quota-project <projectId>`, RECALLED command, run only if the tool asks).
- firebase.google.com/pricing, 2026-10-16: **Spark:** Authentication "No-cost up to 50K MAUs"; Hosting "No-cost up to 10 GB" storage; Cloud Functions Invocations and GB-seconds "Not applicable" (Blaze only); Cloud SQL (SQL Connect) a 3-month trial, archived without Blaze; Cloud Storage for a project's bucket is billed as Google Cloud Storage usage (no Spark tier listed for non-legacy buckets). Consistent with spec row 17 and L186.

## Row 18: real-token verification on this machine (before step 5, note for SEC-1 and SEC-3) — CONFIRMED

firebase.google.com/docs/auth/admin/verify-id-tokens: "Note: This does not check whether or not the token has been revoked." `verifyIdToken(token)` alone needs only the project id ("an explicit `projectId` app option"). `firebaseVerifier.js` already passes `checkRevoked = true`, which its header (SEC-1 step 0) records as an authenticated Admin API call, so **the local API against the Spark project needs Application Default Credentials too** (the same `gcloud auth application-default login`), unlike the signature check alone. DEP-0 documents this in `.env.example` and INSTALL; SEC-1 and SEC-3 own the wiring.

## Rows 9, 15: bucket posture, the proxy (before step 9) — CONFIRMED (runbook text)

- docs.cloud.google.com/storage/docs/public-access-prevention: public access prevention can be set to `enforced` or `inherited`; "Uniform bucket-level access" is a bucket setting (runbook text: private, uniform, `asia-southeast1`; the bucket itself is DEP-1's).
- docs.cloud.google.com/sql/docs/postgres/sql-proxy: the Cloud SQL Auth Proxy v2 (`cloud-sql-proxy`, 2.26.2 at the time read) is run by the user with their own credentials; the role it needs is `roles/cloudsql.client` (row 2). Runbook text only.

## Rows 11, 12, 13 (before step 8) — rows 11 CONFIRMED; 12 and 13 partly DEFERRED

- firebase.google.com/docs/hosting/full-config: `hosting.headers` is an array of `{ "source": "<glob>", "headers": [ { "key": ..., "value": ... } ] }`; `rewrites` is `[ { "source": "**", "destination": "/index.html" } ]`. **"Firebase Hosting overwrites the Strict-Transport-Security configuration on default Hosting subdomains (like *.web.app)"**, so no HSTS header is written (the staging check reads it, item 1).
- Flutter web under a CSP (row 12): the Flutter docs fetched (platform-integration/web/faq) say nothing about a CSP. The policy is **found by running the release build under the Hosting emulator** (DC-22, plan step 8, manual DEP0.4), and its console output pasted. firebase.google.com/docs/auth/web/password-auth does not list the endpoints; they are read from the page's own network log in the same run.
- Row 13 (v2 defaults): the manage-functions page lists concurrency default 80 ("Concurrency is available only to functions with at least 1 full CPU"; "a function with less than 2GB RAM will disable concurrency") and "a separate default request timeout of 70 seconds (or 60 seconds on ...". The default memory (256 MiB, "1st gen default 256MiB") and the URL pattern are **DEFERRED to DEP-1** (the first deploy shows both). The 15 MB upload holds the file whole in memory: AC-12 is DEP-1's.

## F-a: `req.rawBody` on Cloud Functions — CONFIRMED

docs.cloud.google.com/run/docs/write-functions (the current home of write-http-functions): "Cloud Run automatically parses the request body for you based on the request's Content-Type header using body-parser, so you can access the req.body and req.rawBody objects in your HTTP handler."

## F-b: the Functions Framework — CONFIRMED from main's source; the deployed version UNCONFIRMED

`raw.githubusercontent.com/GoogleCloudPlatform/functions-framework-nodejs/main/src/server.ts` (package version 5.0.5, express ^5.0.0, body-parser ^2.2.2), 2026-10-16:

```
const requestLimit = '1024mb';          // "larger than 32MB, which is maximum limit of higher level layers anyway"
rawBodySaver: req.rawBody = buf
app.use(bodyParser.json(cloudEventsBodySavingOptions));
app.use(bodyParser.json(defaultBodySavingOptions));
app.use(bodyParser.text(...)); app.use(bodyParser.urlencoded(...));
app.use(bodyParser.raw({ ..., type: '*/*' }));    // "will process ALL content types so MUST come last"
app.enable('trust proxy');              // "To respect X-Forwarded-For header."
app.disable('x-powered-by');
app.set('etag', false);
```

There is **no error middleware** between the parsers and `app.all('/{*splat}', requestHandler)`. A JSON parse failure is therefore answered by Express's own final handler and the user's function never runs, the same as on the emulator (§0.1). **Consequences:** (1) R1 stands as written (the "Cloud calls the function with rawBody on a parse failure" branch does not occur); (2) the Cloud limit is the platform's 32 MB, not our 5 MB; (3) `x-powered-by` is off in the framework, so P-6's header comes from the emulator hub only; (4) the framework sets `trust proxy` true on its own app, but our `createApp` sets its own `trust proxy` (a hop count) on the app the handler is mounted as, and `req.ip` is computed by our app. Express's final handler hides the stack when `NODE_ENV=production` (expressjs finalhandler: the stack is shown unless `env === 'production'`, RECALLED, and the staging check template line proves it at DEP-1). **UNCONFIRMED:** which framework version the Node 22 build installs on Cloud; the template line decides.

## F-c: `X-Forwarded-For` behind Cloud Run — PARTLY CONFIRMED, DEFERRED to DEP-1

expressjs.com/en/guide/behind-proxies, 2026-10-16: a number for `trust proxy` "Use the address that is at most n number of hops away from the Express application. req.socket.remoteAddress is the first hop, and the rest are looked for in the X-Forwarded-For header from right to left"; "When using this setting, it is important to ensure there are not multiple, different-length paths to the Express application such that the client can be less than the configured number of hops away, otherwise it may be possible for the client to provide any value." With `TRUST_PROXY_HOPS=1`, the socket is hop 1 (Google's front end) and the right-most `X-Forwarded-For` entry is the client. The Cloud Run pages fetched (container-contract, write-functions) do not describe `X-Forwarded-For`: **UNCONFIRMED, DEFERRED to DEP-1**, whose template line (owner's write records their public address; a forged leading entry does not change it) is the proof. The risk (every client under one limiter key) is in the plan's section 4.

## F-d: `setHeader` merged with `writeHead` — CONFIRMED

nodejs.org/api/http.html, 2026-10-16: "When headers have been set with outgoingMessage.setHeaders(), they will be merged with any headers passed to response.writeHead(), with the headers passed to response.writeHead() given precedence."

## Section 0.1 (re-pasted from the installed sources)

- firebase-tools 15.32.1 `lib/emulator/functionsEmulatorRuntime.js` 541-560: `const app = express(); app.enable("trust proxy"); const bodyParserLimit = "32mb";` then `bodyParser.json`, `.text`, `.urlencoded`, `.raw({ type: "*/*" })`, each with `verify: rawBodySaver`; 379-381 `function rawBodySaver(req, res, buf) { req.rawBody = buf; }`; no error middleware before `app.all(...)`.
- `functionsRuntimeWorker.js` 109-113: `headers: req.headers` forwarded as is, no `X-Forwarded-For` added. `functionsEmulator.js` 139: `const hub = express();` with no `disable("x-powered-by")`.
- multer 2.4.0 `lib/make-middleware.js` 57-61, 123, 435: `streamHandler = options.streamHandler || defaultStreamHandler` and the comment "Environments that have already consumed the request body (e.g. Google Cloud Functions, which exposes it as `req.rawBody`) can provide a `streamHandler` that feeds busboy instead"; README 341-354: `if (req.rawBody) busboy.end(req.rawBody)`.

## Deferred to DEP-1 (listed in the PR)

Row 3 (the socket spike), row 8 (optional dependencies at deploy, EC-28), row 16 (monitoring), the deployed halves of rows 2, 4 to 7, 9, 11 and 13, F-c's address line, F-b's deployed framework version, and the unconfirmed points above (object-name limit, link lifetime, sign-up-off behaviour, the narrower Auth role).

# DEP-0 manual runs (2026-10-16, on this machine, Node 22.23.3)

## The page under the policy (DEP0.4; AC-48, DC-22)

The admin release build: `flutter build web -t lib/main_admin.dart --release --dart-define=API_BASE=https://asia-southeast1-gabay-staging.cloudfunctions.net/api` (Flutter 3.47.5; 1m44s; the release guard refuses a local address, so the function's own address pattern is used). Served from the **Firebase Hosting emulator** (firebase-tools 15.32.1) and opened in **headless Microsoft Edge and Google Chrome** over the DevTools protocol; the script waits for the Flutter first frame (`flt-glass-pane`) and prints every console message, CSP violation and failed request. (The harness is a scratch helper, not part of the repository.)

- **Probe of the emulator itself:** with five header rules (`source` `**`, `/**`, `**/*`, `**/*.@(js|html)`, and a `regex` `.*`) only the **regex** rule set its header on any path. The committed file keeps the documented glob `source: "**"` (what Firebase Hosting applies: firebase.google.com/docs/hosting/full-config, read 2026-10-16); the runs below use a copy of the committed `hosting` block in which that one rule is written `regex: ".*"`, and nothing else is changed.
- **No policy, baseline:** first frame reached; requests: `https://www.gstatic.com/flutter-canvaskit/<engine>/chromium/canvaskit.wasm` and `.../canvaskit.js`, and `https://fonts.gstatic.com/s/roboto/.../*.woff2` (the loader takes CanvasKit from Google's static host unless built locally); no request to the API at start.
- **The committed policy (`firebase.json`), Edge and Chrome:**
  ```
  first frame: true
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://www.gstatic.com https://fonts.gstatic.com https://asia-southeast1-gabay-staging.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
  Referrer-Policy: strict-origin-when-cross-origin · X-Content-Type-Options: nosniff · X-Frame-Options: DENY · X-Robots-Tag: noindex, nofollow
  console messages other than the loader's debug line: []
  failed requests: []
  ```
- **Variants that show the harness sees a violation:** with `style-src 'self'` alone, two console errors "Applying inline style violates the following Content Security Policy directive 'style-src 'self''" (the Flutter engine sets inline styles; hence `'unsafe-inline'` for styles only); without `'wasm-unsafe-eval'`, `CompileError: WebAssembly.compileStreaming(): Compiling or instantiating WebAssembly module violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source` and no first frame; without `https://www.gstatic.com`, `Loading the script '.../canvaskit.js' violates ...` and `Connecting to '.../canvaskit.wasm' violates ...`, `blocked=csp`, no first frame.
- **Not shown here (RECALLED, confirmed at SEC-3's merge and DEP-1):** the Firebase Auth hosts in `connect-src` (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`) are the Firebase JS SDK's email-and-password endpoints; SEC-3's sign-in screen is not merged on this base, so nothing in the page calls them yet. `firebase_auth` 6.7.0 on SEC-3's branch loads the SDK from `www.gstatic.com`, which `script-src` already allows. The function's real address is read at DEP-1's first deploy.
- `--no-web-resources-cdn` (Flutter) would bundle CanvasKit and the fonts and remove both `gstatic` hosts from the policy: a suggestion, not built (the documented build command is unchanged).

## The Functions emulator, malformed JSON (DEP0.2; R1)

`firebase emulators:exec --only functions` with the function's own environment, `POST /api/venues` with the body `{"code": `:

```
NODE_ENV=development  -> 400 text/html; charset=utf-8, x-powered-by: Express (the emulator hub's, F3)
    <pre>SyntaxError: Unexpected end of JSON input<br> &nbsp; &nbsp;at JSON.parse (&lt;anonymous&gt;)<br> &nbsp; &nbsp;at parse (C:\Users\User\FlutterProjects\Gabay-wt\api-coder\db\seeds\node_modules\body-parser\lib\types\json.js:96:19) ...
    (a stack and a file path: Express's final handler outside production)
NODE_ENV=production   -> 400 text/html; charset=utf-8
    <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Bad Request</pre> </body> </html>
    (no stack and no path)
```

The function never ran for either (the emulator's own parser answered). On staging `NODE_ENV=production` is written in the env table, so the platform's answer there carries no stack and no path; the staging check template has the line.

## The probe, on the real emulator (DEP0.1, DEP0.3 in their HTTP form)

`tools/functions-path-probe.js` inside `emulators:exec --only functions,auth` with the seed's export imported (what verify's `functions-health` runs):

```
PASS GET http://127.0.0.1:5011/demo-gabay/asia-southeast1/api/api/health: 200 {"status":"ok","db":"ok"} X-Request-Id: <uuid>
PASS i. an anonymous 6 MB JSON POST is the API's 413 { error }: HTTP 413 {"error":"Request body too large"}
PASS iii. an anonymous multipart POST is a JSON 401: HTTP 401 {"error":"Authentication required"}
PASS ii. a PNG upload by the signed-in mall admin is 201: HTTP 201 {"id":"<32 hex>","width":100,"height":80}
PASS ii. the image reads back byte for byte: HTTP 200
PASS ii. POST /clear answers 200: HTTP 200 {"draftVersion":0}
PASS iv. the writes left audit rows: 2 found
PASS iv. the audit rows hold the emulator's address 127.0.0.1 (F3): 127.0.0.1, 127.0.0.1
PASS iv. no audit row holds the upload's body (F4): clear: {"body":{"baseVersion":0},"query":{},"params":{"ve | backdrops: {"query":{},"params":{"venueId":"683"},"status":20
```

The admin page has **no backdrop upload screen yet** (OA-4's editor is not built), so DEP0.1's "through the admin page" is shown by the same request the page will send (a real multipart POST by a signed-in admin through the real emulator, 201, read back byte for byte). With the function's secret declared, the emulator asked Google Cloud Secret Manager for it ("Trying to access secret PGPASSWORD@latest ... Unable to refresh auth"): the function therefore does not declare it when `FUNCTIONS_EMULATOR=true` (AC-53), and the run no longer prints that line.
