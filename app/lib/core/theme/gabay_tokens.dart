import 'package:flutter/material.dart';

/// Design tokens as a [ThemeExtension] (standard §4.7).
///
/// THIS IS THE ONLY FILE IN `lib/` ALLOWED TO HOLD COLOUR LITERALS. Everywhere
/// else use `Theme.of(context).colorScheme.*` or
/// `Theme.of(context).extension<GabayTokens>()`. A literal anywhere else is a
/// defect (rule 6; the colour-literals linter in slice S4 enforces it).
///
/// The tokens cover what `ColorScheme` has no slot for: success, warning and
/// info status colours, and the 3D map's five surfaces. Status is never
/// colour alone: pair each with an icon and a label.
@immutable
class GabayTokens extends ThemeExtension<GabayTokens> {
  const GabayTokens({
    required this.successContainer,
    required this.onSuccessContainer,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.infoContainer,
    required this.onInfoContainer,
    required this.mapGround,
    required this.mapFloor,
    required this.mapWall,
    required this.mapStore,
    required this.mapItem,
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

  /// The 3D map's surfaces (spec/P0-04.md r4 AC-84; plan/V3D-spike.md 1.0
  /// DC-V11). Provisional until stage V. Each face is this colour made
  /// lighter or darker by its turn to the map's one light
  /// (core/map3d/shading.dart).
  ///
  /// The ground around the drawn level: the backdrop of the single-level
  /// view, and the outdoor ground of the whole-site view.
  final Color mapGround;

  /// The level's floor and its walkable units.
  final Color mapFloor;

  /// Explicit walls.
  final Color mapWall;

  /// Store volumes and every other non-walkable unit.
  final Color mapStore;

  /// Items: columns, kiosks, furniture.
  final Color mapItem;

  static const GabayTokens light = GabayTokens(
    successContainer: Color(0xFFC8EFD3),
    onSuccessContainer: Color(0xFF0A3D1E),
    warningContainer: Color(0xFFFFDDB0),
    onWarningContainer: Color(0xFF4A2B00),
    infoContainer: Color(0xFFD2E5FF),
    onInfoContainer: Color(0xFF0A2E52),
    mapGround: Color(0xFFE4DED8),
    mapFloor: Color(0xFFFAF7F3),
    mapWall: Color(0xFF8A7568),
    mapStore: Color(0xFFE2D5C8),
    mapItem: Color(0xFFB09A8A),
  );

  static const GabayTokens dark = GabayTokens(
    successContainer: Color(0xFF1B4D2F),
    onSuccessContainer: Color(0xFFBFEBCB),
    warningContainer: Color(0xFF5C3900),
    onWarningContainer: Color(0xFFFFDDB0),
    infoContainer: Color(0xFF1D4A78),
    onInfoContainer: Color(0xFFD2E5FF),
    mapGround: Color(0xFF0F0D0C),
    mapFloor: Color(0xFF1E1A17),
    mapWall: Color(0xFFA38D7D),
    mapStore: Color(0xFF5E5047),
    mapItem: Color(0xFF7C6A5D),
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
    Color? mapGround,
    Color? mapFloor,
    Color? mapWall,
    Color? mapStore,
    Color? mapItem,
  }) => GabayTokens(
    successContainer: successContainer ?? this.successContainer,
    onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
    warningContainer: warningContainer ?? this.warningContainer,
    onWarningContainer: onWarningContainer ?? this.onWarningContainer,
    infoContainer: infoContainer ?? this.infoContainer,
    onInfoContainer: onInfoContainer ?? this.onInfoContainer,
    mapGround: mapGround ?? this.mapGround,
    mapFloor: mapFloor ?? this.mapFloor,
    mapWall: mapWall ?? this.mapWall,
    mapStore: mapStore ?? this.mapStore,
    mapItem: mapItem ?? this.mapItem,
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
      mapGround: Color.lerp(mapGround, other.mapGround, t)!,
      mapFloor: Color.lerp(mapFloor, other.mapFloor, t)!,
      mapWall: Color.lerp(mapWall, other.mapWall, t)!,
      mapStore: Color.lerp(mapStore, other.mapStore, t)!,
      mapItem: Color.lerp(mapItem, other.mapItem, t)!,
    );
  }
}
