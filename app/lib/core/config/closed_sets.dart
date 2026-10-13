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
