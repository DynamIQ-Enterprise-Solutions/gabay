/// The spike's provisional values (L117), bound for stage V (plan/V3D-spike.md
/// 1.0 step 8; P0-04 r4 AC-82, AC-83).
///
/// `map.volumeHeightFraction`: walls and store volumes stand at this
/// fraction of the level's height. A named constant in the spike; it becomes
/// the `map.volumeHeightFraction` setting in stage V (AC-60, AC-82). Tuned by
/// eye in step 8 from screenshots at 0.3, 0.45, 0.6 and 0.8, at pitch 45°
/// and 60°, light and dark, at the closest zoom on the heaviest level: 0.6.
/// The volumes read as volumes and the door gaps show, and at the steepest
/// tilt a volume hides about 3.1 m of floor behind it (1.8 m × tan 60°), under
/// a quarter of Bayview's 14 m corridors; 0.8 hides 4.2 m and its front faces
/// read heavy; 0.3 and 0.45 read almost flat. Provisional (L117).
const double spikeVolumeHeightFraction = 0.6;

/// The fractions the step-8 screenshots compare.
const List<double> volumeHeightFractionCandidates = <double>[
  0.3,
  0.45,
  0.6,
  0.8,
];
