/// RG3: where a route's origin joins the walkway graph (P0-06 AC-8, AC-9;
/// L79).
///
/// The origin joins the nearest walkway EDGE that can be reached without
/// crossing a wall, not the nearest node; the route starts at the origin's
/// projection on that edge; and a one-way edge is joined only in its direction.
/// A failed snap is `null`: the caller words it "Can't start from here"
/// (`NoRouteReason.cantStartFromHere`, EC-6, EC-10, EC-11).
///
/// The index is an interface. [InMemorySegmentIndex] scans in memory for the
/// tests and the vectors; Stage F adds the one that asks the package's walkway
/// and wall R*Trees (plan FF-4 §0.2).
library;

import 'dart:math' as math;

import 'astar.dart';
import 'graph/milliseconds.dart';
import 'graph/routing_graph.dart';
import 'routing_errors.dart';

/// A wall segment on one level, from (x1, z1) to (x2, z2) in the venue frame.
class WallSegment {
  const WallSegment(this.levelId, this.x1, this.z1, this.x2, this.z2);

  final String levelId;
  final double x1;
  final double z1;
  final double x2;
  final double z2;
}

/// A walkway segment: one undirected stretch of corridor between two nodes of
/// one level, and the directed edges that run along it.
class WalkSegment {
  const WalkSegment({
    required this.tail,
    required this.head,
    required this.tailToHeadEdge,
    required this.headToTailEdge,
  });

  /// The lower-indexed end node.
  final int tail;

  /// The higher-indexed end node.
  final int head;

  /// The edge from [tail] to [head], or -1 when the corridor is one-way the
  /// other way.
  final int tailToHeadEdge;

  /// The edge from [head] to [tail], or -1 when the corridor is one-way from
  /// [tail].
  final int headToTailEdge;
}

/// What RG3 asks of the map's geometry.
abstract class SegmentIndex {
  /// The graph the segments belong to.
  RoutingGraph get graph;

  /// Whether ([x], [z]) is inside the venue boundary; true when the index has
  /// no boundary (EC-11).
  bool containsPoint(double x, double z);

  /// The walkway segments on [levelId], nearest to ([x], [z]) first. Throws
  /// [UnknownRoutingIdError] for a level the venue does not have.
  Iterable<WalkSegment> walkwaysNear(String levelId, double x, double z);

  /// Whether a wall of [levelId] crosses the straight line from (ax, az) to
  /// (bx, bz) (AC-8).
  bool wallBetween(String levelId, double ax, double az, double bx, double bz);
}

/// An origin joined to the walkway graph.
class SnapResult {
  const SnapResult({
    required this.x,
    required this.z,
    required this.levelId,
    required this.distanceM,
    required this.starts,
  });

  /// The projection on the snapped edge: where the route starts (AC-9).
  final double x;
  final double z;
  final String levelId;

  /// How far the origin was from the projection, in metres.
  final double distanceM;

  /// Where the search begins: a link to each end node the edge's direction
  /// allows, each at its share of the edge's cost and length.
  final List<StartLink> starts;
}

/// Snaps the origin ([x], [z]) on [levelId] to the walkway graph, or returns
/// null when it cannot start there.
///
/// Throws [ArgumentError] for a position that is not finite (EC-14).
SnapResult? snapOrigin(
  SegmentIndex index, {
  required double x,
  required double z,
  required String levelId,
}) {
  if (!x.isFinite || !z.isFinite) {
    throw ArgumentError('the origin must be finite: ($x, $z)');
  }
  if (!index.containsPoint(x, z)) return null;
  final graph = index.graph;
  for (final segment in index.walkwaysNear(levelId, x, z)) {
    final tx = graph.x(segment.tail);
    final tz = graph.z(segment.tail);
    final hx = graph.x(segment.head);
    final hz = graph.z(segment.head);
    final t = _projectionParameter(x, z, tx, tz, hx, hz);
    final px = tx + (hx - tx) * t;
    final pz = tz + (hz - tz) * t;
    if (index.wallBetween(levelId, x, z, px, pz)) continue;
    final starts = <StartLink>[];
    final forward = segment.tailToHeadEdge;
    if (forward >= 0) {
      starts.add(_partOfEdge(graph, forward, segment.head, 1 - t));
    }
    final backward = segment.headToTailEdge;
    if (backward >= 0) {
      starts.add(_partOfEdge(graph, backward, segment.tail, t));
    }
    return SnapResult(
      x: px,
      z: pz,
      levelId: levelId,
      distanceM: _distance(x, z, px, pz),
      starts: starts,
    );
  }
  return null;
}

