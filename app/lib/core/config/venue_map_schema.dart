// GENERATED FILE: do not edit. Source: functions/src/config/venue-map-schema.json,
// the venue map document's schema file (spec/OA-1.md r1 AC-38). Regenerate with
// `npm run gen:venue-map-schema`; `npm run tools:test` fails while this is stale.

import 'closed_sets.dart';

/// The venue map document's named constants: caps, ranges, defaults and
/// text lengths (spec/OA-1.md r1 AC-30). Each names its source; OA-3
/// changes a cap only from measured seeds.
abstract final class VenueMapConstants {
  /// MIN_LEVELS: office section 4.2 (levels: 1 to 10 entries, at least one
  /// required); spec section 2.1, EC-7
  static const int minLevels = 1;

  /// MAX_LEVELS: office section 4.2 (levels: 1 to 10); office known limits;
  /// spec section 2.1, AC-30. OA-3 sets the mall value (EC-9: Bayview Grand
  /// has 19)
  static const int maxLevels = 10;

  /// MAX_BUILDINGS: spec section 2.1, DC-9 (buildings start at the level
  /// cap), AC-30
  static const int maxBuildings = 10;

  /// MAX_CONNECTORS: office section 4.2 (connectors: 0 to 40); spec section
  /// 2.1, AC-30
  static const int maxConnectors = 40;

  /// MAX_WALLS_PER_LEVEL: office section 4.2 (walls: at most 2000); spec
  /// section 2.5.1, AC-30
  static const int maxWallsPerLevel = 2000;

  /// MAX_OPENINGS_PER_LEVEL: office section 4.2 (openings: at most 2000);
  /// spec sections 2.5.2 and 2.5.3 (a unit's doors), AC-30
  static const int maxOpeningsPerLevel = 2000;

  /// MAX_UNITS_PER_LEVEL: office section 4.2 (rooms: at most 300); spec
  /// section 2.5.3, AC-30
  static const int maxUnitsPerLevel = 300;

  /// MAX_ITEMS_PER_LEVEL: office section 4.2 (items: at most 5000); spec
  /// section 2.5.4, AC-30
  static const int maxItemsPerLevel = 5000;

  /// MAX_CORRECTIONS_PER_LEVEL: spec section 2.5.5, DC-9 (corrections start
  /// at the wall cap), AC-30
  static const int maxCorrectionsPerLevel = 2000;

  /// MAX_POINTS_PER_LEVEL: spec section 2.5.6, DC-9 (amenities, transit
  /// points and anchors start at the item cap, each list counted on its
  /// own), AC-30
  static const int maxPointsPerLevel = 5000;

  /// MAX_POLY_POINTS: office section 4.2 (a room's poly: 3 to 64 points);
  /// spec section 2, DC-9 (polygons and lines), AC-30, EC-11
  static const int maxPolyPoints = 64;

  /// MAX_MAP_BYTES: office section 4.3 (reject a document over 4 MB); spec
  /// AC-32, DC-21 (4 x 1,048,576 UTF-8 bytes of the JSON text, below
  /// MAX_JSON_BODY's 5 MB)
  static const int maxMapBytes = 4194304;

  /// MAX_PROBLEMS: office section 4.3 (collect up to 20 problems); spec
  /// AC-26
  static const int maxProblems = 20;

  /// VENUE_EXTENT_MIN_M: office section 3 (no negative space); spec section
  /// 2 (every coordinate lies in [0, VENUE_EXTENT_MAX_M]), AC-6
  static const double venueExtentMinM = 0;

  /// VENUE_EXTENT_MAX_M: office section 4.2 (a level's size: each 2 to
  /// 300); spec section 2, DC-8, AC-6, AC-30. OA-3 sets the mall value
  /// (EC-9: Aurora's site is 510 x 720 m)
  static const double venueExtentMaxM = 300;

  /// LEVEL_SIZE_MIN_M: office section 4.2 (a level's size: each 2 to 300);
  /// spec section 2.4
  static const double levelSizeMinM = 2;

  /// ELEVATION_MIN_M: office section 4.2 (elevation: -20 to 300); spec
  /// section 2.4, DC-8
  static const double elevationMinM = -20;

  /// ELEVATION_MAX_M: office section 4.2 (elevation: -20 to 300); spec
  /// section 2.4, DC-8
  static const double elevationMaxM = 300;

  /// ELEVATION_DEFAULT_M: office section 4.2 (elevation: default 0); spec
  /// section 2.4
  static const double elevationDefaultM = 0;

  /// LEVEL_HEIGHT_MIN_M: office section 4.2 (height: 2 to 10); spec section
  /// 2.4
  static const double levelHeightMinM = 2;

  /// LEVEL_HEIGHT_MAX_M: office section 4.2 (height: 2 to 10); spec section
  /// 2.4
  static const double levelHeightMaxM = 10;

  /// LEVEL_HEIGHT_DEFAULT_M: office section 4.2 (height: default 3); spec
  /// section 2.4
  static const double levelHeightDefaultM = 3;

  /// ANGLE_DEFAULT_DEG: office section 3 (rot 0 faces up the plan); spec
  /// section 2.2 (mapUp default 0), sections 2.5.4, 2.5.9 and 2.6 (rot
  /// default 0)
  static const double angleDefaultDeg = 0;

  /// CATALOG_VERSION_MIN: office section 4.2 (catalog: integer 1 to the
  /// current version); spec section 2.1 (catalog: integer at least 1;
  /// section 10 Q2 ruled (b))
  static const int catalogVersionMin = 1;

  /// POLY_MIN_POINTS: office section 4.2 (a room's poly: 3 to 64 points);
  /// spec section 2.2, AC-8, DC-16
  static const int polyMinPoints = 3;

  /// POLY_MIN_AREA_M2: office section 4.2 (area at least 0.1 square
  /// metres); spec sections 2.2 and 2.5.3, AC-8, DC-16
  static const double polyMinAreaM2 = 0.1;

