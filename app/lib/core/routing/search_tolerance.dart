/// The one tolerance the engine keeps: real metres compare within a
/// millimetre, the resolution an edge's length is stored to
/// (`DECIMAL(9,3)`).
///
/// Costs have no tolerance: they are whole milliseconds and compare exactly
/// (P0-06 DC-3, r5 errata 2, `graph/milliseconds.dart`). Real metres are a
/// sum of floats, so two ways' lengths (AC-15's "Shortest") and "no distance
/// at all" (an origin on a door) are compared with this.
const double realMetresToleranceM = 0.001;
