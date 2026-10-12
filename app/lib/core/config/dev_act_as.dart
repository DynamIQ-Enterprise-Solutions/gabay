import 'package:flutter/foundation.dart';

/// Which seeded account (and, for an account holding two tenants, which
/// tenant) the development switcher chooses (E-20, FF-SK plan section 5).
@immutable
class DevActAs {
  const DevActAs({this.email, this.tenantId, this.restored = false});

  /// The account the stand-in acts as (`X-Dev-Act-As`), or null for none: the
  /// server then acts as `DEV_STUB_USER_EMAIL`.
  final String? email;

  /// The tenant chosen for an account that holds two (`X-Tenant-Id`), or null.
  final int? tenantId;

  /// False until the kept choice has been read from storage (or a choice was
  /// made first), so the dashboard can wait instead of flashing the default.
  final bool restored;
}
