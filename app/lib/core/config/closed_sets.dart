// GENERATED FILE: do not edit. Source: functions/src/config/closed-sets.json,
// the one constants file (Blueprint invariant 14). Regenerate with
// `npm run gen:closed-sets`; `npm run tools:test` fails while this is stale.

/// A closed set (ConnectorCostModel).
///
/// Authority: db/schema.sql 0.14 CK_ConnectorType_CostModel; Blueprint
/// section 3.2. The publish engine reads it for the lift and two-ended
/// connector rules (spec/P0-03.md r2 AC-15, AC-33; ruled D7). The venue map
/// document's validator checks that a connector's ConnectorType code has
/// the CostModel of its kind (spec/OA-1.md r1 section 2.6, AC-7).
///
/// Closed because: Each value is a connector behaviour in code (how its
/// ends and rise are read, step-free, evacuation); connector TYPES are the
/// ConnectorType lookup.
enum ConnectorCostModel {
  escalator('ESCALATOR'),
  stairs('STAIRS'),
  elevator('ELEVATOR'),
  ramp('RAMP'),
  level('LEVEL');

  const ConnectorCostModel(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ConnectorCostModel? fromCode(String value) {
    for (final member in ConnectorCostModel.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (NavCorrectionKind).
///
/// Authority: db/schema.sql 0.14 CK_NavCorrection_Kind; L32; spec/P0-03.md
/// r2 DC-6 and AC-27; spec/OA-1.md r1 section 2.5.5 (a correction's kind in
/// the venue map document) and AC-21.
///
/// Closed because: Each kind is a graph-generation operation in code.
enum NavCorrectionKind {
  blockArea('BLOCK_AREA'),
  addPath('ADD_PATH'),
  removePath('REMOVE_PATH');

  const NavCorrectionKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static NavCorrectionKind? fromCode(String value) {
    for (final member in NavCorrectionKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (ImdfUnitCategory).
///
/// Authority: IMDF 1.0.0, OGC 20-094 Categories, fetched 2026-10-12
/// (docs.ogc.org/cs/20-094/Categories/index.html, the Unit table: 63
/// values, as published); invariant 14 (fixed by an outside standard);
/// spec/OA-1.md r1 section 2.5.3 and AC-21.
///
/// Closed because: Fixed by an outside standard: the IMDF 1.0.0 unit
/// categories, as published. Gabay neither adds nor renames one.
enum ImdfUnitCategory {
  auditorium('auditorium'),
  brick('brick'),
  classroom('classroom'),
  column('column'),
  concrete('concrete'),
  conferenceroom('conferenceroom'),
  drywall('drywall'),
  elevator('elevator'),
  escalator('escalator'),
  fieldofplay('fieldofplay'),
  firstaid('firstaid'),
  fitnessroom('fitnessroom'),
  foodservice('foodservice'),
  footbridge('footbridge'),
  glass('glass'),
  huddleroom('huddleroom'),
  kitchen('kitchen'),
  laboratory('laboratory'),
  libraryValue('library'),
  lobby('lobby'),
  lounge('lounge'),
  mailroom('mailroom'),
  mothersroom('mothersroom'),
  movietheater('movietheater'),
  movingwalkway('movingwalkway'),
  nonpublic('nonpublic'),
  office('office'),
  opentobelow('opentobelow'),
  parking('parking'),
  phoneroom('phoneroom'),
  platform('platform'),
  privatelounge('privatelounge'),
  ramp('ramp'),
  recreation('recreation'),
  restroom('restroom'),
  restroomFamily('restroom.family'),
  restroomFemale('restroom.female'),
  restroomFemaleWheelchair('restroom.female.wheelchair'),
  restroomMale('restroom.male'),
  restroomMaleWheelchair('restroom.male.wheelchair'),
  restroomTransgender('restroom.transgender'),
  restroomTransgenderWheelchair('restroom.transgender.wheelchair'),
  restroomUnisex('restroom.unisex'),
  restroomUnisexWheelchair('restroom.unisex.wheelchair'),
  restroomWheelchair('restroom.wheelchair'),
  road('road'),
  room('room'),
  serverroom('serverroom'),
  shower('shower'),
  smokingarea('smokingarea'),
  stairs('stairs'),
  steps('steps'),
  storage('storage'),
  structure('structure'),
  terrace('terrace'),
  theater('theater'),
  unenclosedarea('unenclosedarea'),
  unspecified('unspecified'),
  vegetation('vegetation'),
  waitingroom('waitingroom'),
  walkway('walkway'),
  walkwayIsland('walkway.island'),
  wood('wood');

  const ImdfUnitCategory(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ImdfUnitCategory? fromCode(String value) {
    for (final member in ImdfUnitCategory.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (WallKind).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 4.2 (Wall: kind solid,
/// glass or partition); spec/OA-1.md r1 section 2.5.1 and AC-21.
///
/// Closed because: Each kind is drawn and modelled in code (the renderer,
/// the publish engine's walls, the beacon planner's signal model); a new
/// kind needs new code.
enum WallKind {
  solid('solid'),
  glass('glass'),
  partition('partition');

  const WallKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static WallKind? fromCode(String value) {
    for (final member in WallKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (OpeningKind).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 4.2 (Opening: kind door
/// or window); spec/OA-1.md r1 section 2.5.2, AC-8 and AC-21.
///
/// Closed because: Each kind is a rule in code: a door is walked through
/// and may be an entrance or a unit's door; a window is never walked
/// through.
enum OpeningKind {
  door('door'),
  window('window');

  const OpeningKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static OpeningKind? fromCode(String value) {
    for (final member in OpeningKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (ConnectorKind).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 4.2 (Connector: stairs,
/// escalator, elevator), plus ramp (plan/OFFICE-ADOPTION-replan.md 1.0
/// section 1.2; P0-07); spec/OA-1.md r1 section 2.6, AC-7 and AC-21.
///
/// Closed because: Each kind carries its own geometry rules in code
/// (levels, size ranges, shape, two-way) and matches one
/// ConnectorCostModel; connector TYPES are the ConnectorType lookup.
enum ConnectorKind {
  stairs('stairs'),
  escalator('escalator'),
  elevator('elevator'),
  ramp('ramp');

  const ConnectorKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ConnectorKind? fromCode(String value) {
    for (final member in ConnectorKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (ConnectorShape).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 4.2 (stairs: shape
/// straight, L or U); spec/OA-1.md r1 section 2.6 (stairs and ramps) and
/// AC-21.
///
/// Closed because: Each shape is geometry code in the renderer and in the
/// landing rules.
enum ConnectorShape {
  straight('straight'),
  l('L'),
  u('U');

  const ConnectorShape(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ConnectorShape? fromCode(String value) {
    for (final member in ConnectorShape.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (ItemFinish).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 5 (item finishes: keys
/// only; the renderer owns the colours); spec/OA-1.md r1 section 2.5.4,
/// AC-21 and AC-22; rule 6.
///
/// Closed because: Each key has its own light and dark colour token in
/// app/lib/core/theme/gabay_tokens.dart (rule 6); the document stores the
/// key, never a colour.
enum ItemFinish {
  defaultValue('default'),
  white('white'),
  oak('oak'),
  walnut('walnut'),
  charcoal('charcoal'),
  grey('grey'),
  blue('blue'),
  green('green'),
  red('red'),
  yellow('yellow');

  const ItemFinish(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ItemFinish? fromCode(String value) {
    for (final member in ItemFinish.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (FloorFinish).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 5 (floor finishes: keys
/// only); spec/OA-1.md r1 sections 2.4 and 2.5.3, AC-21 and AC-22; rule 6.
///
/// Closed because: Each key has its own light and dark colour token in
/// app/lib/core/theme/gabay_tokens.dart (rule 6); the document stores the
/// key, never a colour.
enum FloorFinish {
  defaultValue('default'),
  concrete('concrete'),
  tile('tile'),
  carpet('carpet'),
  wood('wood'),
  vinyl('vinyl');

  const FloorFinish(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static FloorFinish? fromCode(String value) {
    for (final member in FloorFinish.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (ItemMount).
///
/// Authority: OFFICE_MAP_DESIGNER_SPEC.md section 5 (mount: floor or wall);
/// spec/OA-1.md r1 AC-21 and AC-44 (the catalog's mount).
///
/// Closed because: Each mount is placement code in the editor (a wall item
/// snaps flat onto a wall face) and in the renderer.
enum ItemMount {
  floor('floor'),
  wall('wall');

  const ItemMount(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ItemMount? fromCode(String value) {
    for (final member in ItemMount.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (PublishBlockingKind).
///
/// Authority: spec/P0-03.md r4 section 3.14.8 and AC-107 to AC-109 (L170
/// Q2: publish blocks only on these); EC-36; plan/FF-3-prime-A1.md 1.0 step
/// 11. A1's PublishProblemKind, renamed; a kind that survives keeps A1's
/// spelling (DC-25). INVALID_DOCUMENT, NOTHING_TO_PUBLISH (ruled
/// 2026-10-14, Q3 (a)) and TENANT_MISMATCH AC-108; BEACON_DUPLICATE,
/// BEACON_NAMESPACE, BEACON_MIXED_MAJOR and BEACON_MAJOR_SHARED (ruled
/// 2026-10-14, Q2 (a)) AC-109. The order is AC-115's sort order: blocking
/// first, then each kind's place here.
///
/// Closed because: Each kind is a check the publish engine runs in code and
/// refuses a publish on; a new kind needs new code and its ARB wording
/// (AC-128).
enum PublishBlockingKind {
  invalidDocument('INVALID_DOCUMENT'),
  nothingToPublish('NOTHING_TO_PUBLISH'),
  tenantMismatch('TENANT_MISMATCH'),
  beaconDuplicate('BEACON_DUPLICATE'),
  beaconNamespace('BEACON_NAMESPACE'),
  beaconMixedMajor('BEACON_MIXED_MAJOR'),
  beaconMajorShared('BEACON_MAJOR_SHARED');

  const PublishBlockingKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static PublishBlockingKind? fromCode(String value) {
    for (final member in PublishBlockingKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (PublishWarningKind).
///
/// Authority: spec/P0-03.md r4 section 3.14.8 and AC-107 (the warning kinds
/// are exactly these); EC-36; plan/FF-3-prime-A1.md 1.0 step 11.
/// NO_BEACONS_ON_LEVEL AC-22; DOOR_WIDTH_UNMEASURED AC-23; GRAPH_LARGE and
/// PACKAGE_LARGE AC-75; UNREVIEWED AC-113; UNREACHABLE AC-110; ORPHAN
/// AC-111; WALL_CROSSING AC-97; NO_ENTRANCE AC-98; CONNECTOR_OFF_WALKWAY,
/// CONNECTOR_NO_RISE, OUTSIDE_BOUNDARY and SHAPE_SELF_CROSSING AC-112;
/// STORE_WITHOUT_UNIT, STORE_DUPLICATE_UNIT and BEACON_LEVEL_MISSING
/// AC-114. Spellings kept from A1 (DC-25); the order is AC-115's sort order
/// after the blocking kinds.
///
/// Closed because: Each kind is a check the publish engine or the publish
/// service runs in code; a warning never refuses a publish (L170 Q2), and a
/// new kind needs new code and its ARB wording (AC-128).
enum PublishWarningKind {
  noBeaconsOnLevel('NO_BEACONS_ON_LEVEL'),
  doorWidthUnmeasured('DOOR_WIDTH_UNMEASURED'),
  graphLarge('GRAPH_LARGE'),
  packageLarge('PACKAGE_LARGE'),
  unreviewed('UNREVIEWED'),
  unreachable('UNREACHABLE'),
  orphan('ORPHAN'),
  wallCrossing('WALL_CROSSING'),
  noEntrance('NO_ENTRANCE'),
  connectorOffWalkway('CONNECTOR_OFF_WALKWAY'),
  connectorNoRise('CONNECTOR_NO_RISE'),
  outsideBoundary('OUTSIDE_BOUNDARY'),
  shapeSelfCrossing('SHAPE_SELF_CROSSING'),
  storeWithoutUnit('STORE_WITHOUT_UNIT'),
  storeDuplicateUnit('STORE_DUPLICATE_UNIT'),
  beaconLevelMissing('BEACON_LEVEL_MISSING');

  const PublishWarningKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static PublishWarningKind? fromCode(String value) {
    for (final member in PublishWarningKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (GraphEdgeKind).
///
/// Authority: spec/P0-03.md r4 AC-105 and AC-132 (walk, connector or store
/// crossing); spec/P0-06.md r5 section 3 item 1; plan/FF-3-prime-A1.md 1.1
/// section 2 (the package model's edge kind is an index into this list, in
/// this order). The order is FF-4's reviewed RoutingGraph's EdgeKind
/// (walkway, storeCrossing, connector;
/// app/lib/core/routing/graph/graph_elements.dart on ff4-engine), so an
/// index means the same on both sides (A1′b review I1).
///
/// Closed because: Each kind is a way the router treats an edge in code: a
/// walkway, a crossing through a walk-through store (L92), or a ride on a
/// connector.
enum GraphEdgeKind {
  walk('WALK'),
  storeCrossing('STORE_CROSSING'),
  connector('CONNECTOR');

  const GraphEdgeKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static GraphEdgeKind? fromCode(String value) {
    for (final member in GraphEdgeKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (UnreachableReason).
///
/// Authority: spec/P0-03.md r4 AC-110 (params.reason of UNREACHABLE:
/// no_door, cut_off or no_way_back); the publish screen words each from ARB
/// (AC-128). A1′b review I2.
///
/// Closed because: Each reason is a case of the publish engine's
/// reachability check in code: no door to arrive at, no way in from an
/// entrance, or no way back to one.
enum UnreachableReason {
  noDoor('no_door'),
  cutOff('cut_off'),
  noWayBack('no_way_back');

  const UnreachableReason(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static UnreachableReason? fromCode(String value) {
    for (final member in UnreachableReason.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (EvacuationAmenityType).
///
/// Authority: L87; spec/P0-03.md r3 AC-88 (Q20, ruled 2026-10-12, residual
/// sheet R29), kept in r4 by AC-110; db/seeds/lib/lookups.js (the platform
/// AmenityType rows REFUGE_AREA and ASSEMBLY_AREA). The publish engine
/// leaves these amenities out of reachability until P3-02.
///
/// Closed because: Each code is an evacuation behaviour in code (left out
/// of reachability and of search until P3-02, AC-88); every other amenity
/// type is the AmenityType lookup, and a tenant's own type with another
/// code is an ordinary amenity (EC-67).
enum EvacuationAmenityType {
  refugeArea('REFUGE_AREA'),
  assemblyArea('ASSEMBLY_AREA');

  const EvacuationAmenityType(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static EvacuationAmenityType? fromCode(String value) {
    for (final member in EvacuationAmenityType.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed subset (WalkableUnitCategory) of [ImdfUnitCategory].
///
/// Authority: spec/P0-11.md r2 DC-8 (the seeds use walkway, parking and
/// footbridge as walkable); spec/OA-1.md r1 AC-9 and AC-21.
///
/// Closed because: A unit's walkable flag defaults from its category in
/// code (the validator fills it when absent, AC-9); the admin sets walkable
/// on a unit to override it.
const Set<ImdfUnitCategory> walkableUnitCategory = {
  ImdfUnitCategory.walkway,
  ImdfUnitCategory.parking,
  ImdfUnitCategory.footbridge,
};
