# SEC-3 step 0: doc and source checks (2026-10-15)

Version 1.0. Plan: `plan/SEC-3.md` 1.0. Spec: `spec/SEC-3.md` r2. Written on branch `sec-3` (base `origin/main` with `origin/sec-1` merged, `a1919e0`), before any dependency or code change. Every quotation is from a file read this session; the path is given so a reviewer can re-read it. "Not checked" means this session had no way to read the page; none of those claims is load-bearing for code in this slice, and each is listed at the end.

## The SEC-1 contract, re-read at the merge

`functions/src/routes/me.js`, `functions/src/middleware/tenantContext.js` (`MSG`) and `functions/src/auth/routeKeys.js` on this branch match plan section 0 exactly:

- `GET /api/me` returns `{user, isSuperAdmin, platformRoles, tenants[]}`, and for a SUPERADMIN only `actAsTenants: [{tenantId, code, name, isActive}]`, every tenant (`tenantId` and `isActive`, not the spec's `id` and `active`: the difference the plan lists for sign-off).
- The five refusals are `Choose a tenant: this works inside one tenant` (400), `This account has no access to that tenant` (403), `This tenant is not active` (403), `You do not have permission to do this` (403) and `Permission check unavailable` (503).
- `ROUTE_KEYS` = `lookups`, `venues`, `venue-maps`, `venue-versions`.

No difference found, so the slice does not stop.

## (a) Packages, minimum SDKs, FlutterFire web init, the defines file

Versions (pub.dev, resolved with `flutter pub get` in a scratch project on this machine, 2026-10-15): `firebase_core 4.15.0`, `firebase_auth 6.7.0`. Transitive packages the resolver adds: `_flutterfire_internals 1.3.77`, `firebase_auth_platform_interface 9.1.0`, `firebase_auth_web 6.3.0`, `firebase_core_platform_interface 8.1.1`, `firebase_core_web 3.12.0`, `http 1.6.0`, `http_parser 4.1.2`, `web 1.1.1`, `async 2.13.1`, `meta 1.19.0`, `plugin_platform_interface 2.1.8` (the plan lists the final set from `pubspec.lock` in step 1).

Minimum SDKs, read from each package's own files in the pub cache:

| Where | Value | Floor in this repository | Result |
|---|---|---|---|
| `firebase_core-4.15.0/pubspec.yaml` `environment` | `sdk: ^3.6.0`, `flutter: >=3.27.0` | Dart 3.13.5, Flutter 3.47.5 | passes |
| `firebase_auth-6.7.0/pubspec.yaml` `environment` | `sdk: ^3.6.0`, `flutter: >=3.16.0` | same | passes |
| `firebase_auth-6.7.0/pubspec.yaml` `dependencies` | `firebase_core: ^4.14.0` | `4.15.0` pinned | passes |
| `firebase_core-4.15.0/android/local-config.gradle` | `minSdk=23`, `compileSdk=34` | app `minSdk = 24` (`app/android/app/build.gradle.kts`, L103) | passes (23 below 24) |
| `firebase_auth-6.7.0/android/local-config.gradle` | `minSdk=23` | 24 | passes |
| `firebase_core-4.15.0/android/gradle.properties` | Firebase Android SDK (BoM) 34.19.0 | n/a | noted |
| `firebase_core-4.15.0/ios/firebase_core.podspec` and `firebase_auth.podspec` | `s.ios.deployment_target = '15.0'` | iOS 15 (`ios/Podfile`, `Runner.xcodeproj`) | passes (equal) |
| `firebase_core-4.15.0/ios/firebase_sdk_version.rb` | Firebase iOS SDK 12.19.0 | n/a | noted |
| both plugins' `android/build.gradle` | `agpMajor >= 9` uses AGP's built-in Kotlin, otherwise applies `kotlin-android`; `jvmTarget` from `project.ext.javaVersion` (17) | AGP 9.1.0, Kotlin 2.4.0, Java 17 in `app/android/app/build.gradle.kts` | compatible by reading; the debug build in step 1 is the proof (EC-49) |

No minimum SDK is above the floor. The shopper's Android debug build is run in step 1 once the dependencies are in (plan: "Runs only after step 0 (a) has passed"); a failing build stops the slice and asks.

FlutterFire web init without a generated options file (RC-1, RC-7, RC-8):

- `firebase_core-4.15.0/lib/src/firebase.dart` `Firebase.initializeApp({String? name, FirebaseOptions? options, ..., String? demoProjectId})` takes explicit options. `FirebaseOptions` (`firebase_core_platform_interface-8.1.1/lib/src/firebase_options.dart`) has required `apiKey`, `appId`, `messagingSenderId`, `projectId` and optional `authDomain` (web). So the five defines of the plan are all that is needed on web.
- The same method documents `demoProjectId`: "a new FirebaseApp instance will be initialized with a set of default options for demo projects" (`apiKey: '12345'`, `appId: '1:1:<platform>:1'`, `projectId: demoProjectId`); "By convention, the demoProjectId should begin with demo-". The emulator branch therefore needs no placeholder values of its own; the plan's "fixed placeholder options" (RC-8) are still carried by `FirebaseEmulator` so the resolver stays pure and testable, and `bootAdmin` passes them as explicit options (DESIGN CHOICE, below).
- `firebase_auth-6.7.0/lib/src/firebase_auth.dart` `useAuthEmulator(String host, int port, {bool automaticHostMapping = true})`: "Note: Must be called immediately, prior to accessing auth methods. Do not use with production credentials as emulator traffic is not encrypted."
- `firebase_auth_web-6.3.0/lib/firebase_auth_web.dart` `useAuthEmulator` builds `http://$host:$port` and, in debug mode only, keeps it in `sessionStorage` so a page reload re-uses it. A second call with the same origin is a no-op. This matters for hot restart: `bootAdmin` must not treat the second call as an error.
- `flutter build web -h`, `flutter build apk -h` and `flutter run -h` (Flutter 3.47.5) all list `--dart-define-from-file=<use-define-config.json|.env>`: "The path of a .json or .env file containing key-value pairs that will be available as environment variables", and "Entries from --dart-define with identical keys take precedence over entries from these files" (RC-14, the flag half).

## (b) `authStateChanges`, restore, persistence, `getIdToken`

- `firebase_auth_web-6.3.0/lib/firebase_auth_web.dart` `authStateChanges()`: `await _initialized.future; yield currentUser; ...`. The first event is the current user after the SDK's initial state, so awaiting `authStateChanges().first` before `runApp` is right (RC-2). `lib/src/interop/auth.dart` `onWaitInitState` says "On web we need to wait for the first onAuthStateChanged event to fire in order to be sure that the currentUser is set".
- `lib/src/interop/auth.dart` `getAuthInstance`: persistence list `[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]`, the JS SDK's default. That is local persistence, shared between tabs of one origin; the sign-out of one tab reaches the others through the JS SDK (RC-3: the cross-tab propagation is the JS SDK's behaviour, not visible in the Dart wrapper; AC-27's manual two-tab case is its proof).
- `firebase_auth-6.7.0/lib/src/user.dart` `getIdToken([bool forceRefresh = false])`: "Returns the current token if it has not expired. Otherwise, this will refresh the token and return a new one." (RC-4, first half.) The refresh-failure and auto-sign-out half (RC-4: a deleted or disabled user is signed out by the SDK) is not stated in the Dart docs read; the session notifier does not depend on it: a token that cannot be fetched is a network-type error and never expiry (EC-3), and if the SDK does sign out, `authStateChanges` emits null and DC-12 takes the expiry path.
- `auth_time` unchanged on refresh (RC-11): not read in this session (it is the JS SDK's token, and the server already measures it, S1's `auth.middleware.test`). Not load-bearing for the client, which makes no time decision (AC-24).

## (c) The reset email, the error codes, the emulator's reset-code list

- `FirebaseAuth.sendPasswordResetEmail` (`firebase_auth.dart` lines 295 to 330): optional `ActionCodeSettings`; "If email enumeration protection is enabled for the Firebase project, this method may complete successfully even when the email does not correspond to an existing user." Codes listed: `invalid-email`, `missing-android-pkg-name`, `missing-continue-uri`, `missing-ios-bundle-id`, `invalid-continue-uri`, `unauthorized-continue-uri`, `user-not-found` ("not thrown when email enumeration protection is enabled"). The plan sets no continue URL, so the four continue and package codes cannot arise; they map to the generic text anyway.
- `signInWithEmailAndPassword` (`firebase_auth.dart` lines 545 to 600): `invalid-email`, `user-disabled`, `user-not-found` and `wrong-password` (both "deprecated ... no longer returned on projects that have email enumeration protection enabled (the default for new projects since September 2023). Use invalid-credential instead"), `too-many-requests`, `user-token-expired`, `network-request-failed`, `invalid-credential`, `operation-not-allowed`. **New finding:** "On the Firebase emulator, the code may appear as INVALID_LOGIN_CREDENTIALS." `FirebaseAuthService` therefore maps `INVALID_LOGIN_CREDENTIALS` (and `invalid-login-credentials`) to invalidCredential too, case-insensitively. This is within the plan's mapping (it is the same wrong-email-or-password text) and is listed as a design choice.
- The Auth emulator's reset-code list: `db/seeds/node_modules/firebase-tools/lib/emulator/auth/apiSpec.js` line 4057 `/emulator/v1/projects/{targetProjectId}/oobCodes` (operation `emulator.projects.oobCodes.list`), and `operations.js` line 1449 `oobCodes: [...state.listOobCodes()]`. So `GET http://127.0.0.1:<port>/emulator/v1/projects/demo-gabay/oobCodes` lists reset links for the SEC3-FE manual rows.
- Spark includes email and password and the reset email, `localhost` authorised by default, sign-up off refusing `createUser`: **not checked** (Firebase console and pricing pages; no way to read them from this session). Owner-side (AC-61 manual rows); no code depends on them.

## (d) The secret guard against an API-key pattern

The plan's reading stands: `tools/ci-guards.js` `secretGuard` and `.githooks/pre-commit` refuse tracked or staged files by name and read no contents. Ruling under DC-7: `app/config/firebase.local.json` is ignored (step 2 adds `app/config/*.local.json` to `.gitignore`), a placeholder `app/config/firebase.example.json` is committed. GitHub's own secret scanning of an `AIza...` value: **not checked** (RECALLED); moot because the values file is never committed.

## (e) go_router 18.0.2

- `lib/src/router.dart` `GoRouter(refreshListenable:)` (line 199) and `redirectLimit` default 5 (line 59); enforced at `lib/src/configuration.dart` line 605 (the plan's reading).
- `lib/src/information_provider.dart` lines 89 to 97 and 272: the router's information provider does `_refreshListenable?.addListener(notifyListeners)` and removes it on `dispose`. A notification on the listenable therefore makes the `Router` ask the parser again, which runs the top-level `redirect`. This is the source reading of RC-13's re-run; `router_test.dart` (AC-29) is the behavioural proof.

## (f) Flutter and Riverpod

- `flutter/lib/src/services/autofill.dart`: `AutofillHints.email = 'email'` (line 204) and `AutofillHints.password = 'password'` (line 384). `flutter/lib/src/widgets/autofill.dart` line 70 `class AutofillGroup extends StatefulWidget` (RC-12). Whether a browser's password manager acts on them is the browser's; the widget test checks the hints are declared (AC-11).
- `flutter/lib/src/rendering/editable.dart` line 1375 `..isObscured = obscureText` in the semantics configuration; `editable_text.dart` line 936: `enableInteractiveSelection` defaults to `!obscureText`-based. The test of AC-6 (the typed value is not in the semantics tree) is the proof.
- `riverpod-3.4.3/lib/src/core/ref.dart` line 112: `bool get mounted => !_element._disposed && identical(_element.ref, this);` (DC-16).

## (g) Other documents

- SEC-2's lint: `spec/SEC-2.md` r2 section 3.6 (line 241): `tools/lint/raw-error-text.js`, test `tools/lint/test/raw-error-text.test.js`; "Its reach is the server only ... The Flutter half ... becomes one criterion in SEC-3's spec". SEC-2 is not built on this branch. Step 9 therefore creates the file with the Dart half under that name; SEC-2 adds its server half to the same file (DC-23). The Dart test file is `tools/lint/test/raw-error-text-dart.test.js` as the plan says, so SEC-2's `raw-error-text.test.js` does not collide.
- Slice 2b is on `main`: `routeObserverProvider` (`app/lib/shared/navigation/route_observer.dart`), `moduleAccessProvider` (`features/admin_shell/viewmodels/module_access.dart`), `venueAccessProvider` (`features/admin/venues/viewmodels/venue_access.dart`) and `VenuePaths` (`features/admin/venues/venue_paths.dart`) were read and are as plan section 1 says.

## Claims not checked in this session (none load-bearing for code)

RC-5's server-side half (enumeration protection default date: stated in the package docs above, not on Google's page), RC-9 (CSP hosts; DEP-1's), RC-10 and RC-15 (sign-up switch, Spark plan content; the owner's console steps), RC-14's "the API key is not a secret" (Firebase's page; the repository never commits the values either way), RC-16 (superseded by the plan: the real project needs a service-account credential, SEC-1 step 0 (a)), the web SDK's cross-tab sign-out propagation (RC-3, covered by a manual case).

