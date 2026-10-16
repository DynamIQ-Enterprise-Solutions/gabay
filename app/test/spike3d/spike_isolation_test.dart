import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The spike stays out of every shipped build, and the map stays offline and
/// free of new packages (plan/V3D-spike.md 1.0 §1, step 7; P0-04 r4 AC-90,
/// AC-91; L102):
/// - only `main_spike3d.dart` and `lib/spike3d/**` import `spike3d/`;
/// - nothing under `app/lib` imports `package:vector_math`, a web view or
///   three.js;
/// - nothing in `map3d/` or `spike3d/` imports `dio`, the API client or any
///   network code.
/// The `pubspec.yaml` and `pubspec.lock` diffs are checked in review.
void main() {
  final lib = Directory('lib');
  final files = lib
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();
  final importLine = RegExp(
    r'''^\s*(?:import|export)\s+['"]([^'"]+)['"]''',
    multiLine: true,
  );

  /// Every file's imports, resolved to `lib/`-relative paths (or the
  /// package or `dart:` URI itself).
  final imports = <String, List<String>>{
    for (final f in files)
      _libPath(f.path): [
        for (final m in importLine.allMatches(f.readAsStringSync()))
          _resolve(_libPath(f.path), m.group(1)!),
      ],
  };

  test('the walk found the app, the spike and the map', () {
    expect(imports.keys, contains('main_mobile.dart'));
    expect(imports.keys, contains('main_admin.dart'));
    expect(imports.keys, contains('main_spike3d.dart'));
    expect(imports.keys.where((k) => k.startsWith('spike3d/')), isNotEmpty);
    expect(imports.keys.where((k) => k.startsWith('core/map3d/')), isNotEmpty);
  });

  test('only main_spike3d.dart and lib/spike3d import the spike', () {
    final offenders = [
      for (final e in imports.entries)
        if (e.key != 'main_spike3d.dart' && !e.key.startsWith('spike3d/'))
          for (final i in e.value)
            if (i.startsWith('spike3d/')) '${e.key} -> $i',
    ];
    expect(offenders, isEmpty);
  });

  test('main_mobile.dart and main_admin.dart reach no spike file', () {
    for (final entry in ['main_mobile.dart', 'main_admin.dart']) {
      final seen = <String>{};
      final todo = [entry];
      while (todo.isNotEmpty) {
        final next = todo.removeLast();
        if (!seen.add(next)) continue;
        todo.addAll((imports[next] ?? const []).where(imports.containsKey));
      }
      expect(seen.where((f) => f.startsWith('spike3d/')), isEmpty);
      expect(seen, isNot(contains('main_spike3d.dart')));
    }
  });

  test('nothing under app/lib imports vector_math, a web view or three.js', () {
    final banned = RegExp(r'^package:(vector_math|webview\w*|three\w*)/');
    final offenders = [
      for (final e in imports.entries)
        for (final i in e.value)
          if (banned.hasMatch(i)) '${e.key} -> $i',
    ];
    expect(offenders, isEmpty);
  });

  test('map3d and spike3d import no network code (AC-90)', () {
    final network = RegExp(
      r'^(package:(dio|http|web_socket_channel)/|core/network/|dart:io$)',
    );
    final offenders = [
      for (final e in imports.entries)
        if (e.key.startsWith('core/map3d/') || e.key.startsWith('spike3d/'))
          for (final i in e.value)
            if (network.hasMatch(i) && !_memorySamplerReadsProcessInfo(e, i))
              '${e.key} -> $i',
    ];
    expect(offenders, isEmpty);
  });
}

/// The memory sampler imports `dart:io` for `ProcessInfo` only (step 0 row
/// 5); it names nothing that talks to a network.
bool _memorySamplerReadsProcessInfo(
  MapEntry<String, List<String>> e,
  String import,
) {
  if (e.key != 'spike3d/memory_sampler.dart' || import != 'dart:io') {
    return false;
  }
  final source = File('lib/${e.key}').readAsStringSync();
  return source.contains("import 'dart:io' show ProcessInfo;");
}

/// A file's path relative to lib/, with forward slashes.
String _libPath(String path) {
  final unix = path.replaceAll(r'\', '/');
  return unix.substring(unix.indexOf('lib/') + 'lib/'.length);
}

String _resolve(String from, String uri) {
  const self = 'package:gabay/';
  if (uri.startsWith(self)) return uri.substring(self.length);
  if (uri.contains(':')) return uri;
  final parts = from.split('/')..removeLast();
  for (final segment in uri.split('/')) {
    if (segment == '..') {
      parts.removeLast();
    } else if (segment != '.') {
      parts.add(segment);
    }
  }
  return parts.join('/');
}
