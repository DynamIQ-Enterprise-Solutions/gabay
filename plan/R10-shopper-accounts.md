# R10-shopper-accounts — P0-10: shopper sign-in, sign-up and deletion (retrofit R10, E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-10.md` r2 (AC-1 to AC-44, EC-1 to EC-38; Q1 to Q20 ruled) | **Intent**: `intent/P0-10-shopper-accounts.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §6, row R10 ("P0-10 Shopper accounts: sign-in, sign-up and deletion (E-19's shopper parts)"); `plan/PH2-identity.md` 1.3 (S1 built; S10 → R8) | **Pipeline entry**: P0-10 | **Approver**: Genesis Perez, product owner
>
> **Rulings this plan applies, never re-asks:** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): I1 to I17, A2, A3, A5, A26, §M 1 (N1, N2 placeholders), §M 2 (N3: `auth.shopperIdTokenMaxAgeS` = 2,592,000, 30 days; admins 8 h), §M 3 (N7: flutter-coder drafts the Tagalog, the product owner approves every line); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R11 (leftover rows and Firebase users), R12 (the deletion page follows the browser's language, with a switch), R32; plan.html D1, D1b (L109), L98, L115, L116, L149, L151, L153; `plan/PH2-identity.md` §7 Q5 (a 401 ends the session), Q10 (E-19 at R8), Q11 (admins email and password), Q12 (UID → `AppUser`, then `ShopperAccount`), §7a (token age from `auth_time`); PH4 §9 ruling 3 (P0-10 in the retrofit).
>
> **Read for this plan:** CLAUDE.md; WORKING_AGREEMENT 1.16; the `gabay-product-rulings` skill; PH4 1.0 (§2, §5, §6, §7, §9); the spec and intent; PH2-identity 1.3 (§3, §7, §7a); `db/schema.sql` 0.14 (`ShopperAccount`, `AuditLog`, `GlobalSetting`); Blueprint §4.8, §4.14, invariant 16; `functions/src/middleware/auth.js`, `functions/src/auth/identityStore.js`, `firebaseVerifier.js`, `functions/src/config/settings.js` and `functions/test/auth.middleware.test.js` as they stand on `main` today; `app/lib/main_admin.dart`, `main_mobile.dart`.

## 0. Where R10 sits in the retrofit

PH4 §6 lists R1 to R13. R10 is a **retrofit** slice: it starts on real identity, not on the development stub, so it comes after the slices it stands on and before the ones that close the retrofit:

| Retrofit slice | What R10 needs from it | Spec reference |
|---|---|---|
| **R1** (was S2) tenant context | The stub is gone (E-20's rule: R1 replaces it on every admin route), so nothing on R10's mount can reach `devStub`; shopper routes run **no** tenant context (platform scope, DC5), and `X-Tenant-Id` changes nothing | AC-10, EC-15 |
| **R2** (S3) authorization | `requireAdminUser` and the permission guards on every admin feature route, so a shopper token gets 403 there (re-asserted by R10's tests) | AC-8, EC-14 |
| **R3** (S4) audit | The audit middleware R10 extends with the shopper rule (route, method, status, time and request id only) | AC-41, I14 |
| **R4** (S5) rate limiting | The auth limiter (401s per address over 15 minutes, PH2 Q3), which applies to R10's routes as built | EC-28 |
| **R5** (S6) validation | zod at the route boundary: R10's bodies are strict allow-lists | AC-11 |
| **R6** (S7) admin API | The Admin SDK user-management wrapper (it creates Firebase users for admins, PH2 Q4); R10 reuses it for `getUser` and `deleteUser` rather than adding a second one | AC-4, AC-5, EC-7 |
| **R7** (S8) the two lints | `route-guard-order` with the shopper mount kind (`auth → requireShopperUser → validate → handler`); `raw-error-text` over the new routes | AC-42, I15; Q3 |
| **R8** (S10) client session and routing | E-19 (`firebase_core`, `firebase_auth`, approved with versions from pub.dev); the token provider, the `ApiClient` auth header, the 401 path, session restore before the first frame; **the ruling on the admin sign-in form's password field** | AC-14 to AC-29, AC-44; Q1 |
| **R9** (S11) maintenance screens | Nothing | — |
| FF-4, FF-7 (feature slices) | The Me tab with "Change mall" and the "For everyone" settings; FF-7's Tagalog review sheet; the language setting | AC-13, AC-27 |

**Order:** R10 starts once R1 to R8 have merged. It can run beside R9 and beside R11's client half (J1: R11's client machinery goes first as the retrofit starts). It must merge before **R12**, which runs P0-10's waived e2e ("each feature's own waived e2e", PH4 §6), and before **R13**, which recreates every database and signs the gates. R11-8 then adds the version badge to R10's sign-in screen (PH3 §10).

**E-20 still holds** while R10 runs (it closes at R13): localhost only, the Auth emulator (project `demo-gabay`), no Firebase project, throwaway data. Real Google and Apple sign-in cannot be exercised here (I2).

## 1. What R10 delivers

- **Three shopper account routes** (api-coder), outside `/api/public`: record the account after each sign-in, read it, delete it (the Firebase user and the row).
- **Sign-in in the shopper app** (flutter-coder), never forced, on the Me tab's top row (I11): email and password, Google, Sign in with Apple on every platform (I4); sign-up with Firebase's verification email (I9); "Forgot password" (I10); linking a second method to the same email (I8); sign-out; the placeholder privacy notice (I13, N1).
- **Deletion** in the app and on a public web page in the Flutter Web build at its own path, outside the admin shell, in the browser's language with a switch (I1, R12), with the placeholder DPO contact (N2).
- **The 30-day shopper session** (`auth.shopperIdTokenMaxAgeS` = 2,592,000; §M 2), admins staying at 8 hours.
- **The seeded shopper** `shopper@gabay.test` as the test account (L119).

**Not in R10** (spec §9): loyalty, promos and push; SMS and Facebook; syncing favourites, recents, settings or the parked car; any position tied to an account (invariant 4); admin screens listing shoppers; other data-subject requests; changing email or password, editing the name; resending verification; an age gate; a grace period or re-authentication before deletion; the final notice text and the real DPO contact (before the first deploy); the leftover-row sweep (first scheduled-function slice); real provider configuration, the public URL, store entries (first deploy after R13); native Apple sign-in on an iPhone (P1-05); the version badge (R11-8).

## 2. The server part (api-coder, Sonnet 5.5; L164)

### 2.1 Files

| File | Responsibility |
|---|---|
| `functions/src/routes/shopperAccount.js` | The three routes, mounted outside `/api/public` and outside the admin group, with the shopper chain (§2.3) |
| `functions/src/services/shopperAccount.service.js` | Record (upsert and the leftover rules), read (the allow-listed fields), delete (AC-5's order) |
| `functions/src/middleware/auth.js` (S1's) | The token age chosen by identity kind (AC-6; spec §10, third note); an `allowUnrecorded` option used only by the record route (DC-H2); `requireShopperUser` beside `requireAdminUser` |
| `functions/src/auth/identityStore.js` (S1's) | Unchanged in behaviour: `AppUser` first, then `ShopperAccount` (I7 rules "AppUser wins", which S1 already does); its comment updated to cite I7 |
| `functions/src/config/settings.js` | `auth.shopperIdTokenMaxAgeS: 2592000` in `DEFAULTS` (invariant 16); not in `PUBLIC_FLAGS` and not in the mall list (AC-37) |
| R3's audit middleware | The shopper rule: on a shopper mount, an `AuditLog` row with `Method`, `Route` (the route pattern, never an id), `StatusCode`, `RequestId`, `CreatedAt`, and every other column NULL (AC-41) |
| R7's `route-guard-order` lint | The shopper mount kind, if R7 did not build it (Q3) |
| The constants file (R32) | The provider set (`password`, `google.com`, `apple.com`), D1b (L109) as authority, named by Firebase's own provider ids (§5 item 14) |
| `db/seeds` | The `auth.shopperIdTokenMaxAgeS` platform `GlobalSetting` row with its default (AC-37); `shopper@gabay.test` unchanged |

### 2.2 Routes (DESIGN CHOICE DC-H1 for the paths; spec §10 shows them to you with the plan)

| Method and path | Chain | Does | Success | Spec |
|---|---|---|---|---|
| `POST /api/shopper/account` | `auth({ allowUnrecorded: true }) → requireShopperUser({ allowUnrecorded: true }) → validate → handler` | Records or refreshes the caller's row from the Firebase user | 200 the account | AC-1, AC-2, AC-39, EC-4, EC-7, EC-10, EC-38 |
| `GET /api/shopper/account` | `auth → requireShopperUser → validate → handler` | The caller's own account, allow-listed fields | 200 | AC-3 |
| `DELETE /api/shopper/account` | `auth → requireShopperUser → validate → handler` | Deletes the caller's Firebase user and row (AC-5's order) | 204 | AC-4, AC-5, EC-6, EC-20, EC-24 |

- **No id in any path, query or body selects the account:** it is always the token's (AC-3, EC-16).
- **The response** (read and record): `{ "email": "…" | null, "emailVerified": true, "authProvider": "google.com", "displayName": "…" | null, "createdAt": "…" }`. Never the Firebase UID or `ShopperAccountId` (AC-3, AC-21).
- **Bodies** (R5's zod, strict): record `{}`; delete none. Any extra key (`password`, a position) is refused with 400 and never stored (AC-11).
- **Errors:** the standard `{ "error": "…" }`, plus a `code` the app maps to ARB where the app must tell cases apart: `STAFF_ACCOUNT` (AC-7), `NO_ACCOUNT`, `EMAIL_TOO_LONG` (AC-1, R11 (iii)) (DC-H3).

### 2.3 Identity, the token age and the guards

- **`auth`** resolves the identity first, then applies the age limit by kind (AC-6): `AppUser` → `auth.idTokenMaxAgeS` (28,800 s, L151); a shopper, or a verified identity with no account, → `auth.shopperIdTokenMaxAgeS` (2,592,000 s). Older → 401 "Session expired". Firebase or the database unreachable → 503, nothing written (fail closed). An inactive `AppUser` → 401 as today.
- **With no account:** 403 "This account has no access" on every route **except** the record route, where `allowUnrecorded` sets `req.user = { kind: 'unrecorded', uid, signInProvider }` and nothing broader (spec §10, second note; DC-H2).
- **`requireShopperUser`:** a shopper passes; an `AppUser` gets 403 with `code: STAFF_ACCOUNT` and "This is a staff account. Use a shopper account here." (AC-7, I7), and no row is created; `unrecorded` passes only where the route allows it.
- **The sign-in method** (`firebase.sign_in_provider`, RECALLED) is kept on `req.user` for shopper and unrecorded identities only, for `AuthProvider` (AC-1).
- **Admin routes** keep `requireAdminUser`: a shopper token gets 403 on `/api/me` and every admin feature route (AC-8). `/api/public/*` stays GET only and ignores `Authorization` (AC-9; P0-04 AC-7 and AC-8 still pass).

### 2.4 Record (AC-1, AC-2, AC-39; R11 (ii), (iii))

1. Read the Firebase user through R6's Admin SDK wrapper (`getUser(uid)`, RECALLED): email, email-verified flag, display name (DC-H4).
2. An email over 254 characters → 400 `EMAIL_TOO_LONG`, nothing written; the app signs out on this phone; the Firebase user is handled by hand through the DPO contact (R11 (iii)).
3. A display name over 120 characters is cut to its first 120 (code points, FF-1 DC-5).
4. **An old row with the same email and another UID** (EC-7): with `DeletionRequestedAt` set, it is removed; without it, the Admin SDK is asked whether the old UID's user exists: gone (`auth/user-not-found`, RECALLED) → the old row is removed; still there → 409 and a log line (not reachable while Firebase keeps one account per email, RECALLED); Firebase unreachable → 503, nothing written.
5. **Upsert** in one statement: `INSERT … ON CONFLICT (FirebaseUid) DO UPDATE` refreshing `Email`, `DisplayName`, `AuthProvider` and `UpdatedAt` (AC-2: two concurrent first calls leave one row and both succeed). `EmailVerifiedAt`: set to now when the user is verified and it was NULL or the email changed; kept while still verified; NULL when not verified (DC-H5).
6. Steps 4 and 5 run in one transaction.

### 2.5 Delete (AC-4, AC-5; I5; R11 (i))

1. Set `DeletionRequestedAt` on the caller's row (committed on its own). Failure → 503; nothing else done.
2. Delete the Firebase user through the Admin SDK (`deleteUser(uid)`, RECALLED). Failure → 503; the row keeps the mark and the account keeps working; a retry completes it.
3. Delete the row. Failure → 503, never success; the row stays marked and unusable (every token for the UID now gets 401); it is removed by a later sign-up with that email (§2.4 step 4) or by the sweep (ledger row). "Removed by the next deletion call" is dropped (R11 (i)): each deletion touches only the caller's row.
4. 204. The shopper's earlier ID token gets 401 on every route after this (AC-4).

### 2.6 Logs

No log line prints the shopper's email or UID (AC-41): the request logger's child for a shopper carries `kind` only; a test scans the log lines of the record, read and delete paths, as S1's token test does.

## 3. The client part (flutter-coder, Sonnet 5.5)

### 3.1 Files: `app/lib/features/shopper/account/` (FEATURE_PIPELINE)

| File | Responsibility |
|---|---|
| `account_service.dart` | `firebase_auth` calls (email sign-in and sign-up, `sendEmailVerification`, `sendPasswordResetEmail`, Google and Apple through `firebase_auth`'s own provider sign-in, linking, sign-out; RECALLED, §12) and the three routes through the one `ApiClient` |
| `account_view_model.dart` (Riverpod) | Signed out, signing in, signed in (the account), the 401 path (AC-23), offline (AC-25) |
| `firebase_error_map.dart` | Firebase error codes and the API's `code`s → ARB sentences; never raw text (AC-16, AC-38, AC-43; standard §4.3) |
| `views/me_account_row.dart` | The Me tab's top row (AC-13, AC-21) |
| `views/sign_in_screen.dart`, `sign_up_screen.dart`, `forgot_password_sheet.dart` | The three methods; the email `FieldSpec` bound to `ShopperAccount.Email` (254); the password field per R8's ruling (Q1) |
| `views/link_method_dialog.dart` | "You signed up with ⟨method⟩. Sign in with it first." then the offer to link (AC-40) |
| `views/privacy_notice_screen.dart` | The marked placeholder, naming Singapore and the United States (AC-26, N1) |
| `views/delete_account_dialog.dart` | Confirmation, Cancel the default (AC-30) |
| `web/web_delete_account_page.dart` | The public page (AC-34, AC-35): sign in by any method, delete, the notice link, the placeholder DPO line (N2); language from the browser with a switch (R12) |

**Routing:** in `main_mobile.dart`'s router, the account screens under the Me tab. In `main_admin.dart`'s router, `/account/delete` outside the admin `ShellRoute` (no admin menu; the development banner is already gone with R8) (DC-H1).

**Behaviour rules:** signing in, out, linking and deleting never end a trip, change the mall or start a package check (AC-24); favourites, recents, settings, the parked car and packages stay as they are (AC-22, AC-31); the password goes only to the Firebase SDK, never to the API, storage or a log (AC-18); a response that is not the API's (a captive portal) counts as offline (AC-32, P0-04 AC-21's check).

**Wording (A2, §M 3; G2 in full):** every phrase in `app_en.arb` and `app_tl.arb`. flutter-coder drafts the Tagalog, each line marked draft; the product owner corrects and approves every line through FF-7's review sheet (key, English, Tagalog, where it shows, Tagalog screenshots) in R10's pull request; only approved lines merge; the approval goes in R10's L-row. The deletion page's phrases are shopper phrases (R12). Changelog (shopper surface): "You can now create an account, sign in and delete your account. Signing in is optional."

## 4. Who and order

0. **Step 0 (before code; doc fetches pasted in the slice report):** every RECALLED claim of §12. Any that fails changes the plan and comes back to you before code.
1. **test-verifier first** (Sonnet 5.5), on `r10-tests` from `main`: the server tests of §5, failing.
2. **In parallel, each in its own working copy:**
   - **api-coder** (Sonnet 5.5) on `r10-server`: §2, the R3 and R7 pieces per Q3, the setting and its seed row, the API manual.
   - **flutter-coder** (Sonnet 5.5) on `r10-client`: §3 against §2.2's contract with fakes; the Tagalog drafts; the review sheet.
3. **test-verifier** completes §5's table with results; `npm run verify` pasted; the emulator runs (AC-17, AC-36) pasted with screenshots.
4. **dod-reviewer** on each branch.
5. **Two pull requests, server first.** The client PR merges only after the product owner's line-by-line Tagalog approval (A2).
6. **The product owner:** the Tagalog sheet; sign-off. P0-10 stays `IN PROGRESS` in FEATURE_PIPELINE until the real-providers check passes at the first deploy (I2).

## 5. Tests first, and traceability

**Server** (`functions/test/`; emulator tokens; rows only inside rolled-back transactions, L151): `shopperAccount.record`, `shopperAccount.read`, `shopperAccount.delete` (fakes for each failing step), `shopperAccount.delete.emulator` (Functions and Auth emulators), `shopperAccount.auth`, `shopperAccount.validation`, `shopperAccount.audit`, `shopperAccount.logs`, `settings.shopperAge`; `tools/lint/test/route-guard-order.shopper.test.js` (if R10 adds the kind, Q3); `db/seeds` test for the setting row. **Client** (`app/test/features/shopper/account/`): `me_account_row_test`, `sign_in_screen_test`, `sign_up_screen_test`, `forgot_password_test`, `provider_sign_in_test`, `password_handling_test`, `session_test`, `link_method_test`, `privacy_notice_test`, `delete_account_test`, `web_delete_account_page_test`, `staff_refusal_test`, `account_trip_isolation_test`, `account_accessibility_test`, `firebase_error_map_test`; screenshots. Owners: test-verifier (server), flutter-coder (client).

| AC / edge case | Test file(s) | Kind |
|---|---|---|
| AC-1 one row; refresh on a repeat; name cut at 120; email over 254 refused, nothing written | `shopperAccount.record` | API |
| AC-2 two concurrent first calls: one row, both succeed | `shopperAccount.record` (two requests through two pool connections; the upsert, not a pre-check, decides) | API |
| AC-3 own account only; exact key set; never the UID | `shopperAccount.read` | API |
| AC-4 delete: earlier token 401 everywhere; UID resolves to nothing | `shopperAccount.delete.emulator` | integration |
| AC-5 each failing step; row state after each | `shopperAccount.delete` | API |
| AC-6 401s, 503; a shopper token at 9 h accepted; past 30 days 401; an admin token at 9 h still 401 | `shopperAccount.auth` | API |
| AC-7 each admin role: 403 `STAFF_ACCOUNT`; no row | `shopperAccount.auth` | API |
| AC-8 a shopper token on `/api/me` and every admin feature route: 403 | `shopperAccount.auth` (iterates the mounted admin routes) | API |
| AC-9 outside `/api/public`; public stays GET only | `shopperAccount.auth`; P0-04's public tests unchanged | API |
| AC-10 no tenant predicate; `X-Tenant-Id` ignored | `shopperAccount.read`; `npm run verify` (`tenant-predicate`, `sql-interpolation`) | API; lint |
| AC-11 extra `password` or position refused, never stored | `shopperAccount.validation`; review (privacy pass) | API; review |
| AC-12 signed out, every built feature works, no prompt | `account_trip_isolation_test`, `me_account_row_test`; review | widget; review |
| AC-13 the top row; no prompt outside Me | `me_account_row_test` | widget |
| AC-14 three methods on Android, iOS and the web page; nothing else | `sign_in_screen_test`, `web_delete_account_page_test` | widget |
| AC-15 sign-up: user, verification email, record; signed in only after recording | `sign_up_screen_test`; emulator run | widget; integration |
| AC-16 each Firebase error mapped | `firebase_error_map_test`, `sign_in_screen_test` | unit; widget |
| AC-17 Google and Apple through the emulator's provider flow; the runbook row and the pipeline note | `provider_sign_in_test`; manual (emulator, pasted with screenshots); review | widget; manual; review |
| AC-18 the password never reaches the API, storage or a log | `password_handling_test` (recording fake `ApiClient` and preferences) | unit |
| AC-19 a cancelled sheet: back, signed out, no dialog | `sign_in_screen_test`, `provider_sign_in_test` | widget |
| AC-20 restart keeps the session until it ends; 401 after the limit | `session_test`; manual (restart on the emulator) | widget; manual |
| AC-21 email, or the method; never the UID | `me_account_row_test` | widget |
| AC-22 sign-out keeps the phone's data | `me_account_row_test`, `account_trip_isolation_test` | widget |
| AC-23 a 401 signs out quietly | `session_test` | widget |
| AC-24 no trip, mall or package effect | `account_trip_isolation_test` | widget |
| AC-25 offline: no call; signed-in state kept | `sign_in_screen_test`, `sign_up_screen_test`, `forgot_password_test`, `link_method_test` | widget |
| AC-26 the notice: links on sign-up and Me; placeholder mark; both places named; the ledger row | `privacy_notice_test`; review | widget; review |
| AC-27 ARB en and tl; drafts approved line by line; names; ×1.4 at 320 dp | `account_accessibility_test`; `arb_integrity_test.dart` (existing, unchanged); review (the signed sheet) | widget; unit; review |
| AC-28 colours; light and dark | `npm run verify` (`colour-literals`); screenshots | lint; screenshot |
| AC-29 email `FieldSpec`; password per R8; no bare field | `npm run verify` (`no-bare-textfield`, `schema-forms`) | lint |
| AC-30 delete from Me: confirmation, signed out, "deleted" shown | `delete_account_test`; emulator run | widget; integration |
| AC-31 the phone's data kept | `delete_account_test` | widget |
| AC-32 offline or a captive portal: no change | `delete_account_test` | widget |
| AC-33 503: still signed in, Retry; a 401 on retry signs out | `delete_account_test` | widget |
| AC-34 the web page: methods, delete, notice, DPO placeholder; `tl`, `fil`, `en-US`; the switch | `web_delete_account_page_test`; manual (localhost, both languages, screenshots) | widget; manual |
| AC-35 the page grants nothing else; a staff identity refused | `web_delete_account_page_test`; `shopperAccount.auth` | widget; API |
| AC-36 the seeded shopper signs in; `npm run seed` restores it | manual (pasted); the seed's own test | manual; unit |
| AC-37 the setting: default, bad value ignored, API only | `settings.shopperAge`; the seed test | unit |
| AC-38 "Forgot password": sentence, errors mapped, no API call | `forgot_password_test`; emulator run | widget; integration |
| AC-39 verification: nothing blocked; `EmailVerifiedAt` set on a later sign-in | `sign_up_screen_test`; `shopperAccount.record` (emulator: sign up, follow the link, sign in, set) | widget; integration |
| AC-40 one account per email; the message, link, accept, decline | `link_method_test`; emulator run (password then Google, one email) | widget; integration |
| AC-41 the audit row column by column; no email in logs | `shopperAccount.audit`, `shopperAccount.logs`; review | API; review |
| AC-42 the shopper chain; the lint passes and fails | `route-guard-order.shopper.test.js` (or R7's own tests, Q3); `shopperAccount.auth` | unit; API |
| AC-43 a staff identity in the app or on the page: the sentence, signed out | `staff_refusal_test`; `shopperAccount.auth` | widget; API |
| AC-44 no client package beyond E-19 | review (`app/pubspec.yaml` diff; no EXCEPTIONS entry) | review |
| EC-1, EC-3 offline, captive portal | AC-25, AC-32 | widget; unit |
| EC-2, EC-22, EC-23 packages, trips, publish | `account_trip_isolation_test`; EC-23 needs no test: no shared state (spec) | widget |
| EC-4 a first sign-in racing itself | AC-2 | API |
| EC-5 a Firebase user with a failed record | `shopperAccount.record` (403 `NO_ACCOUNT` on the read route until recorded); `sign_up_screen_test` | API; widget |
| EC-6 a marked row whose user is gone: tokens 401; removed by a sign-up with its email; the sweep | `shopperAccount.record` (the sign-up path); the sweep: not in R10, ledger row | API; — |
| EC-7 re-sign-up after deletion; an unmarked old row with its user gone; Firebase unreachable | `shopperAccount.record` (fake Admin SDK) | API |
| EC-8, EC-35 same email, other method; offer declined or sheet cancelled | AC-40, AC-19 | widget; integration |
| EC-9 Apple with no email or a relay address | `shopperAccount.record`; `me_account_row_test` | API; widget |
| EC-10, EC-38 long email or name | AC-1; `sign_up_screen_test` (form refuses before Firebase) | API; widget |
| EC-11, EC-34 malformed email, refused password, reset for a missing or provider-only account | `firebase_error_map_test`, `forgot_password_test` | unit; widget |
| EC-12, EC-13, EC-14 staff in the app, admin roles on shopper routes, shoppers on admin routes | AC-7, AC-8, AC-43 | API; widget |
| EC-15 tenant header ignored | AC-10 | API |
| EC-16 another shopper's id named | AC-3 | API |
| EC-17 two phones, one deletes | `shopperAccount.delete.emulator` (the other token's next call 401) | integration |
| EC-18 older than 30 days | AC-6, AC-20 | API; widget |
| EC-19 the Auth emulator stopped | `sign_in_screen_test` (a fake unavailable error) | widget |
| EC-20 Firebase or the database down during deletion | AC-5, AC-33 | API; widget |
| EC-21 the app killed mid-deletion | `session_test` (both outcomes on the next launch) | widget |
| EC-24 deletion while a record call is in flight | `shopperAccount.delete` (a record between the mark and the Firebase step only refreshes; one after gets 401) | API |
| EC-25 cancelled sheet | AC-19 | widget |
| EC-26 the longest email and name at ×1.4 on 320 dp | `account_accessibility_test` | widget |
| EC-27 no accounts at all | `shopperAccount.read`, `shopperAccount.record` (empty table) | API |
| EC-28 many failed tokens from one address | R4's limiter test over the shopper mount (one case added) | API |
| EC-29 unverified email | AC-39 | widget; API |
| EC-30, EC-31 dark mode; screen reader | `account_accessibility_test`; screenshots | widget |
| EC-32 the seeded shopper deleted while testing | manual (AC-36) | manual |
| EC-33 a session revoked by hand in the emulator | `shopperAccount.delete.emulator` (revoke, then 401) | integration |
| EC-36 placeholders at the first deploy | No runtime test: blocked by the ledger row, checked at the deploy call (spec) | — |
| EC-37 browser language `tl`, `fil`, other; the switch | AC-34 | widget |

### 5.1 Existing tests that change (C1)

| Test | Change | Spec change behind it |
|---|---|---|
| `functions/test/auth.middleware.test.js`, "a token older than the limit is 401 "Session expired"; exactly the limit is still accepted" | The status assertions stay. The line `assert.deepEqual(identities.asked, [], 'refused before the database is asked')` is removed: the identity is now resolved before the limit is chosen | P0-10 r2 AC-6 (the limit by identity kind) and §10's third note ("the check moves after resolution or reads both settings. Any existing S1 test this changes is named in the plan with its reason") |

This names the file as it stands on `main` today. R1 to R8 may change it first; at R10's start the coder re-reads it, and any further test that must change comes back as a question before code (C1). Expected unchanged: the other `auth.middleware` cases (an admin identity still reads `auth.idTokenMaxAgeS`, so "the limit is read from the setting … for the platform" still holds), `auth.identityStore*`, `me.test.js`, P0-04's public-route tests, `arb_integrity_test.dart`. No mall-list test changes: the new setting is API only (AC-37; A6).

## 6. Records

**Retrofit ledger** (`plan/PH4-feature-first.md` §7):
- **The three routes:** tenant context "n/a (platform scope, DC5; no tenant context on the shopper mount)"; guard order "met: `auth → requireShopperUser → validate → handler`, R7's lint"; permission row "n/a (I15: shoppers hold no role)"; menu row "n/a"; audit "met: the shopper rule (AC-41)"; validation "met: zod (R5)"; e2e "none → R12 (P0-10's waived e2e)".
- **The screens:** the Me account row, sign-in, sign-up, "Forgot password", the notice, the deletion dialog, the linking dialog; and the web deletion page. Forms (R11): "email `FieldSpec`; password per R8's ruling".
- **Three open rows that close at the first deploy:** the placeholder privacy notice and DPO contact (N1, N2; §M 1), replaced and reviewed by counsel; the real-providers check (I2), a `DEPLOYMENT_RUNBOOK.md` row; the public deletion URL and the Play Console and App Store entries.
- **One open row for the first scheduled-function slice:** the leftover-row sweep (EC-6, R11 (i)).

**E-20 waiver** (R10's report): `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now` (I17). Items 3 and 4 are not waived: item 3 is met (the shopper chain, R7 before R10); item 4 is n/a (I15).

**Companion-file sync table:**

| Row | What R10 does |
|---|---|
| `db/schema.sql` | No change (spec §8 item 1: every column exists) |
| An API route | Tests (§5); e2e waived to R12; no permission or menu rows (I15); Blueprint §4.8 and §4.14 "as built (R10)", and Part 1's API conventions (the shopper mount beside public and admin); `E2E_Test_Cases_Manual.md` phase R10 (each route: success, 401 per cause, 403 staff and no-account, 503, 400 extra keys, the deletion steps) |
| A screen or its wording | `app_en.arb` and `app_tl.arb` (approved lines only); the shopper changelog entry; screenshots (light and dark, phone and tablet, both languages for the web page); `E2E_Frontend_Test_Cases_Manual.md` and `Smoke_Test_Guide.md` (sign-in, sign-up, forgot password, linking, sign-out, the notice, both deletion paths) |
| A dependency | None beyond E-19 (approved at R8; AC-44) |
| A setting, limit or option list | `auth.shopperIdTokenMaxAgeS` in `settings.js`, its seed row, Blueprint invariant 16; the provider set in the constants file |
| A command or check | The `route-guard-order` lint's shopper kind if R10 adds it (Q3): CLAUDE.md and README only if a new command appears (none expected) |
| An owner ruling | R10's `plan.html` row: I1 to I17, R11, R12, §M 1 to 3, this plan's rulings, the Tagalog approval (A2); G4 rows against PRD §6.13 ("Forgot password", linking, the 30-day session); the modules page |
| A pipeline entry's state | FEATURE_PIPELINE P0-10: Intent, Spec, Plan, `IN PROGRESS` until the real-providers check (I2) |
| A deploy or an incident | `docs/ops/DEPLOYMENT_RUNBOOK.md`: the real-providers check (Google on Android, Apple on iOS and the web), the notice and DPO contact replaced, the deletion URL registered |

## 7. Definition of done (FEATURE_PIPELINE §5) for R10

| # | Status |
|---|---|
| 1 | N/A: no column, index or table changes |
| 2 | Met by design: the setting's seed row; the seeded shopper |
| 3 | Met by design: the shopper chain, checked by R7's lint |
| 4 | N/A: shoppers hold no role (I15) |
| 5 | Partly, by design: no list; `formatApiError` and the Firebase error map; the shared form machinery |
| 6 | N/A: the verification and reset emails are Firebase's own |
| 7 | N/A: no list |
| 8 | Met by design (AC-28) |
| 9 | `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now` |
| 10 | Met by design (§6) |
| 11 | Met by design: the shopper changelog entry |
| 12 | Walked in §6 |
| 13 | Met by design: the email `FieldSpec`; the password per R8's ruling (Q1) |
| 14 | Met by design: the provider set in the constants file with D1b as authority |
| 15 | N/A: no lookup referenced |
| G1 | §5's table, with results, in the PR |
| G2 | Met in full: Tagalog approved line by line (A2), screen-reader names, ×1.4 |
| G3 | Met by design: signed-out and offline use complete; no position in any account call (AC-11, AC-12) |
| G4 | In R10's L-row (§6) |

## 8. Scale (spec §7)

- One function instance (`maxInstances = 1`); the auth limiter and the settings cache are in memory (Blueprint §2.6).
- Account volumes and sign-ins per hour: measured at the pilot, no target (A5, Q17).
- Firebase Auth has no cost up to 50,000 monthly active users (PRD §6.13, read 2026-10-07): a fact about cost, not a target.

## 9. DESIGN CHOICES (each with an alternative; accepted 2026-10-12, plan batch X3)

- **DC-H1. Paths:** `/api/shopper/account` (POST record, GET read, DELETE delete); the web page at `/account/delete` in the admin web build. *Alternative:* `/api/account` and `/delete-account`: shorter, but "account" alone reads as the admin's own account beside `/api/me`.
- **DC-H2. One `auth` with an `allowUnrecorded` option**, used only by the record route, plus `requireShopperUser({ allowUnrecorded })`. *Alternative:* a second middleware for the record route: two copies of token verification. *Rejected outright (spec §10):* creating the row inside `auth`, which would make every route a writer.
- **DC-H3. A `code` beside `error`** for the three cases the app must tell apart (`STAFF_ACCOUNT`, `NO_ACCOUNT`, `EMAIL_TOO_LONG`). *Alternative:* the app matches the message text: breaks when the wording changes.
- **DC-H4. The record route reads the Firebase user through the Admin SDK** (email, verified flag, name) and the sign-in method from the token. *Alternative:* the token's claims only: no extra call, but the verified flag can lag until the token refreshes.
- **DC-H5. `EmailVerifiedAt`:** set when first seen verified, kept while verified, cleared if the provider reports the email unverified (for example after an email change). *Alternative:* set once and never cleared: a changed, unverified email would keep the old time.
- **DC-H6. The age limit for a verified identity with no account** is the shopper limit (it can only become a shopper). *Alternative:* the admin limit: a new shopper's first sign-in older than 8 hours, while the record call failed, would be refused (EC-5).
- **DC-H7. Deletion's mark is committed on its own** before the Firebase step (AC-5's order), not in one transaction with it: a Firebase call cannot join a database transaction. *Alternative:* none safer with an external step; holding a transaction open across a network call is worse.

## 10. Risks

- **Real providers are unproven until the first deploy** (I2): the emulator's fake provider page is the only proof on this machine. P0-10 stays `IN PROGRESS` until the runbook check passes.
- **Every Firebase claim here is RECALLED** until step 0 (§12); R6's wrapper and R8's client session may already have checked some.
- **The password field waits for R8's ruling** (Q1, ruled X4: R10 starts after R8 merges and follows R8's ruling then, as a one-line addendum to this plan).
- **The web page lives in the admin build:** a mistake in routing could put it inside the shell. Held by `web_delete_account_page_test` (no menu, no admin route reachable) and AC-35.
- **The Tagalog review gates the client merge** (A2); the owner's review time sets the pace.
- **The audit's shopper rule must strip the IP and payload** (I14): held by the column-by-column test.

## 11. Rulings applied (2026-10-12)

I1 (the web page), I2 (emulator proof, runbook check, `IN PROGRESS`), I3 (`firebase_auth`'s own providers), I4 (all three methods everywhere), I5 (deletion at once), I6 and §M 2 (30 days; admins 8 h), I7 (staff identity wins), I8 (one account per email, link), I9 (verification sent, nothing blocked), I10 ("Forgot password" only), I11 (Me's top row), I12 (refreshed at every sign-in; name cut, email refused), I13 and §M 1 (placeholder notice, no age gate, counsel before deploy), I14 (the bare audit row), I15 (the shopper chain, no rows), I16 (the password per R8), I17 (e2e to R12), R11 (leftovers), R12 (the page's language), A2 and §M 3 (Tagalog review), A5 (no volume target), A26 and R32 (the constants file).

## 12. RECALLED claims (each checked in step 0 against its official docs, the fetch cited in the slice report, before it carries weight)

- **Firebase Admin SDK (Node):** `getUser(uid)` and `deleteUser(uid)`; a missing user reported as `auth/user-not-found`; `verifyIdToken(token, true)` after the user is deleted failing with that code; both working against the Auth emulator.
- **The ID token's claims:** `auth_time` and `firebase.sign_in_provider`.
- **`firebase_auth` (Flutter):** Google and Apple through `signInWithProvider` on Android and iOS and a popup or redirect on the web, with no extra package; `linkWithCredential` / `linkWithProvider`; `account-exists-with-different-credential`; `sendEmailVerification`, `sendPasswordResetEmail`; session persistence across restarts on mobile and web.
- **The Auth emulator:** its fake sign-in page for federated providers (Google, Apple) from the Android emulator and a browser; verification and reset links shown in the emulator instead of mail.
- **Apple:** App Store Guideline 4.8 (Sign in with Apple beside other third-party sign-in) and what Sign in with Apple on Android and the web needs at the first deploy (a Services ID, a return URL, a key) for the runbook row; Apple shares the email only at the first sign-in and may give a private relay address.
- **Google Play:** the account-deletion requirement (a web URL in the Play Console where users can request deletion) for the runbook row.
- **Firebase's default one account per email** and its default password policy.
- **Flutter Web:** reading the browser's preferred languages at start-up (`PlatformDispatcher.locales`), and `tl` or `fil` as codes a browser may send.
- **The email standards' 254-character cap** on an address.

## 13. Questions for the owner

Only what no ruling settles. Each has the recommended option first.

**Q1. The password field (AC-29, Q16) waits for R8's ruling, which is not recorded yet.** **Ruled 2026-10-12 (plan batch X4): (a) (recommended).** AC-29: "The password field follows the pattern R8's plan rules for the admin sign-in form's password field (Q16); if that ruling is not recorded when R10's plan is written, the plan stops and asks." I16 ruled "follow whatever R8 rules for the admin sign-in form". R8 has no plan yet.
- (a) **Recommended:** approve this plan with an entry condition: R10 starts after R8 merges (it must anyway, for E-19 and the session), and its password field follows R8's ruling then, recorded as a one-line addendum to this plan in R10's batch consult. Nothing here is built before R8.
- (b) Rule now, for both R8 and R10: a documented non-column `FieldSpec` kind for passwords that the `schema-forms` linter accepts (Q16's option (b)). Settles it early, but pre-empts R8's own plan.
- (c) Hold this plan until R8's plan is approved.

**Q2. Which slice creates the constants file that holds the provider set: the spec and an approved ruling disagree.** **Ruled 2026-10-12 (plan batch X1): (a) (recommended).**
- `spec/P0-10.md` r2, §6: "FF-5's constants file (A26): the provider set"; §8 item 14: "It goes in the constants file FF-5 creates (A26)".
- `plan/FF-5-11-residual.md` R32 (APPROVED): "**FF-3 creates it in the shared shape (A26); FF-3's plan is amended**".
- (a) **Recommended:** R32 holds; by R10 the file exists either way. P0-10's wording is corrected at its next revision; no criterion changes.
- (b) Keep the spec's wording; it has no effect on R10, which comes long after both slices.

**Q3. Who adds the shopper pieces to R3's audit and R7's lint?** **Ruled 2026-10-12 (plan batch P16): (a) (recommended).** AC-41 and AC-42 need R3's audit to write the bare shopper row and R7's `route-guard-order` lint to know the shopper mount kind. P0-10 §6 says R7's lint is "taught the shopper mount kind" without naming the slice; R3's and R7's plans are not written.
- (a) **Recommended:** R10 adds both, with their tests, because the shopper routes first exist in R10; R3 and R7 stay as PH4 §6 lists them (admin routes). If R3's or R7's plan already includes them, R10 only uses them.
- (b) R3 and R7 build them ahead, tested on fixture routes, so R10 only mounts its routes.

## Suggestions (not in scope)

- R4's per-address limiter and carrier-grade NAT on mobile data (EC-28): measure 401 rates at the pilot before tightening.
- An "Export my data" request on the web page, when data-subject requests beyond deletion are specified.

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
