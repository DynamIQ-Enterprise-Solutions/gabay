import 'package:flutter/widgets.dart';

/// The widget keys of the map editor (plan 3 contract commit): what the tests
/// and the manual cases find a control by. A key is a name, never wording.
abstract final class EditorKeys {
  static const Key canvas = ValueKey('editor-canvas');
  static Key tool(String id) => ValueKey('tool-$id');
  static Key floorTab(String levelId) => ValueKey('floor-tab-$levelId');
  static const Key saveState = ValueKey('save-state');
  static const Key undo = ValueKey('undo');
  static const Key redo = ValueKey('redo');
  static const Key publish = ValueKey('publish');
  static const Key conflictBanner = ValueKey('conflict-banner');
  static const Key reload = ValueKey('reload');
  static const Key tryAgain = ValueKey('try-again');
  static Key problem(int index) => ValueKey('problem-$index');
  static Key panel(String kind) => ValueKey('panel-$kind');
  static const Key addFloor = ValueKey('add-floor');
  static const Key blankStart = ValueKey('blank-start');
  static const Key blankStartSubmit = ValueKey('blank-start-submit');
  static const Key publishingBanner = ValueKey('publishing-banner');
  static const Key saveErrorBanner = ValueKey('save-error-banner');
  static const Key retry = ValueKey('editor-retry');
  static const Key notFound = ValueKey('editor-not-found');
  static const Key inactiveMark = ValueKey('venue-inactive');
}
