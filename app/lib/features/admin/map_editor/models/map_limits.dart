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
  int get limit => throw UnimplementedError();
}

/// A refused addition: which cap, how many there already are, and the limit.
class CapRefusal {
  const CapRefusal({required this.cap, required this.count});

  final Cap cap;
  final int count;
  int get limit => cap.limit;
}

/// The refusal for adding one more to [count] of [cap], or null when it fits.
CapRefusal? checkCap(Cap cap, int count) => throw UnimplementedError();

/// The refusal for adding a wall, an opening or a unit to [level], or null.
CapRefusal? levelCapFor(Cap cap, Level level) => throw UnimplementedError();
