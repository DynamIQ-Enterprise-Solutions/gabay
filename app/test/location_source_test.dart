// FF-4, AC-65 (Dart side against a fake channel), EC-39 (a missing channel or
// a platform error is "unavailable", never a throw), AC-16 (every failure
// leaves a manual picker), AC-58 (the permission ask).
//
// Written before the code (plan/FF-4-shell-routing.md section 10 step 3).
// DESIGN CHOICE (the plan names only `location_source.dart` and "a fake"):
// the files are
//   lib/features/shopper/venues/services/location_source.dart
//   lib/features/shopper/venues/services/fake_location_source.dart
// and the channel contract is
//   channel `gabay/location`
//   `getCurrentFix` {timeoutMs: int} -> {latitude, longitude, accuracyM} (numbers)
//     PlatformException codes: permission_denied, location_off, timeout, no_fix
//   `requestPermission` -> 'granted' | 'denied'

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/shopper/venues/services/fake_location_source.dart';
import 'package:gabay/features/shopper/venues/services/location_source.dart';

const MethodChannel _channel = MethodChannel('gabay/location');

TestDefaultBinaryMessenger get _messenger =>
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

void _reply(Future<Object?> Function(MethodCall call) handler) {
  _messenger.setMockMethodCallHandler(_channel, handler);
}

Map<String, Object?> _fixMap({
  Object? latitude = 14.5547,
  Object? longitude = 121.0244,
  Object? accuracyM = 12.5,
}) => {'latitude': latitude, 'longitude': longitude, 'accuracyM': accuracyM};