/// The link to [node] along [edge]: the part of the edge's own cost and real
/// length that lies between the projection and [node] ([fraction] of its
/// planar length). The edge's published cost is only shared out, never
/// recomputed (no cost formula here), and the share is rounded to a whole
/// millisecond like every cost (DC-3, r5 errata 2).
StartLink _partOfEdge(
  RoutingGraph graph,
  int edge,
  int node,
  double fraction,
) => StartLink(
  node,
  costS: secondsOfMilliseconds((graph.costMs[edge] * fraction).round()),
  lengthM: graph.lengthM[edge] * fraction,
);

/// How far along the segment (tx, tz) to (hx, hz) the foot of the
/// perpendicular from (x, z) falls, from 0 (the tail) to 1 (the head).
double _projectionParameter(
  double x,
  double z,
  double tx,
  double tz,
  double hx,
  double hz,
) {
  final dx = hx - tx;
  final dz = hz - tz;
  final lengthSquared = dx * dx + dz * dz;
  if (lengthSquared == 0) return 0;
  final t = ((x - tx) * dx + (z - tz) * dz) / lengthSquared;
  return t.clamp(0.0, 1.0);
}

double _distance(double ax, double az, double bx, double bz) {
  final dx = ax - bx;
  final dz = az - bz;
  return math.sqrt(dx * dx + dz * dz);
}

/// A [SegmentIndex] that scans a graph's walkway edges and a list of walls in
/// memory. Fine for the tests, the vectors and any venue the Stage F index has
/// not replaced it for: a query sorts one level's segments by distance.
class InMemorySegmentIndex implements SegmentIndex {
  InMemorySegmentIndex(
    this.graph, {
    this.walls = const <WallSegment>[],
    this.boundary,
  }) : _segmentsByLevel = _collectSegments(graph);

  @override
  final RoutingGraph graph;

  /// The walls, on every level.
  final List<WallSegment> walls;

  /// The venue boundary as a polygon, or null for none (EC-11).
  final List<math.Point<double>>? boundary;

  final Map<String, List<WalkSegment>> _segmentsByLevel;

