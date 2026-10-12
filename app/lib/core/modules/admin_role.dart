import '../../l10n/app_localizations.dart';

/// The four roles that get a dashboard now (FF-SK, plan section 2). MERCHANT,
/// UNIT and MAINTENANCE are the next release (L41) and have none.
///
/// [code] is what the API and the seed use (`UserRole` through `Role.Code`).
/// The role-to-module map lives in `module_registry.dart` until R8 replaces
/// it with the permission-driven menu (Phase 2 Q9).
enum AdminRole {
  superAdmin('SUPERADMIN'),
  mallAdmin('MALL_ADMIN'),
  venueEditor('VENUE_EDITOR'),
  viewer('VIEWER');

  const AdminRole(this.code);

  final String code;

  /// The role for an API role code, or null for one with no dashboard yet.
  static AdminRole? fromCode(String code) {
    for (final role in values) {
      if (role.code == code) return role;
    }
    return null;
  }

  /// The role's name as shown to people, from ARB.
  String label(AppLocalizations l10n) => switch (this) {
    AdminRole.superAdmin => l10n.roleSuperAdmin,
    AdminRole.mallAdmin => l10n.roleMallAdmin,
    AdminRole.venueEditor => l10n.roleVenueEditor,
    AdminRole.viewer => l10n.roleViewer,
  };
}
