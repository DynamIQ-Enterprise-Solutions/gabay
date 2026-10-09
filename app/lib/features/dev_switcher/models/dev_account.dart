/// One role an account holds, in one tenant (or, for SUPERADMIN, none).
class DevRoleGrant {
  const DevRoleGrant({required this.code, this.tenantId, this.tenantName});

  /// The role code (`MALL_ADMIN`).
  final String code;

  /// The tenant the role is held in; null for a platform role (SUPERADMIN).
  final int? tenantId;

  final String? tenantName;
}

/// A mall operator an account holds a role in.
class DevTenant {
  const DevTenant({required this.id, required this.name});

  final int id;
  final String name;
}

/// A seeded account the development switcher can act as: one row of
/// `GET /api/dev/accounts` (E-20, FF-SK plan section 5; the contract is in
/// `phase-reports/feature-first/FF-SK-client.md`). Removed with the switcher
/// in R8.
class DevAccount {
  const DevAccount({
    required this.email,
    required this.displayName,
    required this.isDefault,
    required this.roles,
  });

  /// Reads one row of the reply. A row of the wrong shape is a
  /// [FormatException], which `formatApiError` words as "unexpected reply".
  factory DevAccount.fromJson(Object? json) {
    if (json is! Map<String, Object?>) {
      throw const FormatException('An account is not an object');
    }
    final email = json['email'];
    final displayName = json['displayName'];
    final roles = json['roles'];
    if (email is! String || email.isEmpty) {
      throw const FormatException('An account has no email');
    }
    if (displayName is! String) {
      throw const FormatException('An account has no displayName');
    }
    if (roles is! List<Object?>) {
      throw const FormatException('An account has no roles list');
    }
    final isDefault = json['isDefault'];
    return DevAccount(
      email: email,
      displayName: displayName,
      isDefault: isDefault is bool && isDefault,
      roles: roles.map(_roleFromJson).toList(growable: false),
    );
  }

  static DevRoleGrant _roleFromJson(Object? json) {
    if (json is! Map<String, Object?>) {
      throw const FormatException('A role is not an object');
    }
    final code = json['code'];
    final tenantId = json['tenantId'];
    final tenantName = json['tenantName'];
    if (code is! String || code.isEmpty) {
      throw const FormatException('A role has no code');
    }
    if (tenantId != null && tenantId is! int) {
      throw const FormatException('A role tenantId is not a whole number');
    }
    return DevRoleGrant(
      code: code,
      tenantId: tenantId as int?,
      tenantName: tenantName is String ? tenantName : null,
    );
  }

  final String email;
  final String displayName;

  /// The account the stand-in acts as when no header names one
  /// (`DEV_STUB_USER_EMAIL`).
  final bool isDefault;

  final List<DevRoleGrant> roles;

  /// The tenants the account holds a role in, each once, in the order the
  /// server gave them (by tenant code, so the first is the server's own
  /// default). Empty for the platform account.
  List<DevTenant> get tenants {
    final seen = <int>{};
    return [
      for (final role in roles)
        if (role.tenantId != null && seen.add(role.tenantId!))
          DevTenant(id: role.tenantId!, name: role.tenantName ?? ''),
    ];
  }

  /// The roles in effect in [tenantId]: the ones held there, and the platform
  /// roles, which hold everywhere.
  List<DevRoleGrant> rolesIn(int? tenantId) => [
    for (final role in roles)
      if (role.tenantId == null || role.tenantId == tenantId) role,
  ];
}
