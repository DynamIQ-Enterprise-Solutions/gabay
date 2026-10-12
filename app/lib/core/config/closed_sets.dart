// GENERATED FILE: do not edit. Source: functions/src/config/closed-sets.json,
// the one constants file (Blueprint invariant 14). Regenerate with
// `npm run gen:closed-sets`; `npm run tools:test` fails while this is stale.

/// A closed set (PublishProblemKind).
///
/// Authority: spec/P0-03.md r2 section 3.2 (AC-11 to AC-20) and EC-36;
/// plan/FF-3-publish-engine.md 1.0 section 3. One kind per refusal:
/// UNREVIEWED AC-11; WALL_CROSSING AC-12; UNREACHABLE AC-13 and AC-40;
/// ORPHAN AC-14; CONNECTOR_UNPAIRED AC-15(a); LIFT_STOPS AC-15(b);
/// CONNECTOR_OFF_WALKWAY AC-15(c); CONNECTOR_NO_RISE AC-15(d);
/// OUTSIDE_BOUNDARY AC-16; BEACON_DUPLICATE and BEACON_NAMESPACE AC-17;
/// SHAPE_UNREADABLE AC-18; TENANT_MISMATCH AC-19; NOTHING_TO_PUBLISH AC-20.
///
/// Closed because: Each kind is a check the publish engine runs in code; a
/// new kind needs new code and its ARB wording.
enum PublishProblemKind {
  unreviewed('UNREVIEWED'),
  wallCrossing('WALL_CROSSING'),
  unreachable('UNREACHABLE'),
  orphan('ORPHAN'),
  connectorUnpaired('CONNECTOR_UNPAIRED'),
  liftStops('LIFT_STOPS'),
  connectorOffWalkway('CONNECTOR_OFF_WALKWAY'),
  connectorNoRise('CONNECTOR_NO_RISE'),
  outsideBoundary('OUTSIDE_BOUNDARY'),
  beaconDuplicate('BEACON_DUPLICATE'),
  beaconNamespace('BEACON_NAMESPACE'),
  shapeUnreadable('SHAPE_UNREADABLE'),
  tenantMismatch('TENANT_MISMATCH'),
  nothingToPublish('NOTHING_TO_PUBLISH');

  const PublishProblemKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static PublishProblemKind? fromCode(String value) {
    for (final member in PublishProblemKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}

/// A closed set (PublishWarningKind).
///
/// Authority: spec/P0-03.md r2 AC-22 (NO_BEACONS_ON_LEVEL, ruled D8), AC-23
/// (DOOR_WIDTH_UNMEASURED) and AC-75 (GRAPH_LARGE, PACKAGE_LARGE; ruled
/// D14); EC-6: these and no others.
///
/// Closed because: Each kind is a check the publish engine or the publish
/// service runs in code; a warning never refuses a publish.
enum PublishWarningKind {
  noBeaconsOnLevel('NO_BEACONS_ON_LEVEL'),
  doorWidthUnmeasured('DOOR_WIDTH_UNMEASURED'),
  graphLarge('GRAPH_LARGE'),
  packageLarge('PACKAGE_LARGE');

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
/// Authority: spec/P0-03.md r2 AC-42 (walk, connector or store crossing);
/// spec/P0-06.md r2 section 3 item 1.
///
/// Closed because: Each kind is a way the router treats an edge in code: a
/// walkway, a floor change, or a crossing through a walk-through store
/// (L92).
enum GraphEdgeKind {
  walk('WALK'),
  connector('CONNECTOR'),
  storeCrossing('STORE_CROSSING');

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

/// A closed set (ConnectorCostModel).
///
/// Authority: db/schema.sql 0.14 CK_ConnectorType_CostModel; Blueprint
/// section 3.2. The publish engine reads it for the lift and two-ended
/// connector rules (spec/P0-03.md r2 AC-15, AC-33; ruled D7).
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
/// r2 DC-6 and AC-27.
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

/// A closed set (ShapeKind).
///
/// Authority: db/schema.sql 0.14 CK_Unit_Shape and CK_FloorObject_Shape;
/// L39. The publish engine reads it to draw a box floor object stored
/// without GeoJSON (spec/P0-03.md r2 AC-18, AC-24).
///
/// Closed because: Each kind is geometry code: a box from its centre, size
/// and rotation, or a drawn polygon.
enum ShapeKind {
  box('BOX'),
  polygon('POLYGON');

  const ShapeKind(this.code);

  /// The value as the API and the package carry it.
  final String code;

  /// The member whose [code] is [value], or null when none is.
  static ShapeKind? fromCode(String value) {
    for (final member in ShapeKind.values) {
      if (member.code == value) return member;
    }
    return null;
  }
}
