import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'admin_role.dart';
import 'module_slice.dart';

/// The module registry (FF-SK, plan/FF-SK-dashboards.md section 2; PRD 6.26;
/// FEATURE_PIPELINE P0-16): one entry per module, and the one source of the
/// admin menus, the role home pages and the placeholder pages.
///
/// A slice that delivers a module flips [ModuleInfo.built] to true and
/// registers its screen in `shared/navigation/admin_routes.dart` (or the
/// shopper tab in `shopper_routes.dart`); nothing else here changes.
///
/// The role-to-module map is the app's own until R8 (ruling 2, L157), taken
/// from the L41 access table; R8 replaces it with the permission-driven menu
/// (Phase 2 Q9: the menu from `PermissionRoute`). The server checks no
/// permission until R2 (E-20, waiver 3).

/// A piece of wording read through the app's localisations.
typedef L10nText = String Function(AppLocalizations l10n);

/// The pipeline reference of the modules Phase 3's baseline delivers (tenants,
/// beacon namespaces, platform lookups): the pipeline has no P-number for it.
const String kPhase3Baseline = 'Phase 3 baseline';

/// The groups of the admin menu, in menu order (plan section 4).
enum ModuleTier {
  p0,
  p1,
  p2,
  p3,
  administration;

  String label(AppLocalizations l10n) => switch (this) {
    ModuleTier.p0 => l10n.tierP0,
    ModuleTier.p1 => l10n.tierP1,
    ModuleTier.p2 => l10n.tierP2,
    ModuleTier.p3 => l10n.tierP3,
    ModuleTier.administration => l10n.tierAdministration,
  };
}

/// What a role can do in a module. VIEWER's is [readOnly] everywhere (ruling 1):
/// nothing that writes, no publish, no edits.
enum ModuleAccess { full, readOnly }

/// A role's hold on a module: its [access] and an optional scope [note]
/// ("Buildings and levels only") from the L41 table.
class ModuleGrant {
  const ModuleGrant(this.access, {this.note});

  final ModuleAccess access;
  final L10nText? note;
}

/// What the two surfaces' entries share.
class ModuleInfo {
  const ModuleInfo({
    required this.id,
    required this.name,
    required this.icon,
    required this.pipelineIds,
    required this.slice,
    this.built = false,
  });

  /// Lower-case, URL-safe; the last segment of the module's route.
  final String id;

  /// The module's name, from ARB.
  final L10nText name;

  final IconData icon;

  /// Pipeline entries (`P0-01`), Phase 2 slices (`P2-S7`) or
  /// [kPhase3Baseline]; a test finds each in its document.
  final List<String> pipelineIds;

  /// The slice that delivers the module.
  final ModuleSlice slice;

  /// True once a slice has built the module and registered its screen. False
  /// opens the shared placeholder page.
  final bool built;
}

/// An admin-page module.
class AdminModule extends ModuleInfo {
  const AdminModule({
    required super.id,
    required super.name,
    required super.icon,
    required super.pipelineIds,
    required super.slice,
    required this.tier,
    required this.grants,
    super.built,
  });

  final ModuleTier tier;

  /// The roles that get the module, from the L41 table. SUPERADMIN is not
  /// listed: it gets every module (Phase 2 Q8), see [ModuleRegistry.menuFor].
  /// An empty map is a SUPERADMIN-only module.
  final Map<AdminRole, ModuleGrant> grants;
}

/// A shopper-app tab (the Gabay Demo app's, L85).
class ShopperTab extends ModuleInfo {
  const ShopperTab({
    required super.id,
    required super.name,
    required super.icon,
    required super.pipelineIds,
    required super.slice,
    required this.path,
    super.built,
  });

  /// The tab's route.
  final String path;
}

/// One line of a role's menu.
class AdminMenuEntry {
  const AdminMenuEntry({required this.module, required this.access, this.note});

  final AdminModule module;
  final ModuleAccess access;
  final L10nText? note;
}

const ModuleGrant _full = ModuleGrant(ModuleAccess.full);
const ModuleGrant _readOnly = ModuleGrant(ModuleAccess.readOnly);

