/// What a route query returns, and the figures a way shows (P0-06 AC-10,
/// AC-27, AC-31; DC-38).
///
/// **Numbers and enums only, never user-facing strings.** "About N min",
/// "< 1 min", "Shortest (N m)" and every reason's sentence are ARB text, built
/// in Stage F from these figures.
///
/// The closed sets below (result kinds, leg kinds, no-route reasons) move to
/// `functions/src/config/closed-sets.json` and `closed_sets.dart` at PR time,
/// after a rebase on `main` (FF-4 plan 1.1 §0.2, invariant 14).
library;

import 'dart:math' as math;

// moves to closed-sets.json at PR time (FF-4 plan 1.1 §0.2)
/// What a query came to (AC-31's states, and AC-76).
enum RouteResultKind {
  /// One or two ways to the destination's door.
  ways,

  /// No door can be reached: one way to the nearest reachable point (AC-76).
  endsShort,

  /// The origin is at a door of the destination (EC-8).
  alreadyHere,

  /// The nearest reachable point is the origin itself (EC-95).
  alreadyAsCloseAsPossible,

  /// No way, with a [NoRouteReason].
  noRoute,
}

// moves to closed-sets.json at PR time (FF-4 plan 1.1 §0.2)
/// Why there is no route (AC-31). Open to FF-5's "no step-free way".
enum NoRouteReason {
  unreachableFromHere,
  cantStartFromHere,
  notOpen,

  /// A trip to a place whose every passage is closed (AC-24).
  closedPassageIn,

  /// A trip from a place whose every passage is closed (AC-24).
  closedPassageOut,
}

// moves to closed-sets.json at PR time (FF-4 plan 1.1 §0.2)
/// What a leg of a way is (§2, "Leg").
enum LegKind { walk, walkThroughStore, ride }

/// Which way a ride goes, by level ordinal.
enum RideDirection { up, down }

/// How a way is named on its pill (AC-14, AC-15).
enum WayLabelKind {
  /// The lead way, and it also has the fewest real metres shown (Q16).
  shortest,

  /// The lead way otherwise: the stairs rule demoted a shorter stairs way
  /// (E12), or it is quickest but not shortest (Q16).
  recommended,

  /// The other way takes a connector the lead does not: "via ⟨connector⟩".
  otherVia,

  /// The other way uses an outdoor level the lead does not.
  otherGoesOutside,

  /// "Other way 1".
  otherPlain,
}

/// A point of a way, in the venue frame.
class RoutePoint {
  const RoutePoint(this.x, this.z, this.levelId);

  /// Across the plan, in metres.
  final double x;

  /// Down the plan, in metres.
  final double z;

  /// The document's level id.
  final String levelId;

  @override
  bool operator ==(Object other) =>
      other is RoutePoint &&
      other.x == x &&
      other.z == z &&
      other.levelId == levelId;

  @override
  int get hashCode => Object.hash(x, z, levelId);

  @override
  String toString() => 'RoutePoint($x, $z, $levelId)';
}

/// A contiguous part of a way of one kind (§2, AC-25).
class RouteLeg {
  const RouteLeg._({
    required this.kind,
    required this.realMetres,
    this.levelId,
    this.outdoor = false,
    this.storeId,
    this.connectorId,
    this.direction,
    this.fromLevelId,
    this.toLevelId,
  });

  /// Walking on [levelId].
  const RouteLeg.walk({
    required String levelId,
    required double realMetres,
    required bool outdoor,
  }) : this._(
         kind: LegKind.walk,
         realMetres: realMetres,
         levelId: levelId,
         outdoor: outdoor,
       );

  /// Walking through [storeId] on [levelId]. [realMetres] is the real walked
  /// length, not the weighted cost (AC-25).
  const RouteLeg.walkThroughStore({
    required String storeId,
    required String levelId,
    required double realMetres,
    required bool outdoor,
  }) : this._(
         kind: LegKind.walkThroughStore,
         realMetres: realMetres,
         levelId: levelId,
         outdoor: outdoor,
         storeId: storeId,
       );

  /// Riding [connectorId] from [fromLevelId] to [toLevelId].
  const RouteLeg.ride({
    required String connectorId,
    required RideDirection direction,
    required String fromLevelId,
    required String toLevelId,
    required double realMetres,
  }) : this._(
         kind: LegKind.ride,
         realMetres: realMetres,
         connectorId: connectorId,
         direction: direction,
         fromLevelId: fromLevelId,
         toLevelId: toLevelId,
       );

  final LegKind kind;

  /// The leg's real walked metres, without weights.
  final double realMetres;

  /// The level a walk or a store crossing is on; null for a ride.
  final String? levelId;

  /// Whether a walk or a store crossing is on an outdoor level (AC-6).
  final bool outdoor;

  /// The store a crossing goes through.
  final String? storeId;

  /// The connector a ride uses.
  final String? connectorId;

  /// Up or down, for a ride.
  final RideDirection? direction;

  /// A ride's from level.
  final String? fromLevelId;

  /// A ride's to level.
  final String? toLevelId;

