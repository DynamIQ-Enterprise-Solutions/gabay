import 'package:flutter/material.dart';

import '../../features/session/models/access_profile.dart';
import '../../l10n/app_localizations.dart';
import 'module_slice.dart';

/// The module registry (FF-SK, plan/FF-SK-dashboards.md section 2; PRD 6.26;
/// FEATURE_PIPELINE P0-16): one entry per module, and the one source of the
/// admin menus, the role home pages and the placeholder pages.
///
/// A slice that delivers a module flips [ModuleInfo.built] to true and
/// registers its screen in `shared/navigation/admin_routes.dart` (or the
/// shopper tab in `shopper_routes.dart`); nothing else here changes.
///
/// The registry holds no role table (SEC-3, DC-9). Which modules a person sees,
/// and what they may do in each, comes from the permissions `GET /api/me`
/// returns for the tenant in effect: a module names the one `PermissionRoute`
/// key it is guarded by ([AdminModule.permissionKey]) and [ModuleRegistry.menuFor]
/// reads the flags for it (Phase 2 Q9). The server enforces the same rows.

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
    this.permissionKey,
    this.needsTenant = true,
    super.built,
  });

  final ModuleTier tier;

  /// The one `PermissionRoute` key this module is guarded by (SEC-3, AC-31):
  /// the router reads the account's flags for it, the menu shows the module
  /// when the account may read it. Null until the slice that builds the module
  /// seeds its key; a module with none opens for a SUPERADMIN only (DC-13).
  final String? permissionKey;

  /// True when the module works inside one tenant, so its data is a tenant's:
  /// a SUPERADMIN, which acts with no tenant until one is chosen, is told to
  /// choose one before such a page opens. The two platform modules (the
  /// platform lookups and the national holidays) do not need one.
  final bool needsTenant;
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

/// One line of a menu: a module and what the account may do in it, from the
/// permission flags of the tenant in effect (SUPERADMIN: everything).
class AdminMenuEntry {
  const AdminMenuEntry({required this.module, required this.flags});

  final AdminModule module;
  final PermissionFlags flags;

