import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';

import 'support/editor_harness.dart';

/// P0-11 r3 AC-137 (what each role can do in the editor, read from the account's
/// permission flags and never from a role name, plan 1.1 section 0.6): a VIEWER
/// looks and reads panels; a VENUE_EDITOR draws, autosaves and cannot publish; a
/// MALL_ADMIN and a SUPERADMIN do everything the slice has. The server enforces
/// the same rows (SEC-1); hiding a control is the client's part only.
void main() {
  Future<EditorTestApp> open(
    WidgetTester tester,
    String me, {
    Map<int, int> tenants = const {},
  }) async {
    final app = EditorTestApp(me: me, rememberedTenants: tenants);
    storeDocument(app.api, drawnDocument());
    await app.open(tester);
    return app;
  }

  final allTools = [for (final tool in EditorTool.values) tool.id];

  Future<void> expectDrawingControls(
    WidgetTester tester, {
    required bool shown,
  }) async {
    for (final id in allTools) {
      expect(
        find.byKey(EditorKeys.tool(id)),
        shown ? findsOneWidget : findsNothing,
        reason: 'tool $id',
      );
    }
    expect(find.byKey(EditorKeys.undo), shown ? findsOneWidget : findsNothing);
    expect(find.byKey(EditorKeys.redo), shown ? findsOneWidget : findsNothing);
    expect(
      find.byKey(EditorKeys.addFloor),
      shown ? findsOneWidget : findsNothing,
    );
  }

  group('a VIEWER (the account reads maps and nothing else)', () {
    testWidgets('sees the plan and the floor, and no drawing control and no Publish', (
      tester,
    ) async {
      final app = await open(tester, 'me_viewer');
      expect(find.byKey(EditorKeys.canvas), findsOneWidget);
      expect(app.state(tester).level, isNotNull);
      await expectDrawingControls(tester, shown: false);
      expect(find.byKey(EditorKeys.publish), findsNothing);
    });

    testWidgets('can click an element and read its panel, which builds no input', (
      tester,
    ) async {
      final app = await open(tester, 'me_viewer');
      await mouseClick(tester, const Pt(14, 15));
      expect(app.state(tester).selection, isNotNull);
      expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
    });

    testWidgets('a drag does not move anything, and nothing is ever saved', (
      tester,
    ) async {
      final app = await open(tester, 'me_viewer');
      final before = app.state(tester).document;
      await mouseDrag(tester, const Pt(14, 15), via: const [Pt(18, 15)]);
      expect(app.state(tester).document, same(before));
      await tester.pump(const Duration(seconds: 5));
      expect(app.api.saveCount, 0);
    });

    testWidgets('the tool keys and Delete do nothing', (tester) async {
      final app = await open(tester, 'me_viewer');
      await mouseClick(tester, const Pt(14, 15));
      for (final key in [
        LogicalKeyboardKey.keyW,
        LogicalKeyboardKey.keyM,
        LogicalKeyboardKey.delete,
      ]) {
        await tester.sendKeyEvent(key);
        await tester.pump();
      }
      expect(app.state(tester).tool, EditorTool.select);
      expect(app.state(tester).level!.unitList, hasLength(1));
      expect(app.api.saveCount, 0);
    });

    testWidgets('an edit sent past the screen is refused with the words for it', (
      tester,
    ) async {
      final app = await open(tester, 'me_viewer');
      app.viewModel(tester).edit((l) => l.copyWith(name: 'Nope'), key: 'name');
      await tester.pump();
      expect(app.state(tester).level!.name, 'Ground floor');
      expect(app.state(tester).canUndo, isFalse);
    });
  });

  group('a VENUE_EDITOR (draws, cannot publish)', () {
    testWidgets('has every drawing control and no Publish', (tester) async {
      await open(tester, 'me_editor');
      await expectDrawingControls(tester, shown: true);
      expect(find.byKey(EditorKeys.publish), findsNothing);
    });

    testWidgets('a drawn wall autosaves 1.5 s later', (tester) async {
      final app = await open(tester, 'me_editor');
      await tester.tap(find.byKey(EditorKeys.tool('wall')));
      await tester.pump();
      await mouseClick(tester, const Pt(5, 25));
      await mouseClick(tester, const Pt(20, 25));
      expect(app.api.saveCount, 0);
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.pumpAndSettle();
      expect(app.api.saveCount, 1);
      expect(storedDocument(app.api).levels.single.wallList, hasLength(2));
    });
  });

  group('a MALL_ADMIN (everything the slice has)', () {
    testWidgets('has every drawing control and Publish', (tester) async {
      await open(tester, 'me_malladmin');
      await expectDrawingControls(tester, shown: true);
      expect(find.byKey(EditorKeys.publish), findsOneWidget);
    });

    testWidgets('Publish goes to the publish page', (tester) async {
      final app = await open(tester, 'me_malladmin');
      await tester.tap(find.byKey(EditorKeys.publish));
      await tester.pumpAndSettle();
      expect(app.currentLocation, '/admin/publish?venueId=7');
    });
  });

  group('a SUPERADMIN acting in a tenant (everything the slice has)', () {
    testWidgets('has every drawing control and Publish', (tester) async {
      await open(tester, 'me_superadmin', tenants: const {1: 1});
      await expectDrawingControls(tester, shown: true);
      expect(find.byKey(EditorKeys.publish), findsOneWidget);
    });
  });
}
