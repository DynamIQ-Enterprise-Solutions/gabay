import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/core/map3d/shading.dart';
import 'package:gabay/core/theme/gabay_tokens.dart';

import 'scene_fixtures.dart';

/// Simple shading from the tokens (plan/V3D-spike.md 1.0 step 4): P0-04 r4
/// AC-84, DC-13. The colour-literals lint covers rule 6.
void main() {
  MapPalette paletteOf(GabayTokens t) => MapPalette(
    ground: t.mapGround,
    floor: t.mapFloor,
    wall: t.mapWall,
    store: t.mapStore,
    item: t.mapItem,
  );

  test('the light points up and to the north-north-west, above 45°', () {
    final l = mapLightDirection;
    expect(l[0] * l[0] + l[1] * l[1] + l[2] * l[2], closeTo(1, 1e-12));
    expect(l[0], lessThan(0)); // west
    expect(l[2], lessThan(0)); // north (up the plan)
    expect(l[1], greaterThan(math.sqrt(l[0] * l[0] + l[2] * l[2])));
  });

  test('a roof reads lightest: no side face shades lighter', () {
    final roof = shadeFactor(0, 1, 0);
    for (var deg = 0; deg < 360; deg += 5) {
      final a = deg * math.pi / 180;
      expect(shadeFactor(math.sin(a), 0, -math.cos(a)), lessThan(roof));
    }
    expect(roof, lessThanOrEqualTo(1));
  });

  test('a face turned away from the light gets the ambient share only', () {
    final l = mapLightDirection;
    final h = math.sqrt(l[0] * l[0] + l[2] * l[2]);
    expect(shadeFactor(-l[0] / h, 0, -l[2] / h), MapShading.ambient);
  });

  test('two faces turned the same way read the same; the roof and the two lit '
      'sides each read differently; the sides turned away share the ambient '
      'colour', () {
    final scene = buildScene(
      levelWith(
        emptyLevel(),
        units: [room(rect(2, 2, 8, 6)), room(rect(20, 10, 30, 25))],
      ),
      volumeHeightFraction: 0.5,
    );
    final colours = shadeFaces(scene, paletteOf(GabayTokens.light));
    final byNormal = <String, Set<int>>{};
    for (var f = 0; f < scene.faceCount; f++) {
      if (scene.surfaces[f] != MapSurface.store.index) continue;
      final key = [
        for (var k = 0; k < 3; k++)
          (scene.normals[3 * f + k] + 0.0).toStringAsFixed(6),
      ].join(',');
      (byNormal[key] ??= <int>{}).add(colours[f]);
    }
    // Five turns (four sides and the roof), one colour each turn.
    expect(byNormal, hasLength(5));
    expect(byNormal.values.every((c) => c.length == 1), isTrue);
    String key(double x, double y, double z) =>
        [x, y, z].map((v) => (v + 0.0).toStringAsFixed(6)).join(',');
    final roof = byNormal[key(0, 1, 0)]!.single;
    final north = byNormal[key(0, 0, -1)]!.single;
    final west = byNormal[key(-1, 0, 0)]!.single;
    final south = byNormal[key(0, 0, 1)]!.single;
    final east = byNormal[key(1, 0, 0)]!.single;
    expect({roof, north, west, south}, hasLength(4));
    // South and east both face away from the light: ambient only (AC-84).
    expect(east, south);
  });

  test('shading scales red, green and blue and keeps alpha', () {
    expect(shadeArgb(0xFF808080, 0.5), 0xFF404040);
    expect(shadeArgb(0x80FF0000, 0.5), 0x80800000);
    expect(shadeArgb(0xFFFFFFFF, 1), 0xFFFFFFFF);
    expect(shadeArgb(0xFF0A0B0C, 0), 0xFF000000);
  });

  test("every face's colour is its surface's token, shaded, in light and "
      'dark', () {
    final scene = buildScene(
      levelWith(
        emptyLevel(),
        walls: [wall(0, 20, 10, 20)],
        units: [room(rect(2, 2, 8, 6))],
        items: [item(x: 30, z: 20)],
      ),
      volumeHeightFraction: 0.5,
    );
    for (final tokens in [GabayTokens.light, GabayTokens.dark]) {
      final palette = paletteOf(tokens);
      final colours = shadeFaces(scene, palette);
      final token = <MapSurface, Color>{
        MapSurface.floor: tokens.mapFloor,
        MapSurface.wall: tokens.mapWall,
        MapSurface.store: tokens.mapStore,
        MapSurface.item: tokens.mapItem,
      };
      for (var f = 0; f < scene.faceCount; f++) {
        final surface = MapSurface.values[scene.surfaces[f]];
        final factor = shadeFactor(
          scene.normals[3 * f],
          scene.normals[3 * f + 1],
          scene.normals[3 * f + 2],
        );
        expect(
          colours[f] & 0xFFFFFFFF,
          shadeArgb(token[surface]!.toARGB32(), factor),
        );
      }
      expect(palette.argbOf(MapSurface.ground), tokens.mapGround.toARGB32());
    }
  });

  test('light and dark map tokens differ, and lerp between them', () {
    const light = GabayTokens.light;
    const dark = GabayTokens.dark;
    expect(light.mapStore, isNot(dark.mapStore));
    expect(light.lerp(dark, 0).mapWall, light.mapWall);
    expect(light.lerp(dark, 1).mapWall, dark.mapWall);
    expect(light.copyWith(mapItem: dark.mapItem).mapItem, dark.mapItem);
    expect(paletteOf(light), paletteOf(GabayTokens.light));
    expect(paletteOf(light) == paletteOf(dark), isFalse);
  });
}
