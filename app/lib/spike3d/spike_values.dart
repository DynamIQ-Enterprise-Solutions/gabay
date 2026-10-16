/// The spike's provisional values (L117), bound for stage V (plan/V3D-spike.md
/// 1.0 step 8; P0-04 r4 AC-82, AC-83).
///
/// `map.volumeHeightFraction`: walls and store volumes stand at this
/// fraction of the level's height. A named constant in the spike; it becomes
/// the `map.volumeHeightFraction` setting in stage V (AC-60, AC-82). Tuned by
/// eye in step 8 from screenshots at 0.3, 0.45, 0.6 and 0.8.
const double spikeVolumeHeightFraction = 0.45;

/// The fractions the step-8 screenshots compare.
const List<double> volumeHeightFractionCandidates = <double>[
  0.3,
  0.45,
  0.6,
  0.8,
];