LocationSource _source({Duration grace = Duration.zero}) =>
    ChannelLocationSource(replyGrace: grace);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() => _messenger.setMockMethodCallHandler(_channel, null));

  group('currentFix: the one-shot fix (AC-65)', () {
    test('returns latitude, longitude and accuracy', () async {
      _reply((_) async => _fixMap());
      final result = await _source().currentFix();
      expect(result, isA<LocationFix>());
      final fix = result as LocationFix;
      expect(fix.latitude, 14.5547);
      expect(fix.longitude, 121.0244);
      expect(fix.accuracyM, 12.5);
    });

    test('whole numbers in the reply are accepted as numbers', () async {
      _reply((_) async => _fixMap(latitude: 14, longitude: 121, accuracyM: 8));
      final fix = await _source().currentFix() as LocationFix;
      expect(fix.latitude, 14.0);
      expect(fix.longitude, 121.0);
      expect(fix.accuracyM, 8.0);
    });

    test('calls getCurrentFix once, with the timeout in milliseconds', () async {
      final calls = <MethodCall>[];
      _reply((call) async {
        calls.add(call);
        return _fixMap();
      });
      await _source().currentFix(timeout: const Duration(seconds: 7));
      expect(calls, hasLength(1));
      expect(calls.single.method, 'getCurrentFix');
      expect((calls.single.arguments as Map)['timeoutMs'], 7000);
    });

    test('the default timeout is a named constant, sent when none is given',
        () async {
      final calls = <MethodCall>[];
      _reply((call) async {
        calls.add(call);
        return _fixMap();
      });
      await _source().currentFix();
      expect((calls.single.arguments as Map)['timeoutMs'],
          kLocationDefaultTimeout.inMilliseconds);
      expect(kLocationDefaultTimeout, greaterThan(Duration.zero));
    });

    test('two calls are two channel calls (the service keeps no state)',
        () async {
      var n = 0;
      _reply((_) async => _fixMap(latitude: 14.0 + n++));
      final a = await _source().currentFix() as LocationFix;
      final b = await _source().currentFix() as LocationFix;
      expect(a.latitude, 14.0);
      expect(b.latitude, 15.0);
    });
  });

  group('currentFix: failures become "unavailable" with a reason '
      '(AC-16, EC-39)', () {
    Future<void> expectFailure(
      Future<Object?> Function(MethodCall) handler,
      LocationFailure reason,
    ) async {
      _reply(handler);
      final result = await _source().currentFix();
      expect(result, isA<LocationUnavailable>());
      expect((result as LocationUnavailable).reason, reason);
    }

    for (final entry in {
      'permission_denied': LocationFailure.permissionDenied,
      'location_off': LocationFailure.locationOff,
      'timeout': LocationFailure.timeout,
      'no_fix': LocationFailure.noFix,
    }.entries) {
      test('platform code ${entry.key} -> ${entry.value.name}', () async {
        await expectFailure(
          (_) async => throw PlatformException(code: entry.key),
          entry.value,
        );
      });
    }

    test('an unknown platform code is a channel failure, not a throw (EC-39)',
        () async {
      await expectFailure(
        (_) async => throw PlatformException(code: 'boom', message: 'x'),
        LocationFailure.channelUnavailable,
      );
    });

    test('a missing channel (no handler: an iOS build before P1-05) (EC-39)',
        () async {
      // No handler registered: the binding answers with MissingPluginException.
      final result = await _source().currentFix();
      expect(result, isA<LocationUnavailable>());
      expect((result as LocationUnavailable).reason,
          LocationFailure.channelUnavailable);
    });

    test('an explicit MissingPluginException is a channel failure (EC-39)',
        () async {
      await expectFailure(
        (_) async => throw MissingPluginException(),
        LocationFailure.channelUnavailable,
      );
    });

    test('a channel that never answers ends as a timeout after the grace',
        () async {
      final never = Completer<Object?>();
      _reply((_) => never.future);
      final result = await ChannelLocationSource(replyGrace: Duration.zero)
          .currentFix(timeout: const Duration(milliseconds: 20));
      expect(result, isA<LocationUnavailable>());
      expect((result as LocationUnavailable).reason, LocationFailure.timeout);
    });

    group('a malformed reply is malformedReply', () {
      final bad = <String, Object?>{
        'null reply': null,
        'a string': 'here',
        'a list': [14.5, 121.0, 10.0],
        'an empty map': <String, Object?>{},
        'latitude missing': {'longitude': 121.0, 'accuracyM': 10.0},
        'longitude missing': {'latitude': 14.5, 'accuracyM': 10.0},
        'accuracy missing': {'latitude': 14.5, 'longitude': 121.0},
        'latitude a string': _fixMap(latitude: '14.5'),
        'longitude null': _fixMap(longitude: null),
        'accuracy a bool': _fixMap(accuracyM: true),
        'latitude NaN': _fixMap(latitude: double.nan),
        'longitude infinite': _fixMap(longitude: double.infinity),
        'accuracy NaN': _fixMap(accuracyM: double.nan),
        'latitude above 90': _fixMap(latitude: 90.5),
        'latitude below -90': _fixMap(latitude: -90.5),
        'longitude above 180': _fixMap(longitude: 180.5),
        'longitude below -180': _fixMap(longitude: -180.5),
        'accuracy negative': _fixMap(accuracyM: -1),
      };
      for (final entry in bad.entries) {
        test(entry.key, () async {
          await expectFailure(
            (_) async => entry.value,
            LocationFailure.malformedReply,
          );
        });
      }
    });

    test('the edges of the ranges are valid fixes', () async {
      _reply((_) async => _fixMap(latitude: -90, longitude: 180, accuracyM: 0));
      final result = await _source().currentFix();
      expect(result, isA<LocationFix>());
    });

    test('currentFix never throws, whatever the channel throws', () async {
      _reply((_) async => throw StateError('anything'));
      final result = await _source().currentFix();
      expect(result, isA<LocationUnavailable>());
    });
  });

  group('requestPermission (AC-58: the caller keeps the answer)', () {
    test('granted', () async {
      final calls = <MethodCall>[];
      _reply((call) async {
        calls.add(call);
        return 'granted';
      });
      expect(await _source().requestPermission(), LocationPermission.granted);
      expect(calls.single.method, 'requestPermission');
    });

    test('denied', () async {
      _reply((_) async => 'denied');
      expect(await _source().requestPermission(), LocationPermission.denied);
    });

    test('anything else, a platform error or no channel is denied, never a '
        'throw (EC-39)', () async {
      _reply((_) async => 'maybe');
      expect(await _source().requestPermission(), LocationPermission.denied);
      _reply((_) async => null);
      expect(await _source().requestPermission(), LocationPermission.denied);
      _reply((_) async => throw PlatformException(code: 'boom'));
      expect(await _source().requestPermission(), LocationPermission.denied);
      _messenger.setMockMethodCallHandler(_channel, null);
      expect(await _source().requestPermission(), LocationPermission.denied);
    });
  });

  group('FakeLocationSource (what the picker and detector tests use)', () {
    test('returns the fix it was given and counts the calls', () async {
      final fake = FakeLocationSource(
        result: const LocationFix(
          latitude: 14.5,
          longitude: 121.0,
          accuracyM: 20,
        ),
      );
      final r = await fake.currentFix(timeout: const Duration(seconds: 3));
      expect((r as LocationFix).accuracyM, 20);
      expect(fake.fixCalls, 1);
      expect(fake.lastTimeout, const Duration(seconds: 3));
    });

    test('can be set to every failure', () async {
      for (final reason in LocationFailure.values) {
        final fake = FakeLocationSource(result: LocationUnavailable(reason));
        final r = await fake.currentFix();
        expect((r as LocationUnavailable).reason, reason);
      }
    });

    test('permission answer is configurable and the asks are counted',
        () async {
      final fake = FakeLocationSource(
        result: const LocationUnavailable(LocationFailure.permissionDenied),
        permission: LocationPermission.denied,
      );
      expect(await fake.requestPermission(), LocationPermission.denied);
      expect(await fake.requestPermission(), LocationPermission.denied);
      expect(fake.permissionAsks, 2);
      fake.permission = LocationPermission.granted;
      expect(await fake.requestPermission(), LocationPermission.granted);
    });

    test('the result can change between calls', () async {
      final fake = FakeLocationSource(
        result: const LocationUnavailable(LocationFailure.noFix),
      );
      expect(await fake.currentFix(), isA<LocationUnavailable>());
      fake.result = const LocationFix(latitude: 1, longitude: 2, accuracyM: 3);
      expect(await fake.currentFix(), isA<LocationFix>());
    });

    test('is a LocationSource', () {
      expect(FakeLocationSource(), isA<LocationSource>());
    });
  });

  test('LocationFix compares by value', () {
    const a = LocationFix(latitude: 1, longitude: 2, accuracyM: 3);
    const b = LocationFix(latitude: 1, longitude: 2, accuracyM: 3);
    expect(a, b);
    expect(a.hashCode, b.hashCode);
  });
}