  /// LINE_MIN_POINTS: spec section 2.5.5 (a correction's line: 2 to
  /// MAX_POLY_POINTS points)
  static const int lineMinPoints = 2;

  /// LINE_MIN_LENGTH_M: spec section 2.5.5 (a correction's line: total
  /// length at least 0.05)
  static const double lineMinLengthM = 0.05;

  /// WALL_MIN_LENGTH_M: office section 4.2 (a wall shorter than 5 cm is
  /// rejected); spec section 2.5.1, AC-8
  static const double wallMinLengthM = 0.05;

  /// WALL_THICKNESS_MIN_M: office section 4.2 (t: 0.05 to 1); spec section
  /// 2.5.1
  static const double wallThicknessMinM = 0.05;

  /// WALL_THICKNESS_MAX_M: office section 4.2 (t: 0.05 to 1); spec section
  /// 2.5.1
  static const double wallThicknessMaxM = 1;

  /// WALL_THICKNESS_DEFAULT_M: office section 4.2 (t: default 0.15); spec
  /// section 2.5.1
  static const double wallThicknessDefaultM = 0.15;

  /// OPENING_AT_MIN: office section 4.2 (at: 0 to 1 along the wall); spec
  /// section 2.5.2
  static const double openingAtMin = 0;

  /// OPENING_AT_MAX: office section 4.2 (at: 0 to 1 along the wall); spec
  /// section 2.5.2
  static const double openingAtMax = 1;

  /// OPENING_WIDTH_MIN_M: office section 4.2 (w: 0.4 to 6); spec section
  /// 2.5.2
  static const double openingWidthMinM = 0.4;

  /// OPENING_WIDTH_MAX_M: office section 4.2 (w: 0.4 to 6); spec section
  /// 2.5.2
  static const double openingWidthMaxM = 6;

  /// SIZE_MIN_EXCLUSIVE_M: spec section 2.5.2 (clearW above 0), section
  /// 2.5.4 (G13: a size above 0), section 2.6 and DC-7 (a ramp's w and len
  /// above 0)
  static const double sizeMinExclusiveM = 0;

  /// CONNECTOR_MIN_LEVELS: office section 4.2 (levels names at least 2
  /// distinct levels); spec section 2.6
  static const int connectorMinLevels = 2;

  /// ESCALATOR_LEVELS: office section 4.2 (escalator: exactly two levels);
  /// spec section 2.6, AC-7
  static const int escalatorLevels = 2;

  /// STAIRS_WIDTH_MIN_M: office section 4.2 (stairs: w 0.8 to 4); spec
  /// section 2.6
  static const double stairsWidthMinM = 0.8;

  /// STAIRS_WIDTH_MAX_M: office section 4.2 (stairs: w 0.8 to 4); spec
  /// section 2.6
  static const double stairsWidthMaxM = 4;

  /// STAIRS_WIDTH_DEFAULT_M: office section 4.2 (stairs: w default 1.2);
  /// spec section 2.6
  static const double stairsWidthDefaultM = 1.2;

  /// STAIRS_LENGTH_MIN_M: office section 4.2 (stairs: len 1 to 20); spec
  /// section 2.6
  static const double stairsLengthMinM = 1;

  /// STAIRS_LENGTH_MAX_M: office section 4.2 (stairs: len 1 to 20); spec
  /// section 2.6
  static const double stairsLengthMaxM = 20;

  /// STAIRS_LENGTH_DEFAULT_M: office section 4.2 (stairs: len default 4);
  /// spec section 2.6
  static const double stairsLengthDefaultM = 4;

  /// ESCALATOR_WIDTH_MIN_M: office section 4.2 (escalator: w 0.8 to 2);
  /// spec section 2.6
  static const double escalatorWidthMinM = 0.8;

  /// ESCALATOR_WIDTH_MAX_M: office section 4.2 (escalator: w 0.8 to 2);
  /// spec section 2.6
  static const double escalatorWidthMaxM = 2;

  /// ESCALATOR_WIDTH_DEFAULT_M: office section 4.2 (escalator: w default
  /// 1); spec section 2.6
  static const double escalatorWidthDefaultM = 1;

  /// ESCALATOR_LENGTH_MIN_M: office section 4.2 (escalator: len 1 to 20);
  /// spec section 2.6
  static const double escalatorLengthMinM = 1;

  /// ESCALATOR_LENGTH_MAX_M: office section 4.2 (escalator: len 1 to 20);
  /// spec section 2.6
  static const double escalatorLengthMaxM = 20;

  /// ESCALATOR_LENGTH_DEFAULT_M: office section 4.2 (escalator: len default
  /// 7.5); spec section 2.6
  static const double escalatorLengthDefaultM = 7.5;

  /// ELEVATOR_WIDTH_MIN_M: office section 4.2 (elevator: w and d 1 to 4);
  /// spec section 2.6
  static const double elevatorWidthMinM = 1;

  /// ELEVATOR_WIDTH_MAX_M: office section 4.2 (elevator: w and d 1 to 4);
  /// spec section 2.6
  static const double elevatorWidthMaxM = 4;

  /// ELEVATOR_WIDTH_DEFAULT_M: office section 4.2 (elevator: w and d
  /// default 2); spec section 2.6
  static const double elevatorWidthDefaultM = 2;

  /// ELEVATOR_DEPTH_MIN_M: office section 4.2 (elevator: w and d 1 to 4);
  /// spec section 2.6
  static const double elevatorDepthMinM = 1;

  /// ELEVATOR_DEPTH_MAX_M: office section 4.2 (elevator: w and d 1 to 4);
  /// spec section 2.6
  static const double elevatorDepthMaxM = 4;

