import 'dart:math';

/// The prefix of each element kind's id (DC-E28; office section 3). A level's
/// id is `L<n>` instead.
abstract final class IdPrefix {
  static const String wall = 'w';
  static const String opening = 'o';
  static const String unit = 'u';
  static const String building = 'b';
}

/// A new element id: [prefix], a dash and six base-36 characters, never one in
/// [used] (office section 3: ids are unique across the whole document). A
/// collision is regenerated (AC-75, EC-46).
String newElementId(String prefix, Set<String> used, {Random? random}) =>
    throw UnimplementedError();

/// A new level id, `L<n>` with the smallest `n` from 1 that is not in [used].
String newLevelId(Set<String> used) => throw UnimplementedError();
