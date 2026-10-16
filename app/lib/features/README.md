# features/

One folder per domain, `features/<domain>/`, each with the same fixed shape
(standard §4.1):

```
features/<domain>/
  models/       plain data classes and parsing (no Flutter widgets)
  services/     stateless; talk to the API through ApiClient; take no `ref`
  viewmodels/   Riverpod Notifiers / AsyncNotifiers; call services; own state
  views/        screens; read a ViewModel with ref.watch; no bare TextFormField
  widgets/      (optional) widgets used only by this feature
```

What is here (FF-1, FF-SK and SEC-3): `admin/users/` (the form specs, P2-S9),
`admin/venues/` (the venue list and form, FF-1, P0-01),
`admin_shell/` (the admin dashboard's shell, home, account menu and module pages),
`auth/` (the sign-in screen), `session/` (the signed-in session, the account
from `GET /api/me`, the tenant in effect) and `shopper_shell/` (the shopper
app's four tabs). Their menus and placeholders come from the module registry,
`lib/core/modules/module_registry.dart`; which modules a person sees comes from
the permissions `GET /api/me` returns. A module that
is not built opens the shared placeholder; the slice that builds it adds its own
`features/<domain>/`, registers its screen in `shared/navigation/built_screens.dart`
and flips the registry's `built` flag.

Shared building blocks live in `lib/shared/`, never inside a feature. App-wide
wiring (config, network, theme) lives in `lib/core/`.
