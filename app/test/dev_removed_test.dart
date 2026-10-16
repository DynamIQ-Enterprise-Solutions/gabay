import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The development stand-in is gone from the app (SEC-3 AC-49, AC-50): the
/// switcher, the `X-Dev-Act-As` header, the "Development build: no sign-in"
/// banner and their keys. A scan, so a later slice cannot bring any of it back
/// by accident. (Earlier changelog bullets are history and stay; a test may name
/// a removed thing to assert its absence, so only `app/lib` and the ARB are
/// scanned.)
void main() {
  const forbidden = [
    'X-Dev-Act-As',
    'DEV_STUB',
    'devStub',
    'dev_switcher',
    'Development build',
  ];

  final libFiles = [
    for (final entity in Directory('lib').listSync(recursive: true))
      if (entity is File && entity.path.endsWith('.dart')) entity,
  ];

  test('the scan sees the app', () {
    expect(libFiles.length, greaterThan(80));
  });

  test('no file under app/lib names a removed thing', () {
    for (final file in libFiles) {
      final text = file.readAsStringSync();
      for (final word in forbidden) {
        expect(
          text.contains(word),
          isFalse,
          reason: '${file.path} still mentions "$word"',
        );
      }
    }
  });

  test('the removed files and folders do not exist', () {
    for (final path in [
      'lib/features/dev_switcher',
      'lib/core/config/dev_act_as.dart',
      'lib/core/config/dev_act_as_provider.dart',
      'lib/core/config/dev_stub_provider.dart',
      'lib/core/services/dev_act_as_store.dart',
      'lib/shared/components/dev_stub_banner.dart',
    ]) {
      expect(
        FileSystemEntity.typeSync(path),
        FileSystemEntityType.notFound,
        reason: path,
      );
    }
  });

  test('the ApiClient has no act-as header or provider, and AppConfig no DEV_STUB define', () {
    final client = File('lib/core/network/api_client.dart').readAsStringSync();
    expect(client, isNot(contains('actAsProvider')));
    expect(client, isNot(contains('kDevActAsHeader')));
    final config = File('lib/core/config/app_config.dart').readAsStringSync();
    expect(config, isNot(contains('devStubDefine')));
    expect(config, isNot(contains('showsDevStubBanner')));
  });

  group('the ARB (AC-50)', () {
    final arb =
        jsonDecode(File('lib/l10n/app_en.arb').readAsStringSync())
            as Map<String, Object?>;
    final messages = {
      for (final entry in arb.entries)
        if (!entry.key.startsWith('@')) entry.key: entry.value! as String,
    };

    test('the keys of the banner, the switcher and the sign-in note are gone', () {
      for (final key in messages.keys) {
        expect(
          RegExp(
            r'^(devStubBanner|devSwitcher|devAccount|adminSignInPending|moduleNote)',
          ).hasMatch(key),
          isFalse,
          reason: key,
        );
      }
    });

    test('no value outside the earlier changelog bullets names a removed thing', () {
      for (final entry in messages.entries) {
        // `changelogAdmin_e002_a` and `_e003_a` are history: they stay.
        if (RegExp(r'^changelog(Admin|Mobile)_e00[0-9]_').hasMatch(entry.key)) {
          continue;
        }
        for (final word in forbidden) {
          expect(
            entry.value.contains(word),
            isFalse,
            reason: '${entry.key} says "$word"',
          );
        }
      }
    });

    test('the three texts that moved kept their wording', () {
      expect(messages['tenantSwitcherLabel'], 'Tenant (mall operator)');
      expect(messages['tenantSwitcherNone'], 'No tenant');
      expect(messages['sessionLoading'], 'Loading your account');
    });
  });
}
