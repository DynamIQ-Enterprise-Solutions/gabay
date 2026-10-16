import 'package:flutter/foundation.dart';

import '../../../../core/config/closed_sets.dart';
import '../../../../core/config/venue_map_schema.dart';

/// The venue map document in the editor's typed model (P0-11 r3 AC-76, DC-E10;
/// plan/OA-4a-1-draw-a-floor.md section 3.2).
///
/// Everything is immutable and **copy-on-write**: a change copies the one list
/// it touches and shares every other level and element, so 100 undo snapshots
/// hold only what changed and an untouched level stays `identical()` across
/// them.
///
/// The model keeps every field it loaded. Fields the editor edits in this slice
/// are typed; every other field of those elements, and every element kind not
/// drawn yet (items, corrections, points, connectors, a level's `backdrop`, the
/// site's `georeference`), sits in a `rest` map or a raw list and is written
/// back untouched, in the order it came. A field that was **absent** when
/// loaded is `null` here and is written back absent (the server's canonical
/// copy keeps absence, so a load and a save with no edit gives the same
/// document); a field the editor sets is written.
///
/// Numbers are metres and degrees as `double`; a point is `[x, z]` with `z`
/// running down the plan (office section 3, AC-60).

/// A point on the plan, in metres of the venue frame: `x` right, `z` down.
@immutable
class Pt {
  const Pt(this.x, this.z);

  final double x;
  final double z;

  List<double> toJson() => [x, z];

  Pt operator +(Pt other) => Pt(x + other.x, z + other.z);
  Pt operator -(Pt other) => Pt(x - other.x, z - other.z);

  @override
  bool operator ==(Object other) => other is Pt && other.x == x && other.z == z;

  @override
  int get hashCode => Object.hash(x, z);

  @override
  String toString() => 'Pt($x, $z)';
}

/// The marker for "leave this nullable field as it is" in a `copyWith`.
const Object _keep = Object();

/// An empty `rest` map: shared, never written to.
const Map<String, Object?> _noRest = <String, Object?>{};

/// A wall (office section 4.2): a segment with a thickness and a kind.
@immutable
class Wall {
  const Wall({
    required this.id,
    required this.a,
    required this.b,
    this.t,
    this.kind,
    this.rest = _noRest,
  });

  final String id;
  final Pt a;
  final Pt b;

  /// Thickness in metres; null means "not written", which reads as
  /// `VenueMapConstants.wallThicknessDefaultM`.
  final double? t;

  /// A `WallKind` code; null reads as `solid`.
  final String? kind;

  /// Every other field as loaded (`review`).
  final Map<String, Object?> rest;

  double get thickness => t ?? VenueMapConstants.wallThicknessDefaultM;
  String get wallKind => kind ?? WallKind.solid.code;

  Wall copyWith({Pt? a, Pt? b, Object? t = _keep, Object? kind = _keep}) =>
      Wall(
        id: id,
        a: a ?? this.a,
        b: b ?? this.b,
        t: identical(t, _keep) ? this.t : t as double?,
        kind: identical(kind, _keep) ? this.kind : kind as String?,
        rest: rest,
      );
}

/// A door or a window set into a wall at a fraction of its length.
@immutable
class Opening {
  const Opening({
    required this.id,
    required this.wall,
    required this.at,
    required this.w,
    this.kind,
    this.name,
    this.clearW,
    this.entrance,
    this.rest = _noRest,
  });

  final String id;

  /// The id of the wall it sits in (same level).
  final String wall;

  /// The position along the wall, 0 to 1.
  final double at;

  /// The width in metres.
  final double w;

  /// An `OpeningKind` code; null reads as `door`.
  final String? kind;
  final String? name;

  /// The measured clear width; null means "not measured".
  final double? clearW;

  /// Whether this door is a venue entrance; null reads as false.
  final bool? entrance;
  final Map<String, Object?> rest;

  String get openingKind => kind ?? OpeningKind.door.code;
  bool get isEntrance => entrance ?? false;

  Opening copyWith({
    double? at,
    double? w,
    Object? kind = _keep,
    Object? name = _keep,
    Object? clearW = _keep,
    Object? entrance = _keep,
  }) => Opening(
    id: id,
    wall: wall,
    at: at ?? this.at,
    w: w ?? this.w,
    kind: identical(kind, _keep) ? this.kind : kind as String?,
    name: identical(name, _keep) ? this.name : name as String?,
    clearW: identical(clearW, _keep) ? this.clearW : clearW as double?,
    entrance: identical(entrance, _keep) ? this.entrance : entrance as bool?,
    rest: rest,
  );
}

