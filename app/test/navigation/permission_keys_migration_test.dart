import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';

/// The menu and the backend agree on the route keys (SEC-3 AC-35, standard
/// §4.5): a module the app marks built must name a key some migration seeds as
/// a `PermissionRoute`, so the menu never shows a page whose backend refuses
/// the role. The migrations are read from `db/migrations/` as
/// `support/schema_reader.dart` reads the schema.
void main() {
  /// The `RouteKey` of every `PermissionRoute` row any migration inserts.
  Set<String> seededKeys() {
    final keys = <String>{};
    final files = Directory('../db/migrations')
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.sql'));
    for (final file in files) {
      final sql = file.readAsStringSync();
      for (final insert in RegExp(
        r'INSERT\s+INTO\s+gabay\.PermissionRoute\b[^;]*;',
        caseSensitive: false,
      ).allMatches(sql)) {
        for (final row in RegExp(
          r"\(\s*'([a-z][a-z0-9-]*)'\s*,\s*'",
        ).allMatches(insert.group(0)!)) {
          keys.add(row.group(1)!);
        }
      }
    }
    return keys;
  }

  test('the migrations seed the keys the guards use', () {
    expect(
      seededKeys(),
      containsAll(['lookups', 'venues', 'venue-maps', 'venue-versions']),
    );
  });

  test('every built module names a seeded key', () {
    final seeded = seededKeys();
    for (final module in ModuleRegistry.admin.where((m) => m.built)) {
      expect(module.permissionKey, isNotNull, reason: module.id);
      expect(
        seeded,
        contains(module.permissionKey),
        reason:
            '${module.id} names "${module.permissionKey}", which no migration '
            'seeds in PermissionRoute: the menu would show a page the backend '
            'refuses',
      );
    }
  });

  test('a key that is not seeded is caught (the check can fail)', () {
    expect(seededKeys(), isNot(contains('a-key-nobody-seeded')));
  });
}