## Step 1 build proof (EC-49), 2026-10-15

With `firebase_core: 4.15.0` and `firebase_auth: 6.7.0` in `app/pubspec.yaml` (`pubspec.lock` gains `_flutterfire_internals 1.3.77`, `firebase_auth 6.7.0`, `firebase_auth_platform_interface 9.1.0`, `firebase_auth_web 6.3.0`, `firebase_core 4.15.0`, `firebase_core_platform_interface 8.1.1`, `firebase_core_web 3.12.0`, `http 1.6.0`), run in `app/`:

```
$ flutter build apk --debug -t lib/main_mobile.dart
Running Gradle task 'assembleDebug'...                            220.5s
√ Built build\app\outputs\flutter-apk\app-debug.apk
```

Flutter prints one warning, not an error: "Your app uses the following plugins that apply Kotlin Gradle Plugin (KGP): firebase_auth, firebase_core. Future versions of Flutter will fail to build if your app uses plugins that apply KGP." (The plugins' `build.gradle` applies `kotlin-android` unless AGP's built-in Kotlin is on, as read in (a); the app builds today.) This is a risk for a later Flutter upgrade, not a stop condition: the plugin versions are pinned, and a moved Flutter pin is a pipeline entry. An iOS build cannot be made on this Windows machine and is unchecked.

## Re-read at the merge of `origin/main` (606a5d0, SEC-1 merged), 2026-10-15

`functions/src/routes/me.js`, `middleware/tenantContext.js`, `auth/routeKeys.js`, `middleware/auth.js` and `db/migrations/` are unchanged between `sec-1` at a1919e0 (read at step 0) and `origin/main` at 606a5d0 (`git diff a1919e0 HEAD` over those paths is empty). The contract section above stands; the slice builds on the merged one.
