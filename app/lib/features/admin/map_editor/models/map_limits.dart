import '../../../../core/config/venue_map_schema.dart';
import 'map_document.dart';

/// A cap of the document that a tool checks before it adds (AC-75: a tool
/// refuses to place or create beyond its cap, naming the cap and the count).
enum Cap {
  levels,
  buildings,
  walls,
  openings,
  units,
  polyPoints;

  /// The cap's value, from `VenueMapConstants`.
  int get limit => switch (this) {
    Cap.levels => VenueMapConstants.maxLevels,
    Cap.buildings => VenueMapConstants.maxBuildings,
    Cap.walls => VenueMapConstants.maxWallsPerLevel,
    Cap.openings => VenueMapConstants.maxOpeningsPerLevel,
    Cap.units => VenueMapConstants.maxUnitsPerLevel,
    Cap.polyPoints => VenueMapConstants.maxPolyPoints,
  };
}

/// A refused addition: which cap, how many there already are, and the limit.
class CapRefusal {
  const CapRefusal({required this.cap, required this.count});

  final Cap cap;
  final int count;
  int get limit => cap.limit;
}

/// The refusal for adding one more to [count] of [cap], or null when it fits.
CapRefusal? checkCap(Cap cap, int count) =>
    count >= cap.limit ? CapRefusal(cap: cap, count: count) : null;

/// The refusal for adding a wall, an opening or a unit to [level], or null (also
/// null for a cap that is not a level's).
CapRefusal? levelCapFor(Cap cap, Level level) => switch (cap) {
  Cap.walls => checkCap(cap, level.wallList.length),
  Cap.openings => checkCap(cap, level.openingList.length),
  Cap.units => checkCap(cap, level.unitList.length),
  Cap.levels || Cap.buildings || Cap.polyPoints => null,
};