  /// ELEVATOR_DEPTH_DEFAULT_M: office section 4.2 (elevator: w and d
  /// default 2); spec section 2.6
  static const double elevatorDepthDefaultM = 2;

  /// ELEVATOR_CARS_MIN: office section 4.2 (elevator: cars 1 to 4); spec
  /// section 2.6
  static const int elevatorCarsMin = 1;

  /// ELEVATOR_CARS_MAX: office section 4.2 (elevator: cars 1 to 4); spec
  /// section 2.6
  static const int elevatorCarsMax = 4;

  /// ELEVATOR_CARS_DEFAULT: spec section 2.6 (cars: default 1)
  static const int elevatorCarsDefault = 1;

  /// BACKDROP_MPP_MIN: office section 4.2 (mpp: 0.0001 to 1, 7 decimals);
  /// spec section 2.5.9
  static const double backdropMppMin = 0.0001;

  /// BACKDROP_MPP_MAX: office section 4.2 (mpp: 0.0001 to 1, 7 decimals);
  /// spec section 2.5.9
  static const double backdropMppMax = 1;

  /// BACKDROP_OPACITY_MIN: office section 4.2 (opacity: 0.05 to 1); spec
  /// section 2.5.9
  static const double backdropOpacityMin = 0.05;

  /// BACKDROP_OPACITY_MAX: office section 4.2 (opacity: 0.05 to 1); spec
  /// section 2.5.9
  static const double backdropOpacityMax = 1;

  /// BACKDROP_OPACITY_DEFAULT: office section 4.2 (opacity: default 0.5);
  /// spec section 2.5.9
  static const double backdropOpacityDefault = 0.5;

  /// BACKDROP_KEY_CHARS: office section 4.2 (a backdrop's id is a 32-hex
  /// upload key); spec section 2.5.9
  static const int backdropKeyChars = 32;

  /// LATITUDE_MIN_DEG: WGS84 latitude; spec section 2.2, AC-13a (lat -90 to
  /// 90)
  static const double latitudeMinDeg = -90;

  /// LATITUDE_MAX_DEG: WGS84 latitude; spec section 2.2, AC-13a (lat -90 to
  /// 90)
  static const double latitudeMaxDeg = 90;

  /// LONGITUDE_MIN_DEG: WGS84 longitude; spec section 2.2, AC-13a (lon -180
  /// to 180)
  static const double longitudeMinDeg = -180;

  /// LONGITUDE_MAX_DEG: WGS84 longitude; spec section 2.2, AC-13a (lon -180
  /// to 180)
  static const double longitudeMaxDeg = 180;

  /// NAME_MAX_CHARS: spec section 2, DC-12 (the 0.14 name columns:
  /// Building, Unit, Opening, Amenity, TransitPoint, Anchor and
  /// NavConnector Name and NavConnector.SpokenName VARCHAR(200)); AC-47
  /// (Occupant.Name, Occupant.SpokenName and Venue.Name VARCHAR(200))
  static const int nameMaxChars = 200;

  /// NOTE_MAX_CHARS: spec sections 2.5.5 and 2.5.7, DC-12
  /// (NavCorrection.Note and TransitPoint.Note VARCHAR(200))
  static const int noteMaxChars = 200;

  /// LEVEL_NAME_MAX_CHARS: spec section 2.4, DC-12 (Level.Name and
  /// Level.SpokenName VARCHAR(100))
  static const int levelNameMaxChars = 100;

  /// LEVEL_SHORT_NAME_MAX_CHARS: spec section 2.4, DC-12 (Level.ShortName
  /// VARCHAR(10))
  static const int levelShortNameMaxChars = 10;

  /// ITEM_LABEL_MAX_CHARS: office section 4.2 (an item's label: at most
  /// 40); spec section 2.5.4
  static const int itemLabelMaxChars = 40;

  /// STORE_KEYWORDS_MAX_CHARS: spec AC-47 (Occupant.SearchKeywords
  /// VARCHAR(400))
  static const int storeKeywordsMaxChars = 400;

  /// VENUE_CODE_MAX_CHARS: spec AC-47 (the export's fromVenue.code;
  /// Venue.Code VARCHAR(40))
  static const int venueCodeMaxChars = 40;

  /// EXPORTED_AT_CHARS: spec AC-47 (exportedAt an ISO-8601 UTC timestamp);
  /// plan DC-O18 (YYYY-MM-DDTHH:MM:SS.sssZ is 24 characters)
  static const int exportedAtChars = 24;

  /// LEVEL_ORDINAL_MIN: spec section 2.4 (ordinal: an integer in
  /// -MAX_LEVELS to MAX_LEVELS)
  static const int levelOrdinalMin = -10;

  /// BACKDROP_CENTRE_MIN_M: office section 4.2 (backdrop cx, cz: -600 to
  /// 900, against its 300 m cap); spec section 2.5.9 (-2 x
  /// VENUE_EXTENT_MAX_M)
  static const double backdropCentreMinM = -600;

  /// BACKDROP_CENTRE_MAX_M: office section 4.2 (backdrop cx, cz: -600 to
  /// 900, against its 300 m cap); spec section 2.5.9 (3 x
  /// VENUE_EXTENT_MAX_M)
  static const double backdropCentreMaxM = 900;
}

/// The venue map document's patterns, as regular-expression source text.
abstract final class VenueMapPatterns {
  /// ID: office section 3 (ids); spec section 2, AC-10
  static const String id = r'^[A-Za-z0-9_-]{1,40}$';

  /// BACKDROP_KEY: office section 4.2 (a 32-hex upload key); spec section
  /// 2.5.9 (32 lowercase hexadecimal characters)
  static const String backdropKey = r'^[0-9a-f]{32}$';

  /// EXPORTED_AT: spec AC-47 (an ISO-8601 UTC timestamp); plan DC-O18
  /// (checked by pattern only, no clock: AC-23)
  static const String exportedAt = r'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$';

