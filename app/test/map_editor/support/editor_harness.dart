import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_state.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_view_model.dart';
import 'package:gabay/features/admin/map_editor/views/canvas/scene_painter.dart';
import 'package:gabay/features/admin/map_editor/views/map_editor_routes.dart';
import 'package:gabay/features/admin/map_editor/views/map_editor_venue_list_screen.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/messaging/message_overlay.dart';
import 'package:gabay/shared/navigation/route_observer.dart';
import 'package:go_router/go_router.dart';

import '../../support/me_fixtures.dart';
import '../../support/shell_harness.dart';
import 'fake_map_api.dart';
import 'map_test_support.dart';

export 'fake_map_api.dart';
export 'map_test_support.dart';

/// Everything an editor widget test needs: the real editor routes and screen in
/// a shell-like `ShellRoute` (so the module gate and `onExit` are in play), over
/// [FakeMapApi] under the real `ApiClient`, SIGNED IN as the account of a
/// `/api/me` fixture (SEC-3): the permission flags of that account decide what
/// the editor offers (plan 1.1 section 0.6).
class EditorTestApp {
  EditorTestApp({
    FakeMapApi? api,
    this.me = 'me_malladmin',
    this.size = const Size(1280, 900),
    this.textScale = 1,
    this.brightness = Brightness.light,
    this.location = '/admin/map-editor/7',
  }) : api = api ?? FakeMapApi(),
       observer = RouteObserver<ModalRoute<void>>() {
    router = GoRouter(
      initialLocation: location,
      routes: [
        ShellRoute(
          observers: [observer],
          builder: (context, state, child) => Scaffold(body: child),
          routes: [
            ...mapEditorRoutes(
              listScreen: () => const MapEditorVenueListScreen(),
            ),
            GoRoute(
              path: '/admin',
              builder: (context, state) => const Text('dashboard'),
            ),
            GoRoute(
              path: '/admin/publish',
              builder: (context, state) => const Text('publish page'),
            ),
          ],
        ),
      ],
    );
  }

  final FakeMapApi api;
  final String me;
  final Size size;
  final double textScale;
  final Brightness brightness;
  final String location;
  final RouteObserver<ModalRoute<void>> observer;
  late final GoRouter router;

  Widget get widget => ProviderScope(
    overrides: [
      apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
      ...signedInOverrides(me: me, api: api),
      routeObserverProvider.overrideWithValue(observer),
      autosaveClockProvider.overrideWithValue(const PumpedAutosaveClock()),
      rememberedTenantStoreProvider.overrideWithValue(
        MemoryTenantStore(const {}),
      ),
    ],
    child: MaterialApp.router(
      theme: buildGabayTheme(brightness),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: MessageOverlay(child: child),
      ),
    ),
  );

  /// Pumps the app and lets the account and the first calls finish.
  Future<void> open(WidgetTester tester) async {
    setLogicalSize(tester, size);
    await tester.pumpWidget(widget);
    await tester.pumpAndSettle();
  }

  /// The container, for reading the editor's state.
  ProviderContainer container(WidgetTester tester) =>
      ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));

  EditorState state(WidgetTester tester, {int venueId = 7}) =>
      container(tester).read(editorViewModelProvider(venueId));

  EditorViewModel viewModel(WidgetTester tester, {int venueId = 7}) =>
      container(tester).read(editorViewModelProvider(venueId).notifier);

  /// Where the router is now.
  String get currentLocation =>
      router.routerDelegate.currentConfiguration.uri.toString();
}

/// The widget test's clock: its timers and its time both move with `pump`
/// (the binding's clock is fake time; `DateTime.now()` is not).
class PumpedAutosaveClock implements AutosaveClock {
  const PumpedAutosaveClock();

  @override
  DateTime now() => TestWidgetsFlutterBinding.instance.clock.now();

  @override
  Timer schedule(Duration delay, void Function() callback) =>
      Timer(delay, callback);
}

/// Seeds [api] with the committed fixture [name] as the stored draft (version 3).
void storeFixture(FakeMapApi api, String name, {int version = 3}) {
  api.draft = (fixtureJson(name)! as Map).cast<String, Object?>();
  api.draftVersion = version;
}

/// Seeds [api] with [document] as the stored draft.
void storeDocument(FakeMapApi api, MapDocument document, {int version = 3}) {
  api.draft = mapDocumentToJson(document);
  api.draftVersion = version;
}

/// A small drawn document: one building, one floor of 40 x 30 m, a wall, a door
/// in it and a unit. Ids are fixed so a test can name them.
MapDocument drawnDocument({double width = 40, double depth = 30}) =>
    documentOf([
      Level(
        id: 'L1',
        name: 'Ground floor',
        shortName: 'G',
        building: 'b-main',
        ordinal: 0,
        origin: const Pt(0, 0),
        size: Pt(width, depth),
        walls: [wallAt('w-1', const Pt(5, 5), const Pt(25, 5))],
        openings: const [Opening(id: 'o-1', wall: 'w-1', at: 0.5, w: 0.9)],
        units: [rectUnit('u-1', const Pt(8, 10), const Pt(20, 20))],
      ),
    ]);

/// The painter of the canvas (its projection turns metres into screen pixels).
ScenePainter scenePainter(WidgetTester tester) {
  final paint = tester
      .widgetList<CustomPaint>(
        find.byWidgetPredicate(
          (widget) => widget is CustomPaint && widget.painter is ScenePainter,
        ),
      )
      .single;
  return paint.painter! as ScenePainter;
}

/// The screen position of the plan point [p], read through the canvas's own
/// projection.
Offset screenOf(WidgetTester tester, Pt p) {
  final local = scenePainter(tester).projection.toScreen(p);
  final origin = tester.getTopLeft(
    find.byWidgetPredicate(
      (widget) => widget is CustomPaint && widget.painter is ScenePainter,
    ),
  );
  return origin + local;
}

/// A mouse button press at the plan point [p], moves through [via], and a
/// release at the last point (or at [p]).
Future<void> mouseDrag(
  WidgetTester tester,
  Pt p, {
  List<Pt> via = const [],
  int buttons = kPrimaryMouseButton,
}) async {
  final gesture = await tester.startGesture(
    screenOf(tester, p),
    kind: PointerDeviceKind.mouse,
    buttons: buttons,
  );
  for (final point in via) {
    await gesture.moveTo(screenOf(tester, point));
    await tester.pump();
  }
  await gesture.up();
  // flutter_map's own tap recogniser waits 250 ms for a second tap before it
  // lets go of its timer.
  await tester.pump(const Duration(milliseconds: 300));
}

/// A click: press and release at [p].
Future<void> mouseClick(WidgetTester tester, Pt p) => mouseDrag(tester, p);

/// The `FakeMapApi`'s decoded stored draft as a document.
MapDocument storedDocument(FakeMapApi api) => mapDocumentFromJson(api.draft);

/// The message banner (it is one rich text: the prefix, then the message).
Finder messageWith(String text) =>
    find.textContaining(text, findRichText: true);
