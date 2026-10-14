import 'dart:async';

import 'package:flutter/services.dart';

/// The channel the platform side answers on (Kotlin `LocationChannel`; the Swift side is P1-05).
const String kLocationChannelName = 'gabay/location';

/// How long one fix may take when the caller names no limit. DESIGN CHOICE (provisional, FF-4
/// AC-65): the picker shows its manual list at once and a fix only preselects, so a short wait is
/// enough; the owner may tune it.
const Duration kLocationDefaultTimeout = Duration(seconds: 10);

/// Extra time the Dart side waits beyond the platform's own timeout before it gives up on a
/// channel that never answers.
const Duration kLocationReplyGrace = Duration(seconds: 2);

/// Why no fix came. Every one leaves the manual picker working (AC-16).
enum LocationFailure {
  /// Neither the precise nor the approximate permission is held.
  permissionDenied,

  /// Location is switched off on the device.
  locationOff,

  /// No fix inside the time limit.
  timeout,

  /// The platform asked its providers and none produced a fix.
  noFix,

  /// No platform side (an iOS build before P1-05) or it failed unexpectedly (EC-39).
  channelUnavailable,

  /// The platform answered with something that is not a valid fix.
  malformedReply,
}

/// The answer to asking for the location permission. The app keeps it, a refusal is not asked
/// again (AC-58).
enum LocationPermission { granted, denied }

/// The outcome of one fix request: a fix, or an unavailable reason. Never an exception.
sealed class LocationResult {
  const LocationResult();
}

/// One fix: position in degrees and its accuracy radius in metres (the circle the venue
/// detector tests against the mall boundaries).
final class LocationFix extends LocationResult {
  const LocationFix({
    required this.latitude,
    required this.longitude,
    required this.accuracyM,
  });

  final double latitude;
  final double longitude;
  final double accuracyM;

  @override
  bool operator ==(Object other) =>
      other is LocationFix &&
      other.latitude == latitude &&
      other.longitude == longitude &&
      other.accuracyM == accuracyM;

  @override
  int get hashCode => Object.hash(latitude, longitude, accuracyM);

  @override
  String toString() =>
      'LocationFix($latitude, $longitude, accuracy $accuracyM m)';
}

/// No fix, and why.
final class LocationUnavailable extends LocationResult {
  const LocationUnavailable(this.reason);

  final LocationFailure reason;

  @override
  bool operator ==(Object other) =>
      other is LocationUnavailable && other.reason == reason;

  @override
  int get hashCode => reason.hashCode;

  @override
  String toString() => 'LocationUnavailable(${reason.name})';
}

/// The location service the picker and the venue detector use. Stateless: each call is one
/// platform call. Neither method throws.
abstract interface class LocationSource {
  /// One current fix with its accuracy, within [timeout].
  Future<LocationResult> currentFix({
    Duration timeout = kLocationDefaultTimeout,
  });

  /// Asks for the while-in-use location permission (precise or approximate).
  Future<LocationPermission> requestPermission();
}

/// [LocationSource] over the `gabay/location` platform channel.
class ChannelLocationSource implements LocationSource {
  ChannelLocationSource({this.replyGrace = kLocationReplyGrace});

  static const MethodChannel _channel = MethodChannel(kLocationChannelName);

  /// Wait beyond the requested timeout for a channel that never answers.
  final Duration replyGrace;

  @override
  Future<LocationResult> currentFix({
    Duration timeout = kLocationDefaultTimeout,
  }) async {
    try {
      final Object? reply = await _channel
          .invokeMethod<Object?>('getCurrentFix', <String, Object?>{
            'timeoutMs': timeout.inMilliseconds,
          })
          .timeout(timeout + replyGrace);
      return _parseFix(reply);
    } on TimeoutException {
      return const LocationUnavailable(LocationFailure.timeout);
    } on PlatformException catch (e) {
      return LocationUnavailable(_failureForCode(e.code));
    } on Object {
      // MissingPluginException (no platform side) and anything else the channel throws (EC-39).
      return const LocationUnavailable(LocationFailure.channelUnavailable);
    }
  }

  @override
  Future<LocationPermission> requestPermission() async {
    try {
      final Object? reply = await _channel.invokeMethod<Object?>(
        'requestPermission',
      );
      return reply == 'granted'
          ? LocationPermission.granted
          : LocationPermission.denied;
    } on Object {
      return LocationPermission.denied;
    }
  }

  static LocationFailure _failureForCode(String code) => switch (code) {
    'permission_denied' => LocationFailure.permissionDenied,
    'location_off' => LocationFailure.locationOff,
    'timeout' => LocationFailure.timeout,
    'no_fix' => LocationFailure.noFix,
    _ => LocationFailure.channelUnavailable,
  };

  /// A reply is a fix only when it is a map of finite numbers inside the coordinate ranges and
  /// with a non-negative accuracy.
  static LocationResult _parseFix(Object? reply) {
    const LocationResult malformed = LocationUnavailable(
      LocationFailure.malformedReply,
    );
    if (reply is! Map) return malformed;
    final Object? latitude = reply['latitude'];
    final Object? longitude = reply['longitude'];
    final Object? accuracyM = reply['accuracyM'];
    if (latitude is! num || longitude is! num || accuracyM is! num) {
      return malformed;
    }
    final double lat = latitude.toDouble();
    final double lng = longitude.toDouble();
    final double accuracy = accuracyM.toDouble();
    final bool valid =
        lat.isFinite &&
        lng.isFinite &&
        accuracy.isFinite &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        accuracy >= 0;
    return valid
        ? LocationFix(latitude: lat, longitude: lng, accuracyM: accuracy)
        : malformed;
  }
}