  /// ELEMENT_KEY: spec AC-41 (relational rows key a map element by its id:
  /// VARCHAR(40), the id pattern)
  static const String elementKey = id;
}

/// The decimals each number kind is rounded to, half away from zero
/// (AC-13), and the turn an angle is normalised to (AC-15).
abstract final class VenueMapNumberKinds {
  /// Decimals per number kind.
  static const Map<String, int> decimals = {
    'metres': 3,
    'degrees': 3,
    'ratio': 3,
    'mpp': 7,
    'latLon': 7,
  };

  /// The turn, in degrees, per angle kind: a value is normalised to [0, turn).
  static const Map<String, int> turnDeg = {
    'degrees': 360,
  };
}

/// One rule's values for one discriminator value (a connector's ranges per kind).
final class VenueMapPerKind {
  const VenueMapPerKind({
    this.min,
    this.max,
    this.minExclusive,
    this.defaultValue,
    this.required = false,
    this.minItems,
    this.maxItems,
  });

  final num? min;
  final num? max;
  final num? minExclusive;
  final Object? defaultValue;
  final bool required;
  final int? minItems;
  final int? maxItems;
}

/// What the schema file says about one field of an element kind: its type kind, whether it is required (the lint's
/// nullability), its maximum length and its decimals (the lint's scale), and the rest of its rule.
final class VenueMapField {
  const VenueMapField(
    this.name, {
    required this.type,
    this.required = false,
    this.nullable = false,
    this.hasDefault = false,
    this.defaultValue,
    this.decimals,
    this.numberKind,
    this.maxLength,
    this.pattern,
    this.min,
    this.max,
    this.minExclusive,
    this.minItems,
    this.maxItems,
    this.minArea,
    this.minLength,
    this.lookup,
    this.closedSet,
    this.of,
    this.items,
    this.refKind,
    this.sameLevel = false,
    this.unique = false,
    this.refWhere,
    this.appliesTo,
    this.perKind,
    this.within,
    this.axis,
    this.equals,
    this.fromContext,
    this.defaultFromSubset,
    this.defaultFromField,
    this.costModelOf,
    this.catalogSize,
    this.alwaysWrite = false,
    this.draftOnly = false,
    this.note,
  });

  /// The field's name in the document.
  final String name;

  /// The type kind: text, integer, metres, degrees, number, flag, code, closedSet, id, idRef, idRefs, point,
  /// polygon, line, object or array.
  final String type;
  final bool required;
  final bool nullable;
  final bool hasDefault;
  final Object? defaultValue;

  /// The scale of a number: 3, or 7 for mpp, lat and lon.
  final int? decimals;
  final String? numberKind;

  /// The longest text, in Unicode code points.
  final int? maxLength;
  final String? pattern;
  final num? min;
  final num? max;
  final num? minExclusive;
  final int? minItems;
  final int? maxItems;
  final num? minArea;
  final num? minLength;

  /// The lookup table a code resolves in (the rows are served, never copied).
  final String? lookup;

  /// The closed set a key comes from (its closed_sets.dart enum values).
  final List<Enum>? closedSet;
  final String? of;
  final VenueMapField? items;
  final String? refKind;
  final bool sameLevel;
  final bool unique;
  final Map<String, Object>? refWhere;

  /// The discriminator values the field applies to; set on another, it is a problem.
  final List<Object>? appliesTo;
  final Map<Object, VenueMapPerKind>? perKind;
  final String? within;
  final String? axis;
  final Object? equals;
  final String? fromContext;
  final Set<Enum>? defaultFromSubset;
  final String? defaultFromField;
  final Map<Enum, Enum>? costModelOf;
  final String? catalogSize;
  final bool alwaysWrite;
  final bool draftOnly;
  final String? note;
}

/// One element kind of the venue map document: its fields in the schema file's order.
final class VenueMapKind {
  const VenueMapKind(this.name, {this.discriminator, required this.fields});

  final String name;
  final String? discriminator;
  final List<VenueMapField> fields;
}

/// The venue map document, spec 1: one rule table per element kind, in the
/// schema file's order (spec/OA-1.md r1 section 2), and the export file
/// (AC-47).
abstract final class VenueMapSchema {
  /// The document's spec version.
  static const int spec = 1;

  /// The document's units.
  static const String units = 'm';

  static const VenueMapKind document = VenueMapKind(
    'document',
    fields: [
      VenueMapField(
        'spec',
        type: 'integer',
        required: true,
        equals: 1,
        note: 'spec section 2.1: must be 1; another value is spec section 3.8\'s (readMap, AC-36)',
      ),
      VenueMapField(
        'units',
        type: 'text',
        hasDefault: true,
        maxLength: 1,
        equals: 'm',
        alwaysWrite: true,
        note: 'spec section 2.1: absent or m; written as m',
      ),
      VenueMapField(
        'catalog',
        type: 'integer',
        hasDefault: true,
        min: VenueMapConstants.catalogVersionMin,
        fromContext: 'catalogVersion',
        alwaysWrite: true,
        note: 'spec section 2.1 (section 10 Q2 ruled (b)): at most the context\'s catalog version; absent means the context\'s catalog version',
      ),
      VenueMapField(
        'site',
        type: 'object',
        required: true,
        of: 'site',
      ),
      VenueMapField(
        'buildings',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxBuildings,
        of: 'building',
      ),
      VenueMapField(
        'levels',
        type: 'array',
        required: true,
        minItems: VenueMapConstants.minLevels,
        maxItems: VenueMapConstants.maxLevels,
        of: 'level',
      ),
      VenueMapField(
        'connectors',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxConnectors,
        of: 'connector',
      ),
    ],
  );

