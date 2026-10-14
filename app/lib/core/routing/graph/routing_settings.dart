/// The `routing.*` values a package carries (P0-06 §3 item 8, ruling A3).
///
/// Publish resolves each key for the venue's tenant (its override, else the
/// platform default) and fixes the value with the version, so the engine reads
/// only the open package and another tenant's value can never apply (EC-27).
/// A missing, null, non-numeric, non-finite or negative value uses the key's
/// platform default (DC-11, EC-39, EC-106): routing continues. Each value is
/// rounded to whole milliseconds (DC-3, r5 errata 2), the unit the engine
/// compares costs in.
library;

import 'milliseconds.dart';

class RoutingSettings {
  const RoutingSettings._({
    required this.stairsSaveMs,
    required this.otherWayMarginMs,
  });

  /// Reads the two keys from the package's raw `routing.*` values. A value may
  /// be a number or a numeric string (the settings table stores text).
  factory RoutingSettings.fromPackage(Map<String, Object?> values) {
    return RoutingSettings._(
      stairsSaveMs: _readMilliseconds(
        values[stairsSaveSKey],
        defaultStairsSaveS,
      ),
      otherWayMarginMs: _readMilliseconds(
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
  /// publishes it, as L87's 0.5 m of walking (P0-03 r4 AC-120, DC-39).
  static const String otherWayMarginSKey = 'routing.otherWayMarginS';

  /// The platform default of `routing.stairsSaveS`: 120 s (L170 Q4; AC-18).
  static const double defaultStairsSaveS = 120;

  /// The platform default of `routing.otherWayMarginS`: 0.417 s, the value
  /// P0-03 r4 sets for L87's 0.5 m of walking (P0-03 r4 AC-120, DC-39; AC-13,
  /// DC-11). The engine holds this number only: the walking rate and the
  /// conversion are P0-03 r4's, and no cost formula lives in the engine.
  static const double defaultOtherWayMarginS = 0.417;

  /// [stairsSaveS] in whole milliseconds: what the stairs rule compares in.
  final int stairsSaveMs;

  /// [otherWayMarginS] in whole milliseconds: what AC-13's window uses.
  final int otherWayMarginMs;

  /// Seconds of cost the no-stairs way may exceed the stairs way by and still
  /// lead (AC-16), to the millisecond.
  double get stairsSaveS => secondsOfMilliseconds(stairsSaveMs);

  /// Seconds of cost above the lead way below which no other way is offered
  /// (AC-13), to the millisecond.
  double get otherWayMarginS => secondsOfMilliseconds(otherWayMarginMs);

  static int _readMilliseconds(Object? raw, double platformDefault) {
    final double? value = switch (raw) {
      final num n => n.toDouble(),
      final String s => double.tryParse(s.trim()),
      _ => null,
    };
    final seconds = value == null || !value.isFinite || value < 0
        ? platformDefault
        : value;
    final milliseconds = wholeMilliseconds(seconds);
    return milliseconds > maxEdgeMilliseconds
        ? wholeMilliseconds(platformDefault)
        : milliseconds;
  }
}
