import '../../../../core/config/closed_sets.dart';

/// The category of a new unit (P0-11 r3 AC-64, DC-E3): `room`, which is not
/// walkable. The admin chooses another in the panel.
final String defaultUnitCategory = ImdfUnitCategory.room.code;

/// Whether a unit of [categoryCode] is walkable by default (OA-1 AC-9): true
/// exactly when the category is in `WalkableUnitCategory` (P0-11 DC-8). The
/// panel recomputes it when the category changes (DC-P8); the admin can then set
/// it by hand. An unknown code is not walkable.
bool walkableForCategory(String categoryCode) {
  final category = ImdfUnitCategory.fromCode(categoryCode);
  return category != null && walkableUnitCategory.contains(category);
}
