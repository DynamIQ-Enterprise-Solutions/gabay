import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/closed_set_labels.dart';

import '../support/shell_harness.dart';

/// P0-11 r3 AC-134 (every value of the closed sets the map editor shows has its
/// label from ARB; a set with a value missing a label cannot build), DC-E11 (the
/// option's value is the code the document stores).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final sets = <String, List<String>>{
    'ImdfUnitCategory': [for (final v in ImdfUnitCategory.values) v.code],
    'WallKind': [for (final v in WallKind.values) v.code],
    'OpeningKind': [for (final v in OpeningKind.values) v.code],
    'FloorFinish': [for (final v in FloorFinish.values) v.code],
  };

  test('the sets the editor shows are the four of the plan', () {
    expect(kEditorClosedSets, sets.keys.toList());
  });

  for (final entry in sets.entries) {
    group(entry.key, () {
      test('has one option per generated value, in the generated order', () {
        final options = closedSetOptions(entry.key, l10n);
        expect(options.map((o) => o.value), entry.value);
      });

      test('every label is written, and no two values share one', () {
        final labels = closedSetOptions(entry.key, l10n).map((o) => o.label);
        for (final label in labels) {
          expect(label.trim(), isNotEmpty);
        }
        expect(labels.toSet().length, labels.length);
      });

      test('an option is active, and its label is found again by its code', () {
        for (final option in closedSetOptions(entry.key, l10n)) {
          expect(option.isActive, isTrue);
          expect(
            closedSetLabel(entry.key, option.value as String, l10n),
            option.label,
          );
        }
      });
    });
  }

  test('a code the set does not have has no label (shown as its code)', () {
    expect(closedSetLabel('WallKind', 'brick-and-mortar', l10n), isNull);
  });

  test('a set the editor does not show has no label', () {
    expect(closedSetLabel('SomethingElse', 'x', l10n), isNull);
  });

  test('a misspelt set name fails at once', () {
    expect(() => closedSetOptions('WallKinds', l10n), throwsArgumentError);
  });

  test('the labels are the words of the admin page', () {
    expect(closedSetLabel('OpeningKind', OpeningKind.door.code, l10n), 'Door');
    expect(
      closedSetLabel('ImdfUnitCategory', ImdfUnitCategory.walkway.code, l10n),
      'Walkway',
    );
  });
}
