import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/theme/gabay_tokens.dart';

/// P0-11 r3 AC-77 and AC-136 (finishes are keys; the colours come from the
/// tokens, rule 6): every key of both sets has a light and a dark colour, each
/// key its own, and the two themes differ. A new key without a colour fails
/// here (and the switch over the enum refuses to compile).
void main() {
  for (final brightness in Brightness.values) {
    test('every FloorFinish key has a colour in ${brightness.name}, each its own', () {
      final colours = [
        for (final key in FloorFinish.values) MapFinishTokens.floor(key, brightness),
      ];
      expect(colours.length, FloorFinish.values.length);
      expect(colours.toSet().length, colours.length, reason: 'no two keys share a colour');
      for (final colour in colours) {
        expect((colour.a * 255).round(), 255, reason: 'opaque');
      }
    });

    test('every ItemFinish key has a colour in ${brightness.name}, each its own', () {
      final colours = [
        for (final key in ItemFinish.values) MapFinishTokens.item(key, brightness),
      ];
      expect(colours.length, ItemFinish.values.length);
      expect(colours.toSet().length, colours.length);
    });
  }

  test('the sets are the 6 floor and 10 item keys of closed-sets.json', () {
    expect(FloorFinish.values.length, 6);
    expect(ItemFinish.values.length, 10);
  });

  test('light and dark are different colours for every key', () {
    for (final key in FloorFinish.values) {
      expect(
        MapFinishTokens.floor(key, Brightness.light),
        isNot(MapFinishTokens.floor(key, Brightness.dark)),
        reason: key.code,
      );
    }
    for (final key in ItemFinish.values) {
      expect(
        MapFinishTokens.item(key, Brightness.light),
        isNot(MapFinishTokens.item(key, Brightness.dark)),
        reason: key.code,
      );
    }
  });

  test('a floor reads as lighter than its dark-theme twin (light theme is the light one)', () {
    for (final key in FloorFinish.values) {
      final light = MapFinishTokens.floor(key, Brightness.light).computeLuminance();
      final dark = MapFinishTokens.floor(key, Brightness.dark).computeLuminance();
      expect(light, greaterThan(dark), reason: key.code);
    }
  });
}
