/// Costs in whole milliseconds (P0-06 DC-3, r5 errata 2, owner-approved
/// 2026-10-14).
///
/// The engine rounds each edge cost, each snap share and each `routing.*`
/// seconds setting to a whole millisecond when it builds a graph, then
/// searches and compares in integers. "Within 0.001 s" therefore means "the
/// same millisecond", every comparison of two costs is exact, and a total is
/// the same whatever order its edges are added in (floats would say
/// 0.1 + 0.2 > 0.3). Results still report seconds as `milliseconds / 1000`.
library;

/// The most milliseconds one edge may cost: what an `Int32List` holds
/// (2,147,483,647 ms, about 24.8 days). A path may be longer: the search adds
/// edges in an `Int64List`, and the longest possible path on a 76,000-node
/// graph is under 76,000 x 2.15e9 ms = 1.6e14, far inside a 64-bit integer.
const int maxEdgeMilliseconds = 0x7fffffff;

/// [seconds] as whole milliseconds, halves away from zero.
///
/// Throws [ArgumentError] when [seconds] is not finite.
int wholeMilliseconds(double seconds) {
  if (!seconds.isFinite) {
    throw ArgumentError.value(seconds, 'seconds', 'must be finite');
  }
  return (seconds * 1000).round();
}

/// [milliseconds] as seconds: the figure a result reports.
double secondsOfMilliseconds(int milliseconds) => milliseconds / 1000;