  static const VenueMapKind site = VenueMapKind(
    'site',
    fields: [
      VenueMapField(
        'boundary',
        type: 'polygon',
        required: true,
        minItems: VenueMapConstants.polyMinPoints,
        maxItems: VenueMapConstants.maxPolyPoints,
        minArea: VenueMapConstants.polyMinAreaM2,
        within: 'venue',
      ),
      VenueMapField(
        'georeference',
        type: 'object',
        nullable: true,
        hasDefault: true,
        of: 'georeference',
        alwaysWrite: true,
        note: 'spec section 2.2, AC-13a: null, or { origin: { lat, lon }, bearingDeg }; EC-4b: kept as null',
      ),
      VenueMapField(
        'mapUp',
        type: 'degrees',
        hasDefault: true,
        defaultValue: VenueMapConstants.angleDefaultDeg,
        decimals: 3,
        numberKind: 'degrees',
      ),
    ],
  );

  static const VenueMapKind georeference = VenueMapKind(
    'georeference',
    fields: [
      VenueMapField(
        'origin',
        type: 'object',
        required: true,
        of: 'geoOrigin',
      ),
      VenueMapField(
        'bearingDeg',
        type: 'degrees',
        required: true,
        decimals: 3,
        numberKind: 'degrees',
      ),
    ],
  );

  static const VenueMapKind geoOrigin = VenueMapKind(
    'geoOrigin',
    fields: [
      VenueMapField(
        'lat',
        type: 'number',
        required: true,
        decimals: 7,
        numberKind: 'latLon',
        min: VenueMapConstants.latitudeMinDeg,
        max: VenueMapConstants.latitudeMaxDeg,
      ),
      VenueMapField(
        'lon',
        type: 'number',
        required: true,
        decimals: 7,
        numberKind: 'latLon',
        min: VenueMapConstants.longitudeMinDeg,
        max: VenueMapConstants.longitudeMaxDeg,
      ),
    ],
  );

