/// The `routing.*` values a package carries (P0-06 §3 item 8, ruling A3).
///
/// Publish resolves each key for the venue's tenant (its override, else the
/// platform default) and fixes the value with the version, so the engine reads
/// only the open package and another tenant's value can never apply (EC-27).
/// A missing, null, non-numeric, non-finite or negative value uses the key's
/// platform default (DC-11, EC-39, EC-106): routing continues.
class RoutingSettings {
  const RoutingSettings._({
    required this.stairsSaveS,
    required this.otherWayMarginS,
  });

  /// Reads the two keys from the package's raw `routing.*` values. A value may
  /// be a number or a numeric string (the settings table stores text).
  factory RoutingSettings.fromPackage(Map<String, Object?> values) {
    return RoutingSettings._(
      stairsSaveS: _read(values[stairsSaveSKey], defaultStairsSaveS),
      otherWayMarginS: _read(
        values[otherWayMarginSKey],
        defaultOtherWayMarginS,
      ),
    );
  }

  /// `routing.stairsSaveS`: the no-stairs way leads only when it costs less
  /// than the stairs way plus this many seconds (AC-16, AC-17, AC-18).
  static const String stairsSaveSKey = 'routing.stairsSaveS';

  /// `routing.otherWayMarginS`: the other way is offered only when it costs
  /// more than the lead way plus this many seconds (AC-13, Q15). P0-03 r4
  /// publishes it, as L87's 0.5 m of walking at its walking rate.
  static const String otherWayMarginSKey = 'routing.otherWayMarginS';

  /// The platform default of `routing.stairsSaveS`: 120 s (L170 Q4; AC-18).
  static const double defaultStairsSaveS = 120;

  /// The platform default of `routing.otherWayMarginS`: 0.417 s, the value
  /// P0-03 r4 sets for L87's 0.5 m of walking (AC-13, DC-11). The engine holds
  /// this number only: the walking rate and the conversion are P0-03 r4's, and
  /// no cost formula lives in the engine.
  static const double defaultOtherWayMarginS = 0.417;

  /// Seconds of cost the no-stairs way may exceed the stairs way by and still
  /// lead (AC-16).
  final double stairsSaveS;

  /// Seconds of cost above the lead way below which no other way is offered
  /// (AC-13).
  final double otherWayMarginS;

  static double _read(Object? raw, double platformDefault) {
    final double? value = switch (raw) {
      final num n => n.toDouble(),
      final String s => double.tryParse(s.trim()),
      _ => null,
    };
    if (value == null || !value.isFinite || value < 0) return platformDefault;
    return value;
  }
}