/// A unit (office's "room"): a polygon with a category.
@immutable
class Unit {
  const Unit({
    required this.id,
    required this.category,
    required this.poly,
    this.name,
    this.walkable,
    this.passThrough,
    this.parent,
    this.doors,
    this.floorFinish,
    this.rest = _noRest,
  });

  final String id;

  /// An `ImdfUnitCategory` code.
  final String category;
  final List<Pt> poly;
  final String? name;

  /// Written always by the server's canonical copy (alwaysWrite); null only
  /// before the first save of a unit the editor made without one.
  final bool? walkable;
  final bool? passThrough;
  final String? parent;
  final List<String>? doors;

  /// The unit's own floor finish (`floor.finish`), or null for the level's.
  final String? floorFinish;
  final Map<String, Object?> rest;

  Unit copyWith({
    String? category,
    List<Pt>? poly,
    Object? name = _keep,
    Object? walkable = _keep,
    Object? passThrough = _keep,
    Object? floorFinish = _keep,
  }) => Unit(
    id: id,
    category: category ?? this.category,
    poly: poly ?? this.poly,
    name: identical(name, _keep) ? this.name : name as String?,
    walkable: identical(walkable, _keep) ? this.walkable : walkable as bool?,
    passThrough: identical(passThrough, _keep)
        ? this.passThrough
        : passThrough as bool?,
    parent: parent,
    doors: doors,
    floorFinish: identical(floorFinish, _keep)
        ? this.floorFinish
        : floorFinish as String?,
    rest: rest,
  );
}

/// One floor of the venue (a `levels[]` entry).
@immutable
class Level {
  const Level({
    required this.id,
    required this.name,
    required this.shortName,
    required this.ordinal,
    required this.origin,
    required this.size,
    this.spokenName,
    this.building,
    this.outdoor,
    this.elevation,
    this.height,
    this.floorFinish,
    this.walls,
    this.openings,
    this.units,
    this.rest = _noRest,
  });

  final String id;
  final String name;
  final String shortName;
  final String? spokenName;

  /// The id of the building an indoor level belongs to; null on the outdoor
  /// level.
  final String? building;
  final bool? outdoor;
  final int ordinal;

  /// Metres; null means "not written", which reads as the schema's default.
  final double? elevation;
  final double? height;

  /// The rectangle's corner and its width and depth, in metres.
  final Pt origin;
  final Pt size;

  /// The level's own floor finish (`floor.finish`); null means not written.
  final String? floorFinish;

  /// Null means the key was not in the document; an empty list is the same
  /// thing for the editor.
  final List<Wall>? walls;
  final List<Opening>? openings;
  final List<Unit>? units;

  /// Every other field as loaded: items, corrections, amenities, transit
  /// points, anchors and the `backdrop`.
  final Map<String, Object?> rest;

  List<Wall> get wallList => walls ?? const <Wall>[];
  List<Opening> get openingList => openings ?? const <Opening>[];
  List<Unit> get unitList => units ?? const <Unit>[];

  bool get isOutdoor => outdoor ?? false;
  double get elevationM => elevation ?? VenueMapConstants.elevationDefaultM;
  double get heightM => height ?? VenueMapConstants.levelHeightDefaultM;

  /// The rectangle's far corner.
  Pt get far => Pt(origin.x + size.x, origin.z + size.z);

  /// Whether [p] lies inside the rectangle, edges included.
  bool contains(Pt p) =>
      p.x >= origin.x && p.x <= far.x && p.z >= origin.z && p.z <= far.z;

  Level copyWith({
    String? name,
    String? shortName,
    Object? spokenName = _keep,
    int? ordinal,
    Object? elevation = _keep,
    Object? height = _keep,
    Pt? origin,
    Pt? size,
    Object? floorFinish = _keep,
    List<Wall>? walls,
    List<Opening>? openings,
    List<Unit>? units,
  }) => Level(
    id: id,
    name: name ?? this.name,
    shortName: shortName ?? this.shortName,
    spokenName: identical(spokenName, _keep)
        ? this.spokenName
        : spokenName as String?,
    building: building,
    outdoor: outdoor,
    ordinal: ordinal ?? this.ordinal,
    elevation: identical(elevation, _keep)
        ? this.elevation
        : elevation as double?,
    height: identical(height, _keep) ? this.height : height as double?,
    origin: origin ?? this.origin,
    size: size ?? this.size,
    floorFinish: identical(floorFinish, _keep)
        ? this.floorFinish
        : floorFinish as String?,
    walls: walls ?? this.walls,
    openings: openings ?? this.openings,
    units: units ?? this.units,
    rest: rest,
  );
}