  static const VenueMapKind building = VenueMapKind(
    'building',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'type',
        type: 'code',
        required: true,
        lookup: 'BuildingType',
      ),
      VenueMapField(
        'footprint',
        type: 'polygon',
        minItems: VenueMapConstants.polyMinPoints,
        maxItems: VenueMapConstants.maxPolyPoints,
        minArea: VenueMapConstants.polyMinAreaM2,
        within: 'venue',
      ),
      VenueMapField(
        'mapUp',
        type: 'degrees',
        decimals: 3,
        numberKind: 'degrees',
        note: 'spec section 2.3: absent means the site\'s mapUp',
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind level = VenueMapKind(
    'level',
    discriminator: 'outdoor',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.levelNameMaxChars,
      ),
      VenueMapField(
        'shortName',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.levelShortNameMaxChars,
      ),
      VenueMapField(
        'spokenName',
        type: 'text',
        maxLength: VenueMapConstants.levelNameMaxChars,
      ),
      VenueMapField(
        'building',
        type: 'idRef',
        required: true,
        refKind: 'building',
        appliesTo: [false],
        note: 'spec section 2.4, AC-5 (B7): required on an indoor level, refused on the outdoor level',
      ),
      VenueMapField(
        'outdoor',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
        note: 'spec section 2.4, AC-5 (B7): at most one outdoor level; its ordinal is 0',
      ),
      VenueMapField(
        'ordinal',
        type: 'integer',
        required: true,
        min: VenueMapConstants.levelOrdinalMin,
        max: VenueMapConstants.maxLevels,
        note: 'spec section 2.4, AC-5 (B7): distinct among the levels of one building',
      ),
      VenueMapField(
        'elevation',
        type: 'metres',
        hasDefault: true,
        defaultValue: VenueMapConstants.elevationDefaultM,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.elevationMinM,
        max: VenueMapConstants.elevationMaxM,
      ),
      VenueMapField(
        'height',
        type: 'metres',
        hasDefault: true,
        defaultValue: VenueMapConstants.levelHeightDefaultM,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.levelHeightMinM,
        max: VenueMapConstants.levelHeightMaxM,
      ),
      VenueMapField(
        'origin',
        type: 'point',
        required: true,
        within: 'venue',
        note: 'spec section 2.4, AC-6: with size, the rectangle lies inside [VENUE_EXTENT_MIN_M, VENUE_EXTENT_MAX_M]',
      ),
      VenueMapField(
        'size',
        type: 'point',
        required: true,
        min: VenueMapConstants.levelSizeMinM,
        max: VenueMapConstants.venueExtentMaxM,
        note: 'spec section 2.4: [w, d], each coordinate in the range',
      ),
      VenueMapField(
        'floor',
        type: 'object',
        hasDefault: true,
        defaultValue: <String, Object>{'finish': FloorFinish.defaultValue},
        of: 'floor',
      ),
      VenueMapField(
        'walls',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxWallsPerLevel,
        of: 'wall',
      ),
      VenueMapField(
        'openings',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxOpeningsPerLevel,
        of: 'opening',
      ),
      VenueMapField(
        'units',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxUnitsPerLevel,
        of: 'unit',
      ),
      VenueMapField(
        'items',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxItemsPerLevel,
        of: 'item',
      ),
      VenueMapField(
        'corrections',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxCorrectionsPerLevel,
        of: 'correction',
      ),
      VenueMapField(
        'amenities',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxPointsPerLevel,
        of: 'amenity',
      ),
      VenueMapField(
        'transitPoints',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxPointsPerLevel,
        of: 'transitPoint',
      ),
      VenueMapField(
        'anchors',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxPointsPerLevel,
        of: 'anchor',
      ),
      VenueMapField(
        'backdrop',
        type: 'object',
        of: 'backdrop',
        draftOnly: true,
      ),
    ],
  );

  static const VenueMapKind floor = VenueMapKind(
    'floor',
    fields: [
      VenueMapField(
        'finish',
        type: 'closedSet',
        required: true,
        closedSet: FloorFinish.values,
      ),
    ],
  );

  static const VenueMapKind wall = VenueMapKind(
    'wall',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'a',
        type: 'point',
        required: true,
        within: 'level',
      ),
      VenueMapField(
        'b',
        type: 'point',
        required: true,
        within: 'level',
        note: 'spec section 2.5.1, AC-8: the wall from a to b is at least WALL_MIN_LENGTH_M long',
      ),
      VenueMapField(
        't',
        type: 'metres',
        hasDefault: true,
        defaultValue: VenueMapConstants.wallThicknessDefaultM,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.wallThicknessMinM,
        max: VenueMapConstants.wallThicknessMaxM,
      ),
      VenueMapField(
        'kind',
        type: 'closedSet',
        hasDefault: true,
        defaultValue: WallKind.solid,
        closedSet: WallKind.values,
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind opening = VenueMapKind(
    'opening',
    discriminator: 'kind',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'wall',
        type: 'idRef',
        required: true,
        refKind: 'wall',
        sameLevel: true,
      ),
      VenueMapField(
        'at',
        type: 'number',
        required: true,
        decimals: 3,
        numberKind: 'ratio',
        min: VenueMapConstants.openingAtMin,
        max: VenueMapConstants.openingAtMax,
      ),
      VenueMapField(
        'w',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.openingWidthMinM,
        max: VenueMapConstants.openingWidthMaxM,
        note: 'spec section 2.5.2, AC-8: no longer than its wall (EC-31: its span may run past the wall\'s end)',
      ),
      VenueMapField(
        'kind',
        type: 'closedSet',
        hasDefault: true,
        defaultValue: OpeningKind.door,
        closedSet: OpeningKind.values,
      ),
      VenueMapField(
        'name',
        type: 'text',
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'clearW',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        minExclusive: VenueMapConstants.sizeMinExclusiveM,
        note: 'spec section 2.5.2, AC-8: no more than w; absent means not measured',
      ),
      VenueMapField(
        'entrance',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
        appliesTo: [OpeningKind.door],
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind unit = VenueMapKind(
    'unit',
    discriminator: 'walkable',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'name',
        type: 'text',
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'category',
        type: 'closedSet',
        required: true,
        closedSet: ImdfUnitCategory.values,
      ),
      VenueMapField(
        'walkable',
        type: 'flag',
        hasDefault: true,
        defaultFromSubset: walkableUnitCategory,
        defaultFromField: 'category',
        alwaysWrite: true,
        note: 'spec section 2.5.3, AC-9: when absent, true exactly when the category is in WalkableUnitCategory (P0-11 DC-8); always written',
      ),
      VenueMapField(
        'passThrough',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
        appliesTo: [false],
      ),
      VenueMapField(
        'parent',
        type: 'idRef',
        refKind: 'unit',
        sameLevel: true,
        note: 'spec section 2.5.3, AC-4: no unit is its own ancestor',
      ),
      VenueMapField(
        'doors',
        type: 'idRefs',
        hasDefault: true,
        defaultValue: <Object>[],
        maxItems: VenueMapConstants.maxOpeningsPerLevel,
        refKind: 'opening',
        sameLevel: true,
        unique: true,
        refWhere: {'kind': OpeningKind.door},
      ),
      VenueMapField(
        'poly',
        type: 'polygon',
        required: true,
        minItems: VenueMapConstants.polyMinPoints,
        maxItems: VenueMapConstants.maxPolyPoints,
        minArea: VenueMapConstants.polyMinAreaM2,
        within: 'level',
      ),
      VenueMapField(
        'floor',
        type: 'object',
        of: 'floor',
        note: 'spec section 2.5.3: overrides the level\'s floor; absent means the level\'s',
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind item = VenueMapKind(
    'item',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'type',
        type: 'code',
        required: true,
        lookup: 'ObjectType',
      ),
      VenueMapField(
        'x',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        within: 'level',
        axis: 'x',
      ),
      VenueMapField(
        'z',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        within: 'level',
        axis: 'z',
      ),
      VenueMapField(
        'rot',
        type: 'degrees',
        hasDefault: true,
        defaultValue: VenueMapConstants.angleDefaultDeg,
        decimals: 3,
        numberKind: 'degrees',
      ),
      VenueMapField(
        'w',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        catalogSize: 'w',
        note: 'spec section 2.5.4, AC-8: only inside the type\'s resize range for w; required (above SIZE_MIN_EXCLUSIVE_M, at most the level\'s larger side) when the type has no default w (G13); absent means the type\'s default',
      ),
      VenueMapField(
        'd',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        catalogSize: 'd',
        note: 'spec section 2.5.4, AC-8: as w; never sent for a round type (d follows w)',
      ),
      VenueMapField(
        'h',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        catalogSize: 'h',
        note: 'spec section 2.5.4, AC-8: as w',
      ),
      VenueMapField(
        'finish',
        type: 'closedSet',
        hasDefault: true,
        defaultValue: ItemFinish.defaultValue,
        closedSet: ItemFinish.values,
      ),
      VenueMapField(
        'label',
        type: 'text',
        maxLength: VenueMapConstants.itemLabelMaxChars,
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind correction = VenueMapKind(
    'correction',
    discriminator: 'kind',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'kind',
        type: 'closedSet',
        required: true,
        closedSet: NavCorrectionKind.values,
      ),
      VenueMapField(
        'poly',
        type: 'polygon',
        required: true,
        minItems: VenueMapConstants.polyMinPoints,
        maxItems: VenueMapConstants.maxPolyPoints,
        minArea: VenueMapConstants.polyMinAreaM2,
        appliesTo: [NavCorrectionKind.blockArea],
        within: 'level',
      ),
      VenueMapField(
        'line',
        type: 'line',
        required: true,
        minItems: VenueMapConstants.lineMinPoints,
        maxItems: VenueMapConstants.maxPolyPoints,
        minLength: VenueMapConstants.lineMinLengthM,
        appliesTo: [NavCorrectionKind.addPath, NavCorrectionKind.removePath],
        within: 'level',
      ),
      VenueMapField(
        'note',
        type: 'text',
        maxLength: VenueMapConstants.noteMaxChars,
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind amenity = VenueMapKind(
    'amenity',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'type',
        type: 'code',
        required: true,
        lookup: 'AmenityType',
      ),
      VenueMapField(
        'name',
        type: 'text',
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'at',
        type: 'point',
        required: true,
        within: 'level',
      ),
      VenueMapField(
        'unit',
        type: 'idRef',
        refKind: 'unit',
        sameLevel: true,
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind transitPoint = VenueMapKind(
    'transitPoint',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'type',
        type: 'code',
        required: true,
        lookup: 'TransitType',
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'note',
        type: 'text',
        maxLength: VenueMapConstants.noteMaxChars,
      ),
      VenueMapField(
        'at',
        type: 'point',
        required: true,
        within: 'level',
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind anchor = VenueMapKind(
    'anchor',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'at',
        type: 'point',
        required: true,
        within: 'level',
      ),
      VenueMapField(
        'unit',
        type: 'idRef',
        refKind: 'unit',
        sameLevel: true,
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind backdrop = VenueMapKind(
    'backdrop',
    fields: [
      VenueMapField(
        'id',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.backdropKeyChars,
        pattern: VenueMapPatterns.backdropKey,
        note: 'spec section 2.5.9: the upload key, not an element id; that the file exists is OA-2\'s check',
      ),
      VenueMapField(
        'cx',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.backdropCentreMinM,
        max: VenueMapConstants.backdropCentreMaxM,
      ),
      VenueMapField(
        'cz',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.backdropCentreMinM,
        max: VenueMapConstants.backdropCentreMaxM,
      ),
      VenueMapField(
        'mpp',
        type: 'number',
        required: true,
        decimals: 7,
        numberKind: 'mpp',
        min: VenueMapConstants.backdropMppMin,
        max: VenueMapConstants.backdropMppMax,
      ),
      VenueMapField(
        'rot',
        type: 'degrees',
        hasDefault: true,
        defaultValue: VenueMapConstants.angleDefaultDeg,
        decimals: 3,
        numberKind: 'degrees',
      ),
      VenueMapField(
        'opacity',
        type: 'number',
        hasDefault: true,
        defaultValue: VenueMapConstants.backdropOpacityDefault,
        decimals: 3,
        numberKind: 'ratio',
        min: VenueMapConstants.backdropOpacityMin,
        max: VenueMapConstants.backdropOpacityMax,
      ),
      VenueMapField(
        'locked',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  static const VenueMapKind connector = VenueMapKind(
    'connector',
    discriminator: 'kind',
    fields: [
      VenueMapField(
        'id',
        type: 'id',
        required: true,
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'spokenName',
        type: 'text',
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'kind',
        type: 'closedSet',
        required: true,
        closedSet: ConnectorKind.values,
      ),
      VenueMapField(
        'type',
        type: 'code',
        required: true,
        lookup: 'ConnectorType',
        costModelOf: {ConnectorKind.stairs: ConnectorCostModel.stairs, ConnectorKind.escalator: ConnectorCostModel.escalator, ConnectorKind.elevator: ConnectorCostModel.elevator, ConnectorKind.ramp: ConnectorCostModel.ramp},
        note: 'spec section 2.6, AC-7, DC-6: the code\'s CostModel is the one its kind names here',
      ),
      VenueMapField(
        'levels',
        type: 'idRefs',
        required: true,
        minItems: VenueMapConstants.connectorMinLevels,
        maxItems: VenueMapConstants.maxLevels,
        refKind: 'level',
        unique: true,
        perKind: {ConnectorKind.escalator: VenueMapPerKind(minItems: VenueMapConstants.escalatorLevels, maxItems: VenueMapConstants.escalatorLevels)},
        note: 'spec section 2.6, AC-7: an escalator runs levels[0] to levels[1]',
      ),
      VenueMapField(
        'stops',
        type: 'array',
        required: true,
        maxItems: VenueMapConstants.maxLevels,
        items: VenueMapField(
          'stops[]',
          type: 'point',
          within: 'stopLevel',
        ),
        note: 'spec section 2.6, AC-7, DC-5: one point per entry of levels, in the same order, each inside that level',
      ),
      VenueMapField(
        'x',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        within: 'servedLevels',
        axis: 'x',
      ),
      VenueMapField(
        'z',
        type: 'metres',
        required: true,
        decimals: 3,
        numberKind: 'metres',
        within: 'servedLevels',
        axis: 'z',
      ),
      VenueMapField(
        'rot',
        type: 'degrees',
        hasDefault: true,
        defaultValue: VenueMapConstants.angleDefaultDeg,
        decimals: 3,
        numberKind: 'degrees',
      ),
      VenueMapField(
        'w',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        perKind: {ConnectorKind.stairs: VenueMapPerKind(min: VenueMapConstants.stairsWidthMinM, max: VenueMapConstants.stairsWidthMaxM, defaultValue: VenueMapConstants.stairsWidthDefaultM), ConnectorKind.escalator: VenueMapPerKind(min: VenueMapConstants.escalatorWidthMinM, max: VenueMapConstants.escalatorWidthMaxM, defaultValue: VenueMapConstants.escalatorWidthDefaultM), ConnectorKind.elevator: VenueMapPerKind(min: VenueMapConstants.elevatorWidthMinM, max: VenueMapConstants.elevatorWidthMaxM, defaultValue: VenueMapConstants.elevatorWidthDefaultM), ConnectorKind.ramp: VenueMapPerKind(minExclusive: VenueMapConstants.sizeMinExclusiveM, required: true)},
        note: 'spec section 2.6, DC-7: a ramp\'s w is at most the larger side of the smallest level it serves',
      ),
      VenueMapField(
        'len',
        type: 'metres',
        decimals: 3,
        numberKind: 'metres',
        appliesTo: [ConnectorKind.stairs, ConnectorKind.escalator, ConnectorKind.ramp],
        perKind: {ConnectorKind.stairs: VenueMapPerKind(min: VenueMapConstants.stairsLengthMinM, max: VenueMapConstants.stairsLengthMaxM, defaultValue: VenueMapConstants.stairsLengthDefaultM), ConnectorKind.escalator: VenueMapPerKind(min: VenueMapConstants.escalatorLengthMinM, max: VenueMapConstants.escalatorLengthMaxM, defaultValue: VenueMapConstants.escalatorLengthDefaultM), ConnectorKind.ramp: VenueMapPerKind(minExclusive: VenueMapConstants.sizeMinExclusiveM, required: true)},
        note: 'spec section 2.6, DC-7: a ramp\'s len is at most the larger side of the smallest level it serves',
      ),
      VenueMapField(
        'd',
        type: 'metres',
        hasDefault: true,
        defaultValue: VenueMapConstants.elevatorDepthDefaultM,
        decimals: 3,
        numberKind: 'metres',
        min: VenueMapConstants.elevatorDepthMinM,
        max: VenueMapConstants.elevatorDepthMaxM,
        appliesTo: [ConnectorKind.elevator],
      ),
      VenueMapField(
        'cars',
        type: 'integer',
        hasDefault: true,
        defaultValue: VenueMapConstants.elevatorCarsDefault,
        min: VenueMapConstants.elevatorCarsMin,
        max: VenueMapConstants.elevatorCarsMax,
        appliesTo: [ConnectorKind.elevator],
      ),
      VenueMapField(
        'shape',
        type: 'closedSet',
        hasDefault: true,
        defaultValue: ConnectorShape.straight,
        closedSet: ConnectorShape.values,
        appliesTo: [ConnectorKind.stairs, ConnectorKind.ramp],
      ),
      VenueMapField(
        'twoWay',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
        appliesTo: [ConnectorKind.escalator],
        note: 'N6 (a Gabay-only field): true means the escalator runs both ways; stairs, ramps and elevators are always two-way',
      ),
      VenueMapField(
        'preferred',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
      VenueMapField(
        'walkable',
        type: 'flag',
        hasDefault: true,
        defaultValue: true,
        note: 'office section 4.2: false means scenery, never used',
      ),
      VenueMapField(
        'evacuationOnly',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
        note: 'L87, DC-18, AC-7: not allowed together with walkable false',
      ),
      VenueMapField(
        'review',
        type: 'flag',
        hasDefault: true,
        defaultValue: false,
      ),
    ],
  );

  /// Every element kind by name.
  static const Map<String, VenueMapKind> kinds = {
    'document': document,
    'site': site,
    'georeference': georeference,
    'geoOrigin': geoOrigin,
    'building': building,
    'level': level,
    'floor': floor,
    'wall': wall,
    'opening': opening,
    'unit': unit,
    'item': item,
    'correction': correction,
    'amenity': amenity,
    'transitPoint': transitPoint,
    'anchor': anchor,
    'backdrop': backdrop,
    'connector': connector,
  };

  /// The export file: office section 8.7, adapted; spec AC-47, DC-23; L170
  /// Q11 (b) (geometry plus stores); spec section 10 Q5 ruled (a) (no
  /// status, no active flag)
  static const String exportFormat = 'gabay.venue-map';

  static const int exportVersion = 1;

  static const String exportRoot = 'envelope';

  static const VenueMapKind exportEnvelope = VenueMapKind(
    'envelope',
    fields: [
      VenueMapField(
        'format',
        type: 'text',
        required: true,
        maxLength: 15,
        equals: 'gabay.venue-map',
      ),
      VenueMapField(
        'version',
        type: 'integer',
        required: true,
        equals: 1,
      ),
      VenueMapField(
        'exportedAt',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.exportedAtChars,
        pattern: VenueMapPatterns.exportedAt,
      ),
      VenueMapField(
        'fromVenue',
        type: 'object',
        required: true,
        of: 'fromVenue',
      ),
      VenueMapField(
        'map',
        type: 'object',
        required: true,
        of: 'document',
        note: 'spec AC-47: a canonical document passed through publishable(), so it holds no backdrop',
      ),
      VenueMapField(
        'stores',
        type: 'array',
        hasDefault: true,
        defaultValue: <Object>[],
        of: 'store',
        alwaysWrite: true,
        note: 'spec AC-47: always written, so the file shows its list even when empty; no two stores share a unit key (P0-11 G7), so there are at most as many stores as units',
      ),
    ],
  );

  static const VenueMapKind exportFromVenue = VenueMapKind(
    'fromVenue',
    fields: [
      VenueMapField(
        'code',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.venueCodeMaxChars,
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
    ],
  );

  static const VenueMapKind exportStore = VenueMapKind(
    'store',
    fields: [
      VenueMapField(
        'unit',
        type: 'idRef',
        required: true,
        refKind: 'unit',
        note: 'spec AC-47: the key of a unit of the envelope\'s map',
      ),
      VenueMapField(
        'name',
        type: 'text',
        required: true,
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'spokenName',
        type: 'text',
        maxLength: VenueMapConstants.nameMaxChars,
      ),
      VenueMapField(
        'category',
        type: 'code',
        required: true,
        lookup: 'OccupantCategory',
      ),
      VenueMapField(
        'keywords',
        type: 'text',
        maxLength: VenueMapConstants.storeKeywordsMaxChars,
      ),
    ],
  );

  /// Every export file kind by name.
  static const Map<String, VenueMapKind> exportKinds = {
    'envelope': exportEnvelope,
    'fromVenue': exportFromVenue,
    'store': exportStore,
  };
}
