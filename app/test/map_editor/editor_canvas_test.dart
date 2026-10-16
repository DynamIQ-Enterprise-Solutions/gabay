import 'package:flutter/gestures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/views/canvas/projection.dart';
import 'package:gabay/features/admin/map_editor/views/canvas/scene.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';

import 'support/editor_harness.dart';

/// P0-11 r3 AC-60 (the canvas: wheel zoom clamped to 4 to 400 px per metre, right
/// or middle drag pans, one layer draws the active level only, the grid, the site
/// and footprint outlines on every level), AC-68 (the snap marker is drawn while
/// a snap is active), AC-76 (a level with nothing on it: the empty floor with its
/// grid, EC-12).
void main() {
  group('the scene (pure): layers, bottom to top', () {
    final level = plainLevel(
      walls: [wallAt('w', const Pt(1, 1), const Pt(5, 1))],
      openings: const [Opening(id: 'o', wall: 'w', at: 0.5, w: 1)],
      units: [rectUnit('u', const Pt(2, 2), const Pt(4, 4))],
    );
    final document = documentOf([level]);

    List<SceneLayer> layers({
      Level? level0,
      Selection? selection,
      bool handles = false,
      ToolPreview preview = ToolPreview.none,
      double cell = 10,
      MapDocument? doc,
    }) => sceneLayers(
      document: doc ?? document,
      level: level0 ?? level,
      selection: selection,
      showHandles: handles,
      preview: preview,
      gridCellPx: cell,
      minGridCellPx: EditorConstants.gridMinCellPx,
    );

    test('the floor and grid first, then outlines, units, walls, openings', () {
      expect(layers(), [
        SceneLayer.floor,
        SceneLayer.grid,
        SceneLayer.siteOutline,
        SceneLayer.units,
        SceneLayer.walls,
        SceneLayer.openings,
      ]);
    });

    test(
      'the order of the layers is the order of the enum (bottom to top)',
      () {
        final all = layers(
          selection: const Selection(ElementKind.unit, 'u'),
          handles: true,
          preview: const ToolPreview(
            path: [Pt(0, 0), Pt(1, 1)],
            snapMarker: Pt(1, 1),
          ),
          doc: documentOf(
            [level],
            buildings: const [
              Building(
                id: 'b-main',
                name: 'Main',
                type: 'MAIN',
                footprint: [Pt(0, 0), Pt(5, 0), Pt(5, 5)],
              ),
            ],
          ),
        );
        expect(all, [...all]..sort((a, b) => a.index.compareTo(b.index)));
        expect(all, containsAll(SceneLayer.values));
      },
    );

    test('the grid fades out when a cell is narrower than the minimum', () {
      expect(
        layers(cell: EditorConstants.gridMinCellPx - 0.1),
        isNot(contains(SceneLayer.grid)),
      );
      expect(
        layers(cell: EditorConstants.gridMinCellPx),
        contains(SceneLayer.grid),
      );
    });

    test(
      'an empty floor still has its floor, grid and site outline (EC-12)',
      () {
        final empty = plainLevel(id: 'L9');
        expect(layers(level0: empty, doc: documentOf([empty])), [
          SceneLayer.floor,
          SceneLayer.grid,
          SceneLayer.siteOutline,
        ]);
      },
    );

    test('handles only with a selection and only when asked; the preview and the snap marker only with something to show', () {
      expect(layers(handles: true), isNot(contains(SceneLayer.handles)));
      final selected = layers(
        selection: const Selection(ElementKind.wall, 'w'),
        handles: true,
      );
      expect(selected, contains(SceneLayer.selection));
      expect(selected, contains(SceneLayer.handles));
      expect(
        layers(selection: const Selection(ElementKind.wall, 'w')),
        isNot(contains(SceneLayer.handles)),
      );
      expect(layers(), isNot(contains(SceneLayer.preview)));
      expect(layers(), isNot(contains(SceneLayer.snapMarker)));
    });

    test('only the active level is drawn: another level\'s elements are not in the scene', () {
      final other = plainLevel(id: 'L2');
      final doc = documentOf([level, other]);
      expect(
        layers(level0: other, doc: doc),
        isNot(contains(SceneLayer.walls)),
      );
      expect(layers(level0: level, doc: doc), contains(SceneLayer.walls));
    });
  });

  group('the canvas widget', () {
    testWidgets(
      'it draws with one layer: the scene painter for the active level, and flutter_map under it',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        final painter = scenePainter(tester);
        expect(painter.level.id, 'L1');
        expect(painter.document.levels.length, 1);
        expect(find.byKey(EditorKeys.canvas), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'it opens fitted to the floor: the whole rectangle is on screen, at a scale inside the clamp',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        final projection = scenePainter(tester).projection;
        expect(
          projection.pxPerMetre,
          greaterThanOrEqualTo(EditorConstants.minPxPerMetre),
        );
        expect(
          projection.pxPerMetre,
          lessThanOrEqualTo(EditorConstants.maxPxPerMetre),
        );
        final a = projection.toScreen(const Pt(0, 0));
        final b = projection.toScreen(const Pt(40, 30));
        expect(a.dx, greaterThanOrEqualTo(0));
        expect(a.dy, greaterThanOrEqualTo(0));
        expect(b.dx, lessThanOrEqualTo(projection.size.width));
        expect(b.dy, lessThanOrEqualTo(projection.size.height));
      },
    );

    testWidgets(
      'real scale: a 9 x 9 m unit measures 9 x 9 m on screen, whatever the zoom (the panel reads 9.000 x 9.000)',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(
          app.api,
          documentOf([
            plainLevel(
              width: 40,
              depth: 40,
              units: [rectUnit('u-1', const Pt(5, 5), const Pt(14, 14))],
            ),
          ]),
        );
        await app.open(tester);
        app.viewModel(tester).selectTool(app.state(tester).tool);
        await mouseClick(tester, const Pt(10, 10));
        expect(find.text('Size: 9.000 by 9.000 m'), findsOneWidget);
        for (var step = 0; step < 3; step++) {
          final projection = scenePainter(tester).projection;
          final a = projection.toScreen(const Pt(5, 5));
          final b = projection.toScreen(const Pt(14, 14));
          expect(b.dx - a.dx, closeTo(9 * projection.pxPerMetre, 1e-6));
          expect(b.dy - a.dy, closeTo(9 * projection.pxPerMetre, 1e-6));
          final pointer = TestPointer(1, PointerDeviceKind.mouse);
          await tester.sendEventToBinding(
            pointer.hover(tester.getCenter(find.byKey(EditorKeys.canvas))),
          );
          await tester.sendEventToBinding(
            pointer.scroll(const Offset(0, -200)),
          );
          await tester.pumpAndSettle();
        }
      },
    );

    testWidgets(
      'the wheel zooms, and the scale never leaves 4 to 400 pixels per metre',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        final pointer = TestPointer(1, PointerDeviceKind.mouse);
        final centre = tester.getCenter(find.byKey(EditorKeys.canvas));
        await tester.sendEventToBinding(pointer.hover(centre));
        final before = scenePainter(tester).projection.pxPerMetre;
        await tester.sendEventToBinding(pointer.scroll(const Offset(0, -100)));
        await tester.pumpAndSettle();
        expect(scenePainter(tester).projection.pxPerMetre, greaterThan(before));

        for (var i = 0; i < 80; i++) {
          await tester.sendEventToBinding(
            pointer.scroll(const Offset(0, -400)),
          );
        }
        await tester.pumpAndSettle();
        expect(
          scenePainter(tester).projection.pxPerMetre,
          closeTo(EditorConstants.maxPxPerMetre, 1e-6),
        );
        for (var i = 0; i < 200; i++) {
          await tester.sendEventToBinding(pointer.scroll(const Offset(0, 400)));
        }
        await tester.pumpAndSettle();
        expect(
          scenePainter(tester).projection.pxPerMetre,
          closeTo(EditorConstants.minPxPerMetre, 1e-6),
        );
      },
    );

    testWidgets('the zoom buttons zoom in and out, within the clamp', (
      tester,
    ) async {
      final app = EditorTestApp();
      storeDocument(app.api, drawnDocument());
      await app.open(tester);
      final before = scenePainter(tester).projection.pxPerMetre;
      await tester.tap(find.byTooltip('Zoom in'));
      await tester.pumpAndSettle();
      final zoomedIn = scenePainter(tester).projection.pxPerMetre;
      expect(zoomedIn, greaterThan(before));
      await tester.tap(find.byTooltip('Zoom out'));
      await tester.tap(find.byTooltip('Zoom out'));
      await tester.pumpAndSettle();
      expect(scenePainter(tester).projection.pxPerMetre, lessThan(before));
    });

    testWidgets(
      'a right-button drag pans: the plan point under the pointer stays under it',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        const anchor = Pt(10, 10);
        final start = screenOf(tester, anchor);
        final before = scenePainter(tester).projection.centre;
        final gesture = await tester.startGesture(
          start,
          kind: PointerDeviceKind.mouse,
          buttons: kSecondaryMouseButton,
        );
        await gesture.moveTo(start + const Offset(60, 40));
        await tester.pump();
        await gesture.up();
        await tester.pumpAndSettle();
        final after = scenePainter(tester).projection;
        expect(after.centre, isNot(before));
        final moved = screenOf(tester, anchor);
        expect(moved.dx, closeTo(start.dx + 60, 0.5));
        expect(moved.dy, closeTo(start.dy + 40, 0.5));
        expect(
          app.state(tester).document!.levels.single.wallList.length,
          1,
          reason: 'a pan changes nothing in the drawing',
        );
        expect(app.state(tester).canUndo, isFalse);
      },
    );

    testWidgets('a middle-button drag pans too', (tester) async {
      final app = EditorTestApp();
      storeDocument(app.api, drawnDocument());
      await app.open(tester);
      final start = screenOf(tester, const Pt(10, 10));
      final gesture = await tester.startGesture(
        start,
        kind: PointerDeviceKind.mouse,
        buttons: kMiddleMouseButton,
      );
      await gesture.moveTo(start + const Offset(-30, 20));
      await tester.pump();
      await gesture.up();
      await tester.pumpAndSettle();
      final moved = screenOf(tester, const Pt(10, 10));
      expect(moved.dx, closeTo(start.dx - 30, 0.5));
      expect(moved.dy, closeTo(start.dy + 20, 0.5));
    });

    testWidgets(
      'a pan does not pick or move anything: the primary button is the tools\'',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        final start = screenOf(tester, const Pt(10, 15)); // inside the unit
        final gesture = await tester.startGesture(
          start,
          kind: PointerDeviceKind.mouse,
          buttons: kSecondaryMouseButton,
        );
        await gesture.moveTo(start + const Offset(80, 0));
        await gesture.up();
        await tester.pumpAndSettle();
        expect(app.state(tester).selection, isNull);
      },
    );

    testWidgets(
      'with a tool picked, a hover over a wall end shows the snap marker',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        app.viewModel(tester).selectTool(EditorTool.wall);
        await tester.pump();
        final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
        await mouse.addPointer(location: screenOf(tester, const Pt(25.2, 5.1)));
        await tester.pump();
        await mouse.moveTo(screenOf(tester, const Pt(25.2, 5.1)));
        await tester.pump();
        expect(app.state(tester).preview.snapMarker, const Pt(25, 5));
        expect(scenePainter(tester).preview.snapMarker, const Pt(25, 5));
      },
    );

    testWidgets('a tab change fits the camera to the new level', (
      tester,
    ) async {
      final app = EditorTestApp();
      storeDocument(
        app.api,
        documentOf([
          plainLevel(id: 'L1', width: 40, depth: 40),
          plainLevel(id: 'L2', width: 200, depth: 150).copyWith(ordinal: 1),
        ]),
      );
      await app.open(tester);
      final small = scenePainter(tester).projection.pxPerMetre;
      app.viewModel(tester).setActiveLevel('L2');
      await tester.pumpAndSettle();
      final large = scenePainter(tester).projection.pxPerMetre;
      expect(scenePainter(tester).level.id, 'L2');
      expect(large, lessThan(small));
    });

    testWidgets(
      'the projection of the camera agrees with the painter: a click at a plan point reaches the tool at that point',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        await mouseClick(tester, const Pt(10, 15));
        expect(app.state(tester).selection, isNotNull);
        expect(PlanProjection.pxPerMetreFor(0), greaterThan(0));
      },
    );
  });
}
