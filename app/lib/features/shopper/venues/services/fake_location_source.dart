import 'location_source.dart';

/// A [LocationSource] for tests (the venue picker and the venue detector): answers what it was
/// given, counts the asks and keeps the last timeout it was handed. With nothing configured it
/// behaves like a missing channel.
class FakeLocationSource implements LocationSource {
  FakeLocationSource({
    this.result = const LocationUnavailable(LocationFailure.channelUnavailable),
    this.permission = LocationPermission.denied,
  });

  /// What [currentFix] returns next; change it between calls.
  LocationResult result;

  /// What [requestPermission] returns next.
  LocationPermission permission;

  /// How many times [currentFix] was called.
  int fixCalls = 0;

  /// How many times [requestPermission] was called.
  int permissionAsks = 0;

  /// The timeout of the latest [currentFix] call.
  Duration? lastTimeout;

  @override
  Future<LocationResult> currentFix({
    Duration timeout = kLocationDefaultTimeout,
  }) async {
    fixCalls++;
    lastTimeout = timeout;
    return result;
  }

  @override
  Future<LocationPermission> requestPermission() async {
    permissionAsks++;
    return permission;
  }
}
