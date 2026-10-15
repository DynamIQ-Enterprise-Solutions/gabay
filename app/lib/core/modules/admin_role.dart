import '../../l10n/app_localizations.dart';

/// The four roles that have a name on screen now (FF-SK, plan section 2).
/// MERCHANT, UNIT and MAINTENANCE are the next release (L41): a role code this
/// enum does not know is shown by its code (SEC-3, EC-26).
///
/// [code] is what the API and the seed use (`UserRole` through `Role.Code`).
/// What a role may do is not here: the menu and the controls read the
/// permissions `GET /api/me` returns (SEC-3).
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