  /// The account may look at the module and change nothing in it.
  bool get readOnly => flags.readOnly;
}

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
      built: true,
      // The one key so far (DC-13): the slice that builds a module chooses its
      // key along with its routes. The editor and the viewer read it only (the
      // seeded rows, owner ruling Q1 (a), 2b); the editor's building and level
      // work is the map editor's, from OA-4.
      permissionKey: 'venues',
      tier: ModuleTier.p0,
    ),
    AdminModule(
      id: 'map-editor',
      name: (l) => l.moduleMapEditor,
      icon: Icons.edit_location_alt,
      pipelineIds: const ['P0-11'],
      slice: const ModuleSlice.feature('OA-4'),
      built: true,
      // The map routes' key (migration 0002): MALL_ADMIN, VENUE_EDITOR and VIEWER
      // read it, so all three see the module; what each may do in it follows the
      // flags (editor_access.dart: draw = update, clear = delete, publish and
      // restore = create on venue-versions). OA-4a-1, plan 1.1 section 0.4.
      permissionKey: 'venue-maps',
      tier: ModuleTier.p0,
    ),
    AdminModule(
      id: 'publish',
      name: (l) => l.modulePublish,
      icon: Icons.publish,
      pipelineIds: const ['P0-03'],
      slice: const ModuleSlice.feature('FF-3'),
      tier: ModuleTier.p0,
    ),
    AdminModule(
      id: 'beacon-planner',
      name: (l) => l.moduleBeaconPlanner,
      icon: Icons.sensors,
      pipelineIds: const ['P0-12'],
      slice: const ModuleSlice.feature('FF-11'),
      tier: ModuleTier.p0,
    ),
    AdminModule(
      id: 'beacon-fleet',
      name: (l) => l.moduleBeaconFleet,
      icon: Icons.router,
      pipelineIds: const ['P0-13'],
      slice: const ModuleSlice.feature('FF-9'),
      tier: ModuleTier.p0,
    ),
    // P1
    AdminModule(
      id: 'plan-import',
      name: (l) => l.modulePlanImport,
      icon: Icons.upload_file,
      pipelineIds: const ['P1-03'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
    ),
    AdminModule(
      id: 'store-status',
      name: (l) => l.moduleStoreStatus,
      icon: Icons.store_mall_directory,
      pipelineIds: const ['P1-01'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
    ),
    AdminModule(
      id: 'analytics',
      name: (l) => l.moduleAnalytics,
      icon: Icons.analytics,
      pipelineIds: const ['P1-04'],
      slice: const ModuleSlice.afterRetrofit('P1'),
      tier: ModuleTier.p1,
    ),
    // P2
    AdminModule(
      id: 'opening-hours',
      name: (l) => l.moduleOpeningHours,
      icon: Icons.schedule,
      pipelineIds: const ['P2-02'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
    ),
    AdminModule(
      id: 'store-pages',
      name: (l) => l.moduleStorePages,
      icon: Icons.storefront,
      pipelineIds: const ['P2-03'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
    ),
    AdminModule(
      id: 'forecasts',
      name: (l) => l.moduleForecasts,
      icon: Icons.query_stats,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
    ),
    AdminModule(
      id: 'holidays',
      name: (l) => l.moduleHolidays,
      icon: Icons.event,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
    ),
    AdminModule(
      id: 'national-holidays',
      name: (l) => l.moduleNationalHolidays,
      icon: Icons.flag,
      pipelineIds: const ['P2-04'],
      slice: const ModuleSlice.afterRetrofit('P2'),
      tier: ModuleTier.p2,
      needsTenant: false,
    ),
    // P3
    AdminModule(
      id: 'promos',
      name: (l) => l.modulePromos,
      icon: Icons.campaign,
      pipelineIds: const ['P3-01'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
    ),
    AdminModule(
      id: 'evacuation',
      name: (l) => l.moduleEvacuation,
      icon: Icons.directions_run,
      pipelineIds: const ['P3-02'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
    ),
    AdminModule(
      id: 'crowd-routing',
      name: (l) => l.moduleCrowdRouting,
      icon: Icons.groups,
      pipelineIds: const ['P3-03'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
    ),
    AdminModule(
      id: 'assisted-drawing',
      name: (l) => l.moduleAssistedDrawing,
      icon: Icons.draw,
      pipelineIds: const ['P3-04'],
      slice: const ModuleSlice.afterRetrofit('P3'),
      tier: ModuleTier.p3,
    ),
    // Administration (Phase 2 and the Phase 3 baseline)
    AdminModule(
      id: 'users',
      name: (l) => l.moduleUsers,
      icon: Icons.people,
      pipelineIds: const ['P2-S7', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R6, R9'),
      tier: ModuleTier.administration,
    ),
    AdminModule(
      id: 'roles',
      name: (l) => l.moduleRoles,
      icon: Icons.admin_panel_settings,
      pipelineIds: const ['P2-S3', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R2, R9'),
      tier: ModuleTier.administration,
    ),
    AdminModule(
      id: 'audit-log',
      name: (l) => l.moduleAuditLog,
      icon: Icons.history,
      pipelineIds: const ['P2-S4', 'P2-S11'],
      slice: const ModuleSlice.retrofit('R3, R9'),
      tier: ModuleTier.administration,
    ),
    AdminModule(
      id: 'settings',
      name: (l) => l.moduleSettings,
      icon: Icons.settings,
      pipelineIds: const ['P2-S11'],
      slice: const ModuleSlice.retrofit('R9'),
      tier: ModuleTier.administration,
    ),
    AdminModule(
      id: 'platform',
      name: (l) => l.modulePlatform,
      icon: Icons.domain,
      pipelineIds: const [kPhase3Baseline],
      slice: const ModuleSlice.retrofit('R11'),
      tier: ModuleTier.administration,
      needsTenant: false,
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

  /// The menu for [profile] working in [tenantId] (null: no tenant in effect),
  /// in menu order (SEC-3, AC-37).
  ///
  /// A SUPERADMIN sees every module in the registry, placeholders included, in
  /// every tenant and with none chosen (it skips permission checks, PH2 Q8, and
  /// Q6 (a)). Anyone else sees a module exactly when it is built, names a key,
  /// and the account has `read` on that key in the tenant. A key the reply lacks
  /// shows nothing (EC-46); a placeholder reaches other roles when its slice
  /// seeds a key and sets `built`.
  ///
  /// [modules] is the list the menu is drawn from: the registry's own, except in
  /// a test of the rules themselves.
  static List<AdminMenuEntry> menuFor(
    AccessProfile profile,
    int? tenantId, {
    List<AdminModule>? modules,
  }) {
    final source = modules ?? admin;
    if (profile.isSuperAdmin) {
      return [
        for (final module in source)
          AdminMenuEntry(module: module, flags: PermissionFlags.all),
      ];
    }
    final tenant = tenantId == null ? null : profile.tenantById(tenantId);
    if (tenant == null) return const [];
    return [
      for (final module in source)
        if (module.built && module.permissionKey != null)
          if (tenant.flagsFor(module.permissionKey!) case final flags
              when flags.read)
            AdminMenuEntry(module: module, flags: flags),
    ];
  }
}