/// A building of the venue (a `buildings[]` entry). The first entry of the
/// document's array is the main building (L176, AC-144).
@immutable
class Building {
  const Building({
    required this.id,
    required this.name,
    required this.type,
    this.footprint,
    this.rest = _noRest,
  });

  final String id;
  final String name;

  /// A `building-types` lookup code.
  final String type;

  /// The outline drawn faintly on every level; null when there is none.
  final List<Pt>? footprint;

  /// Every other field as loaded (`mapUp`, `review`).
  final Map<String, Object?> rest;
}

/// The venue's property: its boundary, and what OA-4a-2 edits of it.
@immutable
class Site {
  const Site({required this.boundary, this.rest = _noRest});

  final List<Pt> boundary;

  /// Every other field as loaded (`georeference`, `mapUp`).
  final Map<String, Object?> rest;
}

/// The whole document: one per venue (OA-1 r1).
@immutable
class MapDocument {
  const MapDocument({
    required this.site,
    required this.levels,
    this.spec = 1,
    this.units,
    this.catalog,
    this.buildings,
    this.connectors,
    this.rest = _noRest,
  });

  final int spec;

  /// The units text (`m`); null when it was not written.
  final String? units;

  /// The catalog version the document was made under (OA-1 section 2.1).
  final int? catalog;
  final Site site;

  /// Null when the key was not in the document (an outdoor ground only).
  final List<Building>? buildings;
  final List<Level> levels;

  /// The connectors, untouched until OA-4a-2: raw JSON as loaded.
  final List<Object?>? connectors;

  /// Any other top-level key as loaded.
  final Map<String, Object?> rest;

  List<Building> get buildingList => buildings ?? const <Building>[];

  Level? levelById(String id) {
    for (final level in levels) {
      if (level.id == id) return level;
    }
    return null;
  }

  Building? buildingById(String id) {
    for (final building in buildingList) {
      if (building.id == id) return building;
    }
    return null;
  }

  /// A copy with [replace] called on the level [levelId] (the other levels and
  /// every element of this one that [replace] leaves alone are shared).
  MapDocument withLevel(String levelId, Level Function(Level level) replace) {
    final index = levels.indexWhere((level) => level.id == levelId);
    if (index < 0) return this;
    final replaced = replace(levels[index]);
    if (identical(replaced, levels[index])) return this;
    return copyWith(
      levels: [
        ...levels.sublist(0, index),
        replaced,
        ...levels.sublist(index + 1),
      ],
    );
  }

  MapDocument copyWith({
    Site? site,
    List<Level>? levels,
    List<Building>? buildings,
    int? catalog,
  }) => MapDocument(
    spec: spec,
    units: units,
    catalog: catalog ?? this.catalog,
    site: site ?? this.site,
    buildings: buildings ?? this.buildings,
    levels: levels ?? this.levels,
    connectors: connectors,
    rest: rest,
  );

  /// Every element id in the document, of every kind, for the uniqueness of a
  /// new id (office section 3: unique across the whole document).
  Set<String> allIds() {
    final ids = <String>{};
    for (final building in buildingList) {
      ids.add(building.id);
    }
    for (final level in levels) {
      ids.add(level.id);
      for (final wall in level.wallList) {
        ids.add(wall.id);
      }
      for (final opening in level.openingList) {
        ids.add(opening.id);
      }
      for (final unit in level.unitList) {
        ids.add(unit.id);
      }
      for (final value in level.rest.values) {
        _collectRawIds(value, ids);
      }
    }
    for (final connector in connectors ?? const <Object?>[]) {
      _collectRawIds(connector, ids);
    }
    return ids;
  }

  static void _collectRawIds(Object? value, Set<String> ids) {
    if (value is List<Object?>) {
      for (final entry in value) {
        if (entry is Map<String, Object?>) {
          final id = entry['id'];
          if (id is String) ids.add(id);
        }
      }
    }
  }
}
