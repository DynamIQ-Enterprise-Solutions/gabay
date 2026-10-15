import 'dart:convert';
import 'dart:io';

import 'package:gabay/features/session/models/access_profile.dart';

/// The `GET /api/me` fixtures of `test/fixtures/` (AC-56): one per seeded role,
/// a two-tenant user, a SUPERADMIN with `actAsTenants` and an account with no
/// roles. `functions/test/sec3.meFixtures.test.js` checks that each equals what
/// the server answers for stated rows, so the client's idea of the reply and
/// the server's cannot drift apart alone.
const List<String> meFixtureNames = [
  'me_superadmin',
  'me_malladmin',
  'me_editor',
  'me_viewer',
  'me_two_tenants',
  'me_no_roles',
];

/// The decoded JSON of fixture [name], as the API would send it.
Map<String, Object?> meJson(String name) {
  final text = File('test/fixtures/$name.json').readAsStringSync();
  return (jsonDecode(text) as Map<String, Object?>);
}

/// The parsed fixture.
AccessProfile meProfile(String name) => AccessProfile.fromJson(meJson(name));
