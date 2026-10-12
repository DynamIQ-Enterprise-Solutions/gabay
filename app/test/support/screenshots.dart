import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Test-rendered screenshots (L121), shared by the screenshot tests added from
/// FF-SK on. `flutter test <file> --dart-define=SHOTS_OUT=DIR` writes the PNGs;
/// without SHOTS_OUT the tests still run and write nothing.
///
/// Fonts: `flutter test` draws text with a blocky placeholder font. For
/// readable screenshots the test loads Roboto and the Material icon font from
/// the Flutter SDK's own bundled material fonts, found through FLUTTER_ROOT. No
/// font asset is added to the app and no package is used.
const String shotsOut = String.fromEnvironment('SHOTS_OUT');

bool get writingShots => shotsOut.isNotEmpty;

/// The two device sizes every screen change is shot at (logical px).
const Map<String, Size> shotDevices = {
  'phone': Size(390, 844),
  'tablet': Size(1024, 1366),
};

Future<void> _loadFont(String family, List<String> files) async {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final loader = FontLoader(family);
  for (final name in files) {
    final file = File('$root/bin/cache/artifacts/material_fonts/$name');
    if (file.existsSync()) {
      final bytes = file.readAsBytesSync();
      loader.addFont(Future<ByteData>.value(ByteData.sublistView(bytes)));
    }
  }
  await loader.load();
}

/// Loads Roboto and the Material icons when screenshots are being written.
Future<void> loadShotFonts() async {
  if (!writingShots) return;
  await _loadFont('Roboto', [
    'roboto-regular.ttf',
    'roboto-medium.ttf',
    'roboto-bold.ttf',
    'roboto-light.ttf',
  ]);
  await _loadFont('MaterialIcons', ['materialicons-regular.otf']);
}

/// Writes the PNG of what [boundaryKey]'s boundary shows to `SHOTS_OUT/name.png`
/// (nothing when screenshots are not being written).
Future<void> saveShot(
  WidgetTester tester,
  GlobalKey boundaryKey,
  String name,
) async {
  if (!writingShots) return;
  await tester.runAsync(() async {
    final boundary =
        boundaryKey.currentContext!.findRenderObject()!
            as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    final dir = Directory(shotsOut)..createSync(recursive: true);
    File('${dir.path}/$name.png').writeAsBytesSync(data!.buffer.asUint8List());
  });
}
