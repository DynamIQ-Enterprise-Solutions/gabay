import 'map_document.dart';

/// Reads and writes the venue map document (P0-11 r3 AC-76). What the server
/// sends is its own canonical copy of a document that passed OA-1's validator,
/// so a shape that does not fit here is a [FormatException] (the editor shows
/// "unexpected reply", never raw text), not a case to repair.
///
/// A key the model does not type goes to `rest` and comes back as it was; a key
/// that was absent comes back absent. A load followed by a save with no edit is
/// therefore the same document, with the same ids and the same order of every
/// array.
MapDocument mapDocumentFromJson(Object? json) {
  final map = _object(json, 'the map document');
  final rest = _restOf(map, _documentKeys);
  final buildings = map['buildings'];
  final connectors = map['connectors'];
  return MapDocument(
    spec: _int(map['spec'], 'spec'),
    units: _optionalString(map['units'], 'units'),
    catalog: map['catalog'] == null ? null : _int(map['catalog'], 'catalog'),
    site: _siteFrom(map['site']),
    buildings: buildings == null
        ? null
        : [
            for (final entry in _list(buildings, 'buildings'))
              _buildingFrom(entry),
          ],
    levels: [for (final entry in _list(map['levels'], 'levels')) _levelFrom(entry)],
    connectors: connectors == null ? null : _list(connectors, 'connectors'),
    rest: rest,
  );
}

/// The document as JSON text's object form: what `PUT .../map/draft` sends as
/// `layout`.
Map<String, Object?> mapDocumentToJson(MapDocument document) => {
  'spec': document.spec,
  if (document.units != null) 'units': document.units,
  if (document.catalog != null) 'catalog': document.catalog,
  'site': {
    'boundary': _points(document.site.boundary),
    ...document.site.rest,
  },
  if (document.buildings != null)
    'buildings': [for (final b in document.buildings!) _buildingTo(b)],
  'levels': [for (final level in document.levels) _levelTo(level)],
  if (document.connectors != null) 'connectors': document.connectors,
  ...document.rest,
};

const Set<String> _documentKeys = {
  'spec',
  'units',
  'catalog',
  'site',
  'buildings',
  'levels',
  'connectors',
};

Site _siteFrom(Object? json) {
  final map = _object(json, 'site');
  return Site(
    boundary: _polygon(map['boundary'], 'site.boundary'),
    rest: _restOf(map, const {'boundary'}),
  );
}

Building _buildingFrom(Object? json) {
  final map = _object(json, 'a building');
  return Building(
    id: _string(map['id'], 'building id'),
    name: _string(map['name'], 'building name'),
    type: _string(map['type'], 'building type'),
    footprint: map['footprint'] == null
        ? null
        : _polygon(map['footprint'], 'building footprint'),
    rest: _restOf(map, const {'id', 'name', 'type', 'footprint'}),
  );
}

Map<String, Object?> _buildingTo(Building building) => {
  'id': building.id,
  'name': building.name,
  'type': building.type,
  if (building.footprint != null) 'footprint': _points(building.footprint!),
  ...building.rest,
};

const Set<String> _levelKeys = {
  'id',
  'name',
  'shortName',
  'spokenName',
  'building',
  'outdoor',
  'ordinal',
  'elevation',
  'height',
  'origin',
  'size',
  'floor',
  'walls',
  'openings',
  'units',
};

Level _levelFrom(Object? json) {
  final map = _object(json, 'a level');
  final floor = map['floor'];
  final walls = map['walls'];
  final openings = map['openings'];
  final units = map['units'];
  return Level(
    id: _string(map['id'], 'level id'),
    name: _string(map['name'], 'level name'),
    shortName: _string(map['shortName'], 'level shortName'),
    spokenName: _optionalString(map['spokenName'], 'level spokenName'),
    building: _optionalString(map['building'], 'level building'),
    outdoor: _optionalBool(map['outdoor'], 'level outdoor'),
    ordinal: _int(map['ordinal'], 'level ordinal'),
    elevation: _optionalNum(map['elevation'], 'level elevation'),
    height: _optionalNum(map['height'], 'level height'),
    origin: _point(map['origin'], 'level origin'),
    size: _point(map['size'], 'level size'),
    floorFinish: floor == null
        ? null
        : _optionalString(_object(floor, 'floor')['finish'], 'floor finish'),
    walls: walls == null
        ? null
        : [for (final w in _list(walls, 'walls')) _wallFrom(w)],
    openings: openings == null
        ? null
        : [for (final o in _list(openings, 'openings')) _openingFrom(o)],
    units: units == null
        ? null
        : [for (final u in _list(units, 'units')) _unitFrom(u)],
    rest: _restOf(map, _levelKeys),
  );
}

Map<String, Object?> _levelTo(Level level) => {
  'id': level.id,
  'name': level.name,
  'shortName': level.shortName,
  if (level.spokenName != null) 'spokenName': level.spokenName,
  if (level.building != null) 'building': level.building,
  if (level.outdoor != null) 'outdoor': level.outdoor,
  'ordinal': level.ordinal,
  if (level.elevation != null) 'elevation': level.elevation,
  if (level.height != null) 'height': level.height,
  'origin': level.origin.toJson(),
  'size': level.size.toJson(),
  if (level.floorFinish != null) 'floor': {'finish': level.floorFinish},
  if (level.walls != null) 'walls': [for (final w in level.walls!) _wallTo(w)],
  if (level.openings != null)
    'openings': [for (final o in level.openings!) _openingTo(o)],
  if (level.units != null) 'units': [for (final u in level.units!) _unitTo(u)],
  ...level.rest,
};

