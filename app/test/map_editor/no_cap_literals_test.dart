import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';

/// P0-11 r3 AC-75: no cap, range, default or length of the document is written
/// as a literal in editor code; it is read from the generated
/// `VenueMapConstants` (so a change in the schema file reaches the editor with
/// the regenerated Dart copy and `tools:test`). This scan fails on a numeric
/// literal in any editor source that equals one of those values, except in
/// `editor_constants.dart` (the editor's own office values, each with its
/// citation), `models/field_specs/` (a `FieldSpec`'s `maxLength` must be a
/// literal, which the `schema-forms` lint checks against the schema file, so the
/// lint keeps AC-75 there) and with the trivial values 0 to 10, 90, 180, 270, 360 and 1000
/// (an angle, a count of mm in a metre) left out.
void main() {
  /// Every `VenueMapConstants` number, by name. The class has no reflection, so
  /// the names are read from the generated source and the values from the class.
  final values = <String, num>{
    'minLevels': VenueMapConstants.minLevels,
    'maxLevels': VenueMapConstants.maxLevels,
    'maxBuildings': VenueMapConstants.maxBuildings,
    'maxConnectors': VenueMapConstants.maxConnectors,
    'maxWallsPerLevel': VenueMapConstants.maxWallsPerLevel,
    'maxOpeningsPerLevel': VenueMapConstants.maxOpeningsPerLevel,
    'maxUnitsPerLevel': VenueMapConstants.maxUnitsPerLevel,
    'maxItemsPerLevel': VenueMapConstants.maxItemsPerLevel,
    'maxCorrectionsPerLevel': VenueMapConstants.maxCorrectionsPerLevel,
    'maxPointsPerLevel': VenueMapConstants.maxPointsPerLevel,
    'maxPolyPoints': VenueMapConstants.maxPolyPoints,
    'maxMapBytes': VenueMapConstants.maxMapBytes,
    'maxProblems': VenueMapConstants.maxProblems,
    'venueExtentMaxM': VenueMapConstants.venueExtentMaxM,
    'levelSizeMinM': VenueMapConstants.levelSizeMinM,
    'elevationMinM': VenueMapConstants.elevationMinM,
    'elevationMaxM': VenueMapConstants.elevationMaxM,
    'levelHeightMinM': VenueMapConstants.levelHeightMinM,
    'levelHeightMaxM': VenueMapConstants.levelHeightMaxM,
    'levelHeightDefaultM': VenueMapConstants.levelHeightDefaultM,
    'polyMinAreaM2': VenueMapConstants.polyMinAreaM2,
    'wallMinLengthM': VenueMapConstants.wallMinLengthM,
    'wallThicknessMinM': VenueMapConstants.wallThicknessMinM,
    'wallThicknessMaxM': VenueMapConstants.wallThicknessMaxM,
    'wallThicknessDefaultM': VenueMapConstants.wallThicknessDefaultM,
    'openingWidthMinM': VenueMapConstants.openingWidthMinM,
    'openingWidthMaxM': VenueMapConstants.openingWidthMaxM,
    'nameMaxChars': VenueMapConstants.nameMaxChars,
    'noteMaxChars': VenueMapConstants.noteMaxChars,
    'levelNameMaxChars': VenueMapConstants.levelNameMaxChars,
    'levelShortNameMaxChars': VenueMapConstants.levelShortNameMaxChars,
    'itemLabelMaxChars': VenueMapConstants.itemLabelMaxChars,
    'levelOrdinalMin': VenueMapConstants.levelOrdinalMin,
  };

  const trivial = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 90, 180, 270, 360, 1000};

  final sources = [
    for (final entity in Directory(
      'lib/features/admin/map_editor',
    ).listSync(recursive: true))
      if (entity is File &&
          entity.path.endsWith('.dart') &&
          !_excluded(entity.path.replaceAll(r'\', '/')))
        entity,
  ];

  test('the scan sees the editor sources it scans', () {
    expect(sources.length, greaterThan(20));
  });

  test('the scan can fail: it reads numbers out of text', () {
    expect(_literalsIn('final x = 0.15 + 300 + 2000 + 0.05;'), [
      0.15,
      300,
      2000,
      0.05,
    ]);
    expect(_literalsIn("final s = 'a 200 b'; // 200"), isEmpty);
  });

  test('no editor source writes a document cap, range, default or length as a literal', () {
    final byValue = <num, List<String>>{};
    values.forEach((name, value) {
      if (trivial.contains(value)) return;
      byValue.putIfAbsent(value, () => []).add(name);
    });
    final problems = <String>[];
    for (final file in sources) {
      for (final literal in _literalsIn(file.readAsStringSync())) {
        final names = byValue[literal];
        if (names != null) {
          problems.add(
            '${file.path}: $literal is VenueMapConstants.${names.join(' or ')}',
          );
        }
      }
    }
    expect(problems, isEmpty);
  });
}

/// The files the scan leaves out (see the header).
bool _excluded(String path) =>
    path.endsWith('constants/editor_constants.dart') ||
    path.contains('/models/field_specs/');

/// The numeric literals of Dart [source], comments and strings left out.
List<num> _literalsIn(String source) {
  final withoutComments = source
      .replaceAll(RegExp(r'//[^\n]*'), '')
      .replaceAll(RegExp(r'/\*[\s\S]*?\*/'), '');
  final withoutStrings = withoutComments
      .replaceAll(RegExp(r"'(?:[^'\\\n]|\\.)*'"), "''")
      .replaceAll(RegExp(r'"(?:[^"\\\n]|\\.)*"'), '""');
  return [
    for (final match in RegExp(
      r'(?<![\w.])\d+(?:\.\d+)?(?:e-?\d+)?(?![\w])',
    ).allMatches(withoutStrings))
      num.parse(match.group(0)!),
  ];
}
