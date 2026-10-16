import 'package:flutter/material.dart';

import '../config/closed_sets.dart';

/// Design tokens as a [ThemeExtension] (standard §4.7).
///
/// THIS IS THE ONLY FILE IN `lib/` ALLOWED TO HOLD COLOUR LITERALS. Everywhere
/// else use `Theme.of(context).colorScheme.*` or
/// `Theme.of(context).extension<GabayTokens>()`. A literal anywhere else is a
/// defect (rule 6; the colour-literals linter in slice S4 enforces it).
///
/// The tokens cover what `ColorScheme` has no slot for: success, warning and
/// info status colours. Status is never colour alone: pair each with an icon
/// and a label.
@immutable
class GabayTokens extends ThemeExtension<GabayTokens> {
  const GabayTokens({
    required this.successContainer,
    required this.onSuccessContainer,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.infoContainer,
    required this.onInfoContainer,
  });

  /// Terracotta. Placeholder brand colour until the Gabay or Dynamiq brand
  /// colour is known (plan.html L123). The user-selectable "Gabay /
  /// Terracotta" setting is P0-14, not Phase 1.
  static const Color seed = Color(0xFFC1623D);

  final Color successContainer;
  final Color onSuccessContainer;
  final Color warningContainer;
  final Color onWarningContainer;
  final Color infoContainer;
  final Color onInfoContainer;

  static const GabayTokens light = GabayTokens(
    successContainer: Color(0xFFC8EFD3),
    onSuccessContainer: Color(0xFF0A3D1E),
    warningContainer: Color(0xFFFFDDB0),
    onWarningContainer: Color(0xFF4A2B00),
    infoContainer: Color(0xFFD2E5FF),
    onInfoContainer: Color(0xFF0A2E52),
  );

  static const GabayTokens dark = GabayTokens(
    successContainer: Color(0xFF1B4D2F),
    onSuccessContainer: Color(0xFFBFEBCB),
    warningContainer: Color(0xFF5C3900),
    onWarningContainer: Color(0xFFFFDDB0),
    infoContainer: Color(0xFF1D4A78),
    onInfoContainer: Color(0xFFD2E5FF),
  );

  /// The tokens for [brightness].
  static GabayTokens forBrightness(Brightness brightness) =>
      brightness == Brightness.dark ? dark : light;

  /// Convenience for views: `GabayTokens.of(context).successContainer`.
  static GabayTokens of(BuildContext context) =>
      Theme.of(context).extension<GabayTokens>()!;

  @override
  GabayTokens copyWith({
    Color? successContainer,
    Color? onSuccessContainer,
    Color? warningContainer,
    Color? onWarningContainer,
    Color? infoContainer,
    Color? onInfoContainer,
  }) => GabayTokens(
    successContainer: successContainer ?? this.successContainer,
    onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
    warningContainer: warningContainer ?? this.warningContainer,
    onWarningContainer: onWarningContainer ?? this.onWarningContainer,
    infoContainer: infoContainer ?? this.infoContainer,
    onInfoContainer: onInfoContainer ?? this.onInfoContainer,
  );

  @override
  GabayTokens lerp(ThemeExtension<GabayTokens>? other, double t) {
    if (other is! GabayTokens) return this;
    return GabayTokens(
      successContainer: Color.lerp(
        successContainer,
        other.successContainer,
        t,
      )!,
      onSuccessContainer: Color.lerp(
        onSuccessContainer,
        other.onSuccessContainer,
        t,
      )!,
      warningContainer: Color.lerp(
        warningContainer,
        other.warningContainer,
        t,
      )!,
      onWarningContainer: Color.lerp(
        onWarningContainer,
        other.onWarningContainer,
        t,
      )!,
      infoContainer: Color.lerp(infoContainer, other.infoContainer, t)!,
      onInfoContainer: Color.lerp(onInfoContainer, other.onInfoContainer, t)!,
    );
  }
}

/// The colour of every finish key of the venue map document (P0-11 r3 AC-77,
/// AC-136; rule 6). The document holds only the key (`FloorFinish`,
/// `ItemFinish`: OA-1 closes the sets and says each key has its own colour
/// here); the editor's canvas maps the key to the colour through these two
/// functions, light and dark. A switch over the enum has no default, so a new
/// key without a colour is a compile error, and `finish_tokens_test` walks
/// `.values` as well.
abstract final class MapFinishTokens {
  /// The fill of a floor with [key], for [brightness].
  static Color floor(FloorFinish key, Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return switch (key) {
      FloorFinish.defaultValue =>
        dark ? const Color(0xFF3B3835) : const Color(0xFFEFEAE4),
      FloorFinish.concrete =>
        dark ? const Color(0xFF4A4B4D) : const Color(0xFFD3D4D6),
      FloorFinish.tile =>
        dark ? const Color(0xFF3A4A52) : const Color(0xFFD6E6EE),
      FloorFinish.carpet =>
        dark ? const Color(0xFF52393B) : const Color(0xFFE9CFCF),
      FloorFinish.wood =>
        dark ? const Color(0xFF55412C) : const Color(0xFFE2C9A6),
      FloorFinish.vinyl =>
        dark ? const Color(0xFF3B4D3F) : const Color(0xFFD5E8D6),
    };
  }

  /// The fill of an item with finish [key], for [brightness] (OA-4a-2 draws
  /// items; the colours are defined here with the floors so the sets are whole).
  static Color item(ItemFinish key, Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return switch (key) {
      ItemFinish.defaultValue =>
        dark ? const Color(0xFF6B6560) : const Color(0xFFB9B0A6),
      ItemFinish.white =>
        dark ? const Color(0xFFD9D9D9) : const Color(0xFFFAFAFA),
      ItemFinish.oak =>
        dark ? const Color(0xFF9A7B4F) : const Color(0xFFC9A66B),
      ItemFinish.walnut =>
        dark ? const Color(0xFF6B4A33) : const Color(0xFF7A5238),
      ItemFinish.charcoal =>
        dark ? const Color(0xFF2B2B2D) : const Color(0xFF3A3A3D),
      ItemFinish.grey =>
        dark ? const Color(0xFF8A8C8F) : const Color(0xFF9EA1A5),
      ItemFinish.blue =>
        dark ? const Color(0xFF3F6FB0) : const Color(0xFF5B8FD6),
      ItemFinish.green =>
        dark ? const Color(0xFF3F8A55) : const Color(0xFF5BAE76),
      ItemFinish.red =>
        dark ? const Color(0xFFB04A4A) : const Color(0xFFD66B6B),
      ItemFinish.yellow =>
        dark ? const Color(0xFFB8963A) : const Color(0xFFE6C25A),
    };
  }
}
