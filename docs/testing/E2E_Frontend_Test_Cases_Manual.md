# Gabay — E2E Frontend Test Cases Manual (shopper app and admin web page)

> **Version**: 0.3 | **Date**: 2026-10-12 | **Status**: Phase 0 stub (standard §2, §7.3; plan.html L115); cases are written from Phase 1; FF-0 adds the admin banner rows FF0-FE-01 to FF0-FE-05 | **Audience**: the tester running a release gate | **Scope**: every screen of the shopper app (Android and iOS) and the admin web page

## How to use

- The release gate: **any ✘ blocks release; all ☐ → ✅ = SYSTEM PASS.**
- Admin web page: DevTools open for the full run; any red console error is an automatic ✘.
- Shopper app: run on one budget Android phone and one iPhone (L103); tablet cases also in landscape.

## Conventions (tags appended to any case)

| Tag | Obligation | Automatic fail when |
|---|---|---|
| `[R:<role>]` | Run as that role (L41) | Another role can do it |
| `[M]` | Repeat at phone width | Anything overflows or is cut off |
| `[T]` | Repeat on a tablet in landscape (L103) | The wide layout breaks |
| `[K]` | Keyboard only (admin) | Any step needs a mouse |
| `[S]` | Screen reader on (TalkBack or VoiceOver; L112) | A control has no name, or two voices speak |
| `[L]` | Repeat in Tagalog (L99) | Any everyday text is untranslated |
| `[O]` | Repeat offline, with the package already downloaded (D2) | A §6.5–§6.9 feature stops working |
| `[X]` | Text size Largest (×1.4) | Anything overflows |

## Test accounts and pre-flight

As the backend manual, plus: the shopper app installed from a debug build; Bluetooth and location allowed, then repeated denied (Apple 5.1.1(iv)).

## Phases

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| — | Written from Phase 1, one phase per pipeline entry | — | — | ☐ |

### FF-0: the admin development banner (E-20; `plan/FF0-dev-stub-lookups.md` section 4)

The lookups fetcher has no screen of its own. Its cases arrive with P0-01 (FF-1), the first form with a building-type picker.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF0-FE-01 | The admin banner shows on every admin page `[M]` `[X]` | `flutter run -d chrome -t lib/main_admin.dart`; open `/`, then About, then back | "Development build: no sign-in" is the first thing on the page, full width, above the app bar, on both pages. At phone width and text size Largest it wraps to more lines, is never cut off, and nothing overflows | ☐ |
| FF0-FE-02 | The banner is read by a screen reader `[S]` | With TalkBack, VoiceOver or the browser's accessibility tree on, open the admin page | The banner is announced as "Development build: no sign-in", once, before the page's own content | ☐ |
| FF0-FE-03 | The banner follows light and dark | Switch the system theme between light and dark | The banner stays readable in both: a tinted band, an icon and the words | ☐ |
| FF0-FE-04 | The shopper app has no banner | `flutter run -t lib/main_mobile.dart` | No "Development build" banner anywhere | ☐ |
| FF0-FE-05 | A release build shows the banner only when asked | `flutter build web -t lib/main_admin.dart --dart-define=API_BASE=<https url>` and serve it; repeat with `--dart-define=DEV_STUB=true` added | Without the define: no banner. With it: the banner shows | ☐ |

### FF-2: the seeded venues in the admin lists (P0-02, AC-15; E-20)

Setup: `npm run seed`, the API on the development stub, `flutter run -d chrome -t lib/main_admin.dart`. FF-1 owns the widget tests of its screens and FF-SK those of the switcher; these rows check the seeded data on screen.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF2-FE-01 | Demo Malls in the venue list | Open the venue list with the default account (`malladmin@`) | The four venues Aurora Mall, Bayview Grand, Meridian Twin Malls and Skyline Spire; opening one shows its seeded buildings, and opening a building shows its levels (Skyline Spire has many) | ☐ |
| FF2-FE-02 | Spike Venues through the switcher | In the development switcher choose `malladmin@` (or `editor@`, `viewer@`) and the Spike Venues tenant | The venue list shows MEZZ office (and the penthouse on a machine that has it, and one venue per spike export you added); none of the Demo Malls venues | ☐ |
| FF2-FE-03 | A Demo Malls account cannot pick Spike Venues | Choose `malladmin.demo@` in the switcher | Spike Venues cannot be chosen for it; the venue list is Demo Malls' | ☐ |

Planned closing sweeps: RBAC (admin), negative and boundary input, permissions denied, and the foreground rule (no guidance with the screen locked, invariant 5).