/// The L41 row of a module MALL_ADMIN holds in full and VIEWER read-only, with
/// VENUE_EDITOR as given (absent when the table has a dash).
Map<AdminRole, ModuleGrant> _tenantModule({ModuleGrant? editor}) => {
  AdminRole.mallAdmin: _full,
  AdminRole.venueEditor: ?editor,
  AdminRole.viewer: _readOnly,
};

/// The registry. Entry order is menu order within a tier.
abstract final class ModuleRegistry {
  static final List<AdminModule> admin = List<AdminModule>.unmodifiable([
    // P0
    AdminModule(
      id: 'venues',
      name: (l) => l.moduleVenues,
      icon: Icons.apartment,
      pipelineIds: const ['P0-01'],
      slice: const ModuleSlice.feature('FF-1'),
      tier: ModuleTier.p0,
      grants: _tenantModule(
        editor: ModuleGrant(
          ModuleAccess.full,
          note: (l) => l.moduleNoteBuildingsAndLevelsOnly,
        ),
      ),
    ),
    AdminModule(
      id: 'map-editor',
      name: (l) => l.moduleMapEditor,
      icon: Icons.edit_location_alt,
      pipelineIds: const ['P0-11'],
      slice: const ModuleSlice.feature('FF-10'),
      tier: ModuleTier.p0,
      grants: _tenantModule(editor: _full),
    ),
    AdminModule(
      id: 'publish',
      name: (l) => l.modulePublish,
      icon: Icons.publish,
      pipelineIds: const ['P0-03'],
      slice: const ModuleSlice.feature('FF-3'),
      tier: ModuleTier.p0,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'beacon-planner',
      name: (l) => l.moduleBeaconPlanner,
      icon: Icons.sensors,
      pipelineIds: const ['P0-12'],
      slice: const ModuleSlice.feature('FF-11'),
      tier: ModuleTier.p0,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'beacon-fleet',
      name: (l) => l.moduleBeaconFleet,
      icon: Icons.router,
      pipelineIds: const ['P0-13'],
      slice: const ModuleSlice.feature('FF-9'),
      tier: ModuleTier.p0,
      grants: _tenantModule(),
    ),
    // P1
    AdminModule(
      id: 'plan-import',
      name: (l) => l.modulePlanImport,
      icon: Icons.upload_file,
      pipelineIds: const ['P1-03'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
      grants: _tenantModule(
        editor: ModuleGrant(
          ModuleAccess.full,
          note: (l) => l.moduleNoteConfirmOrFixOnly,
        ),
      ),
    ),
    AdminModule(
      id: 'store-status',
      name: (l) => l.moduleStoreStatus,
      icon: Icons.store_mall_directory,
      pipelineIds: const ['P1-01'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'analytics',
      name: (l) => l.moduleAnalytics,
      icon: Icons.analytics,
      pipelineIds: const ['P1-04'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
      grants: _tenantModule(),
    ),
    // P2
    AdminModule(
      id: 'opening-hours',
      name: (l) => l.moduleOpeningHours,
      icon: Icons.schedule,
      pipelineIds: const ['P2-02'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'store-pages',
      name: (l) => l.moduleStorePages,
      icon: Icons.storefront,
      pipelineIds: const ['P2-03'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'forecasts',
      name: (l) => l.moduleForecasts,
      icon: Icons.query_stats,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'holidays',
      name: (l) => l.moduleHolidays,
      icon: Icons.event,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      grants: {
        AdminRole.mallAdmin: ModuleGrant(
          ModuleAccess.full,
          note: (l) => l.moduleNoteLocalDaysOnly,
        ),
        AdminRole.viewer: _readOnly,
      },
    ),
    AdminModule(
      id: 'national-holidays',
      name: (l) => l.moduleNationalHolidays,
      icon: Icons.flag,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      grants: const {},
    ),
    // P3
    AdminModule(
      id: 'promos',
      name: (l) => l.modulePromos,
      icon: Icons.campaign,
      pipelineIds: const ['P3-01'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'evacuation',
      name: (l) => l.moduleEvacuation,
      icon: Icons.directions_run,
      pipelineIds: const ['P3-02'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'crowd-routing',
      name: (l) => l.moduleCrowdRouting,
      icon: Icons.groups,
      pipelineIds: const ['P3-03'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
      grants: _tenantModule(),
    ),
    AdminModule(
      id: 'assisted-drawing',
      name: (l) => l.moduleAssistedDrawing,
      icon: Icons.draw,
      pipelineIds: const ['P3-04'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
      grants: _tenantModule(editor: _full),
    ),
    // Administration (Phase 2 and the Phase 3 baseline)
    AdminModule(
      id: 'users',
      name: (l) => l.moduleUsers,
      icon: Icons.people,
      pipelineIds: const ['P2-S7', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R6, R9'),
      tier: ModuleTier.administration,
      grants: const {AdminRole.mallAdmin: _full},
    ),
    AdminModule(
      id: 'roles',
      name: (l) => l.moduleRoles,
      icon: Icons.admin_panel_settings,
      pipelineIds: const ['P2-S3', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R2, R9'),
      tier: ModuleTier.administration,
      grants: const {AdminRole.mallAdmin: _full},
    ),
    AdminModule(
      id: 'audit-log',
      name: (l) => l.moduleAuditLog,
      icon: Icons.history,
      pipelineIds: const ['P2-S4', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R3, R9'),
      tier: ModuleTier.administration,
      grants: const {AdminRole.mallAdmin: _full},
    ),
    AdminModule(
      id: 'settings',
      name: (l) => l.moduleSettings,
      icon: Icons.settings,
      pipelineIds: const ['P2-S11'],
      slice: const ModuleSlice.retrofit('R9'),
      tier: ModuleTier.administration,
      grants: const {AdminRole.mallAdmin: _full},
    ),
    AdminModule(
      id: 'platform',
      name: (l) => l.modulePlatform,
      icon: Icons.domain,
      pipelineIds: const [kPhase3Baseline],
      slice: const ModuleSlice.retrofit('R11'),
      tier: ModuleTier.administration,
      grants: const {},
    ),
  ]);

  /// The shopper tabs, in tab order: Places, Map, Parking, Me (L85).
  static final List<ShopperTab> shopper = List<ShopperTab>.unmodifiable([
    ShopperTab(
      id: 'places',
      name: (l) => l.tabPlaces,
      icon: Icons.storefront_outlined,
      pipelineIds: const ['P0-05'],
      slice: const ModuleSlice.feature('FF-5'),
      path: '/places',
    ),
    ShopperTab(
      id: 'map',
      name: (l) => l.tabMap,
      icon: Icons.map_outlined,
      pipelineIds: const ['P0-04', 'P0-06'],
      slice: const ModuleSlice.feature('FF-4'),
      path: '/map',
    ),
    ShopperTab(
      id: 'parking',
      name: (l) => l.tabParking,
      icon: Icons.local_parking,
      pipelineIds: const ['P1-02'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      path: '/parking',
    ),
    ShopperTab(
      id: 'me',
      name: (l) => l.tabMe,
      icon: Icons.person_outline,
      pipelineIds: const ['P0-14', 'P0-10'],
      slice: const ModuleSlice.feature('FF-7', retrofit: 'R10'),
      path: '/me',
    ),
  ]);

  /// The admin module with [id], or null.
  static AdminModule? adminById(String id) {
    for (final module in admin) {
      if (module.id == id) return module;
    }
    return null;
  }

  /// The menu for a person who holds [roles] (in one tenant), in menu order.
  ///
  /// SUPERADMIN gets every module in full (Phase 2 Q8: it skips permission
  /// checks). Otherwise a module appears when any role has a grant for it; with
  /// two roles the stronger access and that role's note win. No role, or none
  /// with a dashboard, gives an empty menu.
  static List<AdminMenuEntry> menuFor(Set<AdminRole> roles) {
    final entries = <AdminMenuEntry>[];
    for (final module in admin) {
      if (roles.contains(AdminRole.superAdmin)) {
        entries.add(AdminMenuEntry(module: module, access: ModuleAccess.full));
        continue;
      }
      ModuleGrant? best;
      for (final role in roles) {
        final grant = module.grants[role];
        if (grant == null) continue;
        if (best == null ||
            (best.access == ModuleAccess.readOnly &&
                grant.access == ModuleAccess.full)) {
          best = grant;
        }
      }
      if (best != null) {
        entries.add(
          AdminMenuEntry(module: module, access: best.access, note: best.note),
        );
      }
    }
    return entries;
  }
}
