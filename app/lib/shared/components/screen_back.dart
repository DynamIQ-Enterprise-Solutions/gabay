import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Where an admin screen's back arrow goes: [path], by `context.go` (never
/// `pop`), so the address bar stays honest even when the screen was opened from
/// a link (standard 4.6; FF-1 plan 3.1). [label] is the arrow's screen-reader
/// name and tooltip (ARB).
class ScreenBack {
  const ScreenBack({required this.path, required this.label});

  final String path;
  final String label;

  /// The app bar's leading button.
  Widget button(BuildContext context) => IconButton(
    icon: const Icon(Icons.arrow_back),
    tooltip: label,
    onPressed: () => context.go(path),
  );
}
