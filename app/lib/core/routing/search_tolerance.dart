/// Costs compare within one thousandth of a second (P0-06 DC-3, AC-11).
///
/// It is far below anything a shopper could notice, and it holds only while
/// the package stores each edge's cost to at least that resolution (P0-03 r4).
/// The search itself relaxes on exact costs: see `astar.dart`.
const double costToleranceS = 0.001;

/// Real metres compare within a millimetre: the resolution an edge's length is
/// stored to (`DECIMAL(9,3)`). Used where two whole ways' lengths are compared
/// (AC-15's "Shortest") and where "no distance at all" is decided.
const double realMetresToleranceM = 0.001;