  @override
  String toString() =>
      'RouteLeg(${kind.name}, ${realMetres}m, level $levelId, store $storeId, '
      'connector $connectorId)';
}

/// A way's name: its kind, and the connector for "via ⟨connector⟩".
class WayLabel {
  const WayLabel(this.kind, {this.connectorId});

  final WayLabelKind kind;

  /// The connector named by [WayLabelKind.otherVia].
  final String? connectorId;

  @override
  String toString() => 'WayLabel(${kind.name}, $connectorId)';
}

/// One way to the destination (AC-27).
class Way {
  const Way({
    required this.points,
    required this.legs,
    required this.costS,
    required this.realMetres,
    required this.levelIds,
    required this.goesOutside,
    required this.label,
    this.endPoint,
  });

  /// The way's points in order, each with its level. For a snapped origin the
  /// first is the origin's projection (AC-9).
  final List<RoutePoint> points;

  /// The legs in order.
  final List<RouteLeg> legs;

  /// The cost in seconds (L170 Q4): what the way is ranked on.
  final double costS;

  /// The real metres walked, the sum of the edges' real lengths (§2).
  final double realMetres;

  /// The levels the way uses, in order.
  final List<String> levelIds;

  /// Whether the way touches an outdoor level.
  final bool goesOutside;

  /// The pill's name (AC-14, AC-15).
  final WayLabel label;

  /// Where a way that ends short ends, else null (AC-76).
  final RoutePoint? endPoint;

  /// Whether the way ends at the nearest reachable point instead of at a door.
  bool get endsShort => endPoint != null;

  Way withLabel(WayLabel newLabel) => Way(
    points: points,
    legs: legs,
    costS: costS,
    realMetres: realMetres,
    levelIds: levelIds,
    goesOutside: goesOutside,
    label: newLabel,
    endPoint: endPoint,
  );

  @override
  String toString() =>
      'Way(${costS}s, ${realMetres}m, ${label.kind.name}, '
      '${points.length} points)';
}

/// The answer to a route query (AC-27, AC-31).
class RouteResult {
  const RouteResult._({
    required this.kind,
    required this.packageVersion,
    this.reason,
    this.closedStoreIds = const <String>[],
    this.ways = const <Way>[],
  });

  /// One or two ways: the lead way, then the other way when one qualifies.
  const RouteResult.ways(int packageVersion, List<Way> ways)
    : this._(
        kind: RouteResultKind.ways,
        packageVersion: packageVersion,
        ways: ways,
      );

  /// One way that ends at the nearest reachable point (AC-76).
  factory RouteResult.endsShort(int packageVersion, Way way) => RouteResult._(
    kind: RouteResultKind.endsShort,
    packageVersion: packageVersion,
    ways: <Way>[way],
  );

  /// The origin is at a door of the destination.
  const RouteResult.alreadyHere(int packageVersion)
    : this._(kind: RouteResultKind.alreadyHere, packageVersion: packageVersion);

  /// The nearest the map can take the shopper is where they already are.
  const RouteResult.alreadyAsCloseAsPossible(int packageVersion)
    : this._(
        kind: RouteResultKind.alreadyAsCloseAsPossible,
        packageVersion: packageVersion,
      );

  /// No route, for [reason]; [closedStoreIds] names the closed passages of a
  /// closed-passage reason, in the package's order (DC-14).
  const RouteResult.noRoute(
    int packageVersion,
    NoRouteReason reason, {
    List<String> closedStoreIds = const <String>[],
  }) : this._(
         kind: RouteResultKind.noRoute,
         packageVersion: packageVersion,
         reason: reason,
         closedStoreIds: closedStoreIds,
       );

  final RouteResultKind kind;

  /// The package version the route was computed on (AC-27, AC-33).
  final int packageVersion;

  /// Why there is no route, for [RouteResultKind.noRoute].
  final NoRouteReason? reason;

  /// The closed passage stores behind a closed-passage reason.
  final List<String> closedStoreIds;

  /// The ways; empty unless [kind] is `ways` or `endsShort`.
  final List<Way> ways;

  @override
  String toString() =>
      'RouteResult(${kind.name}, reason ${reason?.name}, ${ways.length} ways)';
}

/// The metres a way shows: whole metres, never below 1 m (AC-10; the
/// reference's `fmtM` rule).
int displayMetres(double realMetres) => math.max(1, realMetres.round());

/// The whole minutes of Simple wording: the cost in seconds, times the
/// walking-pace factor when FF-7 passes one, over 60, rounded up. Under 60 s
/// it is 0, which the screen words "< 1 min" (AC-10, DC-38, EC-99).
int simpleMinutes(double costS, {double paceFactor = 1.0}) {
  final seconds = costS * paceFactor;
  if (seconds < 60) return 0;
  return (seconds / 60).ceil();
}

/// The minutes of Technical wording: one decimal (AC-10, DC-38).
double technicalMinutes(double costS, {double paceFactor = 1.0}) {
  final minutes = costS * paceFactor / 60;
  return (minutes * 10).round() / 10;
}