Wall _wallFrom(Object? json) {
  final map = _object(json, 'a wall');
  return Wall(
    id: _string(map['id'], 'wall id'),
    a: _point(map['a'], 'wall a'),
    b: _point(map['b'], 'wall b'),
    t: _optionalNum(map['t'], 'wall t'),
    kind: _optionalString(map['kind'], 'wall kind'),
    rest: _restOf(map, const {'id', 'a', 'b', 't', 'kind'}),
  );
}

Map<String, Object?> _wallTo(Wall wall) => {
  'id': wall.id,
  'a': wall.a.toJson(),
  'b': wall.b.toJson(),
  if (wall.t != null) 't': wall.t,
  if (wall.kind != null) 'kind': wall.kind,
  ...wall.rest,
};

Opening _openingFrom(Object? json) {
  final map = _object(json, 'an opening');
  return Opening(
    id: _string(map['id'], 'opening id'),
    wall: _string(map['wall'], 'opening wall'),
    at: _num(map['at'], 'opening at'),
    w: _num(map['w'], 'opening w'),
    kind: _optionalString(map['kind'], 'opening kind'),
    name: _optionalString(map['name'], 'opening name'),
    clearW: _optionalNum(map['clearW'], 'opening clearW'),
    entrance: _optionalBool(map['entrance'], 'opening entrance'),
    rest: _restOf(map, const {
      'id',
      'wall',
      'at',
      'w',
      'kind',
      'name',
      'clearW',
      'entrance',
    }),
  );
}

Map<String, Object?> _openingTo(Opening opening) => {
  'id': opening.id,
  'wall': opening.wall,
  'at': opening.at,
  'w': opening.w,
  if (opening.kind != null) 'kind': opening.kind,
  if (opening.name != null) 'name': opening.name,
  if (opening.clearW != null) 'clearW': opening.clearW,
  if (opening.entrance != null) 'entrance': opening.entrance,
  ...opening.rest,
};

Unit _unitFrom(Object? json) {
  final map = _object(json, 'a unit');
  final doors = map['doors'];
  final floor = map['floor'];
  return Unit(
    id: _string(map['id'], 'unit id'),
    category: _string(map['category'], 'unit category'),
    poly: _polygon(map['poly'], 'unit poly'),
    name: _optionalString(map['name'], 'unit name'),
    walkable: _optionalBool(map['walkable'], 'unit walkable'),
    passThrough: _optionalBool(map['passThrough'], 'unit passThrough'),
    parent: _optionalString(map['parent'], 'unit parent'),
    doors: doors == null
        ? null
        : [for (final d in _list(doors, 'unit doors')) _string(d, 'a door id')],
    floorFinish: floor == null
        ? null
        : _optionalString(_object(floor, 'unit floor')['finish'], 'unit floor'),
    rest: _restOf(map, const {
      'id',
      'category',
      'poly',
      'name',
      'walkable',
      'passThrough',
      'parent',
      'doors',
      'floor',
    }),
  );
}

Map<String, Object?> _unitTo(Unit unit) => {
  'id': unit.id,
  if (unit.name != null) 'name': unit.name,
  'category': unit.category,
  if (unit.walkable != null) 'walkable': unit.walkable,
  if (unit.passThrough != null) 'passThrough': unit.passThrough,
  if (unit.parent != null) 'parent': unit.parent,
  if (unit.doors != null) 'doors': unit.doors,
  'poly': _points(unit.poly),
  if (unit.floorFinish != null) 'floor': {'finish': unit.floorFinish},
  ...unit.rest,
};

// ------------------------------------------------------------------ helpers

List<List<double>> _points(List<Pt> points) => [
  for (final p in points) p.toJson(),
];

Map<String, Object?> _restOf(Map<String, Object?> map, Set<String> typed) => {
  for (final entry in map.entries)
    if (!typed.contains(entry.key)) entry.key: entry.value,
};

Map<String, Object?> _object(Object? value, String what) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $what as an object.');
}

List<Object?> _list(Object? value, String what) {
  if (value is List) return value.cast<Object?>();
  throw FormatException('Expected $what as a list.');
}

String _string(Object? value, String what) {
  if (value is String) return value;
  throw FormatException('Expected $what as text.');
}

String? _optionalString(Object? value, String what) =>
    value == null ? null : _string(value, what);

bool? _optionalBool(Object? value, String what) {
  if (value == null) return null;
  if (value is bool) return value;
  throw FormatException('Expected $what as true or false.');
}

double _num(Object? value, String what) {
  if (value is num) return value.toDouble();
  throw FormatException('Expected $what as a number.');
}

double? _optionalNum(Object? value, String what) =>
    value == null ? null : _num(value, what);

int _int(Object? value, String what) {
  if (value is int) return value;
  if (value is num && value == value.roundToDouble()) return value.toInt();
  throw FormatException('Expected $what as a whole number.');
}

Pt _point(Object? value, String what) {
  final list = _list(value, what);
  if (list.length != 2) throw FormatException('Expected $what as [x, z].');
  return Pt(_num(list[0], what), _num(list[1], what));
}

List<Pt> _polygon(Object? value, String what) => [
  for (final entry in _list(value, what)) _point(entry, what),
];
