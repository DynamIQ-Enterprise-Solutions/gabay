import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import 'scene.dart';

/// The box everything drawn on a level lies in: what the camera frames at
/// zoom 1 and what its planes must cover (P0-04 r4 AC-83, EC-69).
@immutable
class ViewExtent {
  const ViewExtent({
    required this.minX,
    required this.maxX,
    required this.minZ,
    required this.maxZ,
    required this.floorY,
    required this.topY,
  });

  /// The extent of a built scene.
  factory ViewExtent.ofScene(Scene scene) => ViewExtent(
    minX: scene.minX,
    maxX: scene.maxX,
    minZ: scene.minZ,
    maxZ: scene.maxZ,
    floorY: scene.floorY,
    topY: scene.maxY,
  );

  final double minX;
  final double maxX;
  final double minZ;
  final double maxZ;

  /// The level's elevation: the plane taps are met with (AC-38).
  final double floorY;

  /// The highest point drawn.
  final double topY;

  double get centreX => (minX + maxX) / 2;
  double get centreZ => (minZ + maxZ) / 2;

  /// Half the horizontal diagonal: the radius of the circle the level fits in.
  double get horizontalRadius {
    final dx = maxX - minX;
    final dz = maxZ - minZ;
    return math.sqrt(dx * dx + dz * dz) / 2;
  }

  /// The box's full diagonal, height included.
  double get diagonal {
    final dx = maxX - minX;
    final dz = maxZ - minZ;
    final dy = topY - floorY;
    return math.sqrt(dx * dx + dz * dz + dy * dy);
  }
}
