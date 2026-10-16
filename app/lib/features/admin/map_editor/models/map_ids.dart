import 'dart:math';

import '../constants/editor_constants.dart';

/// The prefix of each element kind's id (DC-E28; office section 3). A level's
/// id is `L<n>` instead.
abstract final class IdPrefix {
  static const String wall = 'w';
  static const String opening = 'o';
  static const String unit = 'u';
  static const String building = 'b';
}

const String _base36 = '0123456789abcdefghijklmnopqrstuvwxyz';

final Random _systemRandom = Random();

/// A new element id: [prefix], a dash and six base-36 characters, never one in
/// [used] (office section 3: ids are unique across the whole document). A
/// collision is regenerated (AC-75, EC-46).
String newElementId(String prefix, Set<String> used, {Random? random}) {
  final source = random ?? _systemRandom;
  while (true) {
    final chars = StringBuffer();
    for (var i = 0; i < EditorConstants.idRandomChars; i++) {
      chars.write(_base36[source.nextInt(_base36.length)]);
    }
    final id = '$prefix-$chars';
    if (!used.contains(id)) return id;
  }
}

/// A new level id, `L<n>` with the smallest `n` from 1 that is not in [used].
String newLevelId(Set<String> used) {
  var n = 1;
  while (used.contains('L$n')) {
    n++;
  }
  return 'L$n';
}
