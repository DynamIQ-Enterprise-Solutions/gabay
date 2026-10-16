import '../../../core/network/json_fields.dart';

/// What one permission row lets the account do in one route (`PermissionRoute`
/// key): the four flags of standard §3.4, already merged by the server.
class PermissionFlags {
  const PermissionFlags({
    required this.create,
    required this.read,
    required this.update,
    required this.delete,
  });

  /// One route's entry of `GET /api/me`: all four flags, each true or false.
  factory PermissionFlags.fromJson(Object? json) {
    final map = jsonObject(json, 'a permission entry');
    return PermissionFlags(
      create: jsonBool(map, 'create'),
      read: jsonBool(map, 'read'),
      update: jsonBool(map, 'update'),
      delete: jsonBool(map, 'delete'),
    );
  }

  /// A route the reply has no entry for: nothing is granted.
  static const PermissionFlags none = PermissionFlags(
    create: false,
    read: false,
    update: false,
    delete: false,
  );

  /// Everything: SUPERADMIN bypasses the permission rows (PH2 Q8).
  static const PermissionFlags all = PermissionFlags(
    create: true,
    read: true,
    update: true,
    delete: true,
  );

  final bool create;
  final bool read;
  final bool update;
  final bool delete;

  /// True when the account may read but not create, update or delete.
  bool get readOnly => read && !create && !update && !delete;

  @override
  bool operator ==(Object other) =>
      other is PermissionFlags &&
      other.create == create &&
      other.read == read &&
      other.update == update &&
      other.delete == delete;

  @override
  int get hashCode => Object.hash(create, read, update, delete);
}

/// The signed-in person, as the API knows them (`user` of `GET /api/me`).
class AccountUser {
  const AccountUser({
    required this.userId,
    required this.email,
    required this.displayName,
  });

  factory AccountUser.fromJson(Object? json) {
    final map = jsonObject(json, 'the user');
    return AccountUser(
      userId: jsonInt(map, 'userId'),
      email: jsonString(map, 'email'),
      displayName: jsonString(map, 'displayName'),
    );
  }

  final int userId;
  final String email;
  final String displayName;
}

/// A tenant (mall operator) the account holds a role in, with what the account
/// may do inside it.
class TenantAccess {
  const TenantAccess({
    required this.tenantId,
    required this.code,
    required this.name,
    required this.isActive,
    required this.roles,
    required this.permissions,
  });

  factory TenantAccess.fromJson(Object? json) {
    final map = jsonObject(json, 'a tenant');
    final roles = map['roles'];
    if (roles is! List) {
      throw const FormatException('Expected "roles" as a list.');
    }
    final permissions = jsonObject(map['permissions'], '"permissions"');
    return TenantAccess(
      tenantId: jsonInt(map, 'tenantId'),
      code: jsonString(map, 'code'),
      name: jsonString(map, 'name'),
      isActive: jsonBool(map, 'isActive'),
      roles: [
        for (final role in roles)
          role is String
              ? role
              : throw const FormatException('Expected a role code as text.'),
      ],
      // A key the registry does not know is kept here and never consulted
      // (EC-46): the menu asks for the keys it has.
      permissions: {
        for (final entry in permissions.entries)
          entry.key: PermissionFlags.fromJson(entry.value),
      },
    );
  }

  final int tenantId;
  final String code;
  final String name;

  /// False: every request in this tenant answers 403 for anyone but a
  /// SUPERADMIN (L186 Q3 (a)).
  final bool isActive;

  /// The role codes the account holds in this tenant.
  final List<String> roles;

  /// The merged permissions by `PermissionRoute` key.
  final Map<String, PermissionFlags> permissions;

  /// The flags for [routeKey]; none when the reply has no entry for it.
  PermissionFlags flagsFor(String routeKey) =>
      permissions[routeKey] ?? PermissionFlags.none;
}

/// A tenant a SUPERADMIN may act in (`actAsTenants` of `GET /api/me`): every
/// tenant, active or not.
class ActAsTenant {
  const ActAsTenant({
    required this.tenantId,
    required this.code,
    required this.name,
    required this.isActive,
  });

  factory ActAsTenant.fromJson(Object? json) {
    final map = jsonObject(json, 'a tenant');
    return ActAsTenant(
      tenantId: jsonInt(map, 'tenantId'),
      code: jsonString(map, 'code'),
      name: jsonString(map, 'name'),
      isActive: jsonBool(map, 'isActive'),
    );
  }

  final int tenantId;
  final String code;
  final String name;
  final bool isActive;
}

/// What `GET /api/me` answers (SEC-1): who the account is, its platform roles,
/// and its tenants with their merged permissions. Held by the session notifier
/// from sign-in until sign-out; a tenant switch does not reload it, since the
/// reply already holds every tenant (AC-21).
///
/// A reply of the wrong shape is a [FormatException] (EC-43): the session shows
/// an account error, never a partial menu. Keys this class does not read are
/// ignored (EC-46).
class AccessProfile {
  const AccessProfile({
    required this.user,
    required this.isSuperAdmin,
    required this.platformRoles,
    required this.tenants,
    required this.actAsTenants,
  });

  factory AccessProfile.fromJson(Object? json) {
    final map = jsonObject(json, 'the account');
    final platformRoles = map['platformRoles'];
    final tenants = map['tenants'];
    if (platformRoles is! List) {
      throw const FormatException('Expected "platformRoles" as a list.');
    }
    if (tenants is! List) {
      throw const FormatException('Expected "tenants" as a list.');
    }
    final isSuperAdmin = jsonBool(map, 'isSuperAdmin');
    final actAs = map['actAsTenants'];
    return AccessProfile(
      user: AccountUser.fromJson(map['user']),
      isSuperAdmin: isSuperAdmin,
      platformRoles: [
        for (final role in platformRoles)
          role is String
              ? role
              : throw const FormatException('Expected a role code as text.'),
      ],
      tenants: [for (final tenant in tenants) TenantAccess.fromJson(tenant)],
      // Read only for a SUPERADMIN (AC-47); another account's copy is ignored,
      // even a malformed one.
      actAsTenants: isSuperAdmin && actAs != null
          ? [
              for (final tenant
                  in actAs is List
                      ? actAs
                      : throw const FormatException(
                          'Expected "actAsTenants" as a list.',
                        ))
                ActAsTenant.fromJson(tenant),
            ]
          : const [],
    );
  }

  final AccountUser user;
  final bool isSuperAdmin;

  /// Role codes held with no tenant (`SUPERADMIN`).
  final List<String> platformRoles;

  /// The tenants the account holds a role in.
  final List<TenantAccess> tenants;

  /// Every tenant, for a SUPERADMIN only; empty for anyone else.
  final List<ActAsTenant> actAsTenants;

  /// The held tenant with [tenantId], or null.
  TenantAccess? tenantById(int tenantId) {
    for (final tenant in tenants) {
      if (tenant.tenantId == tenantId) return tenant;
    }
    return null;
  }
}