  @override
  bool containsPoint(double x, double z) {
    final polygon = boundary;
    if (polygon == null) return true;
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final a = polygon[i];
      final b = polygon[j];
      final crosses =
          (a.y > z) != (b.y > z) &&
          x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  @override
  Iterable<WalkSegment> walkwaysNear(String levelId, double x, double z) {
    final segments = _segmentsByLevel[levelId];
    if (segments == null) throw UnknownRoutingIdError('level', levelId);
    final ranked =
        <({double distance, int order, WalkSegment segment})>[
          for (var i = 0; i < segments.length; i++)
            (
              distance: _distanceToSegment(x, z, segments[i]),
              order: i,
              segment: segments[i],
            ),
        ]..sort((p, q) {
          final byDistance = p.distance.compareTo(q.distance);
          return byDistance != 0 ? byDistance : p.order.compareTo(q.order);
        });
    return ranked.map((r) => r.segment);
  }

  @override
  bool wallBetween(String levelId, double ax, double az, double bx, double bz) {
    for (final wall in walls) {
      if (wall.levelId != levelId) continue;
      if (_segmentsIntersect(
        ax,
        az,
        bx,
        bz,
        wall.x1,
        wall.z1,
        wall.x2,
        wall.z2,
      )) {
        return true;
      }
    }
    return false;
  }

  double _distanceToSegment(double x, double z, WalkSegment s) {
    final tx = graph.x(s.tail);
    final tz = graph.z(s.tail);
    final hx = graph.x(s.head);
    final hz = graph.z(s.head);
    final t = _projectionParameter(x, z, tx, tz, hx, hz);
    return _distance(x, z, tx + (hx - tx) * t, tz + (hz - tz) * t);
  }

  /// Every level has an entry (possibly empty); a walkway edge joins the two
  /// directions of one corridor into one segment. A walkway between levels is
  /// not a segment: an origin is on one level.
  static Map<String, List<WalkSegment>> _collectSegments(RoutingGraph g) {
    final byLevel = <String, List<WalkSegment>>{
      for (final level in g.levelList) level.id: <WalkSegment>[],
    };
    final tailToHead = <int, int>{};
    final headToTail = <int, int>{};
    final order = <int>[];
    final walkway = EdgeKind.walkway.index;
    for (var u = 0; u < g.nodeCount; u++) {
      for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
        if (g.kinds[e] != walkway) continue;
        final v = g.targets[e];
        if (u == v || g.levelIndexOf(u) != g.levelIndexOf(v)) continue;
        final low = u < v ? u : v;
        final high = u < v ? v : u;
        final key = low * g.nodeCount + high;
        if (!tailToHead.containsKey(key) && !headToTail.containsKey(key)) {
          order.add(key);
        }
        final map = u == low ? tailToHead : headToTail;
        map.putIfAbsent(key, () => e);
      }
    }
    for (final key in order) {
      final tail = key ~/ g.nodeCount;
      final head = key % g.nodeCount;
      byLevel[g.levelIdOf(tail)]!.add(
        WalkSegment(
          tail: tail,
          head: head,
          tailToHeadEdge: tailToHead[key] ?? -1,
          headToTailEdge: headToTail[key] ?? -1,
        ),
      );
    }
    return byLevel;
  }
}

/// Whether the segments (a to b) and (c to d) meet, touching and overlapping
/// included.
bool _segmentsIntersect(
  double ax,
  double az,
  double bx,
  double bz,
  double cx,
  double cz,
  double dx,
  double dz,
) {
  final o1 = _orientation(ax, az, bx, bz, cx, cz);
  final o2 = _orientation(ax, az, bx, bz, dx, dz);
  final o3 = _orientation(cx, cz, dx, dz, ax, az);
  final o4 = _orientation(cx, cz, dx, dz, bx, bz);
  if (o1 != o2 && o3 != o4) return true;
  if (o1 == 0 && _onSegment(ax, az, bx, bz, cx, cz)) return true;
  if (o2 == 0 && _onSegment(ax, az, bx, bz, dx, dz)) return true;
  if (o3 == 0 && _onSegment(cx, cz, dx, dz, ax, az)) return true;
  if (o4 == 0 && _onSegment(cx, cz, dx, dz, bx, bz)) return true;
  return false;
}

/// 0 when (px, pz) is on the line through a and b, else the side it is on.
int _orientation(
  double ax,
  double az,
  double bx,
  double bz,
  double px,
  double pz,
) {
  final cross = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
  if (cross > 0) return 1;
  if (cross < 0) return -1;
  return 0;
}

/// Whether (px, pz), known to be on the line through a and b, lies within the
/// segment.
bool _onSegment(
  double ax,
  double az,
  double bx,
  double bz,
  double px,
  double pz,
) =>
    px >= math.min(ax, bx) &&
    px <= math.max(ax, bx) &&
    pz >= math.min(az, bz) &&
    pz <= math.max(az, bz);
