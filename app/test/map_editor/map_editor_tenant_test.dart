import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';

import 'support/editor_harness.dart';

/// P0-11 r3 AC-138 (every call of the editor names the tenant in effect, and a
/// switch of tenant is the leave guard's business, see `leave_guard_test`):
/// tenant 1 and tenant 2 of the same two-tenant account each get their own header
/// on the load and on the save, and rule 2 holds on the client side too: the
/// header is the tenant the person chose, never one the editor made up.
void main() {
  /// The account of `me_two_tenants` (user id 7) with [tenantId] remembered.
  Future<EditorTestApp> openAs(WidgetTester tester, int tenantId) async {
    final app = EditorTestApp(
      me: 'me_two_tenants',
      rememberedTenants: {7: tenantId},
    );
    storeDocument(app.api, drawnDocument());
    await app.open(tester);
    return app;
  }

  Iterable<RequestOptions> mapCalls(EditorTestApp app) =>
      app.api.requests.where((r) => r.path.contains('/map'));

  testWidgets('tenant 1 (MALL_ADMIN): the load and the save both carry its id', (
    tester,
  ) async {
    final app = await openAs(tester, 1);
    expect(find.byKey(EditorKeys.canvas), findsOneWidget);
    await tester.tap(find.byKey(EditorKeys.tool('wall')));
    await tester.pump();
    await mouseClick(tester, const Pt(5, 25));
    await mouseClick(tester, const Pt(20, 25));
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();
    final calls = mapCalls(app).toList();
    expect(calls.map((r) => r.method), containsAll(['GET', 'PUT']));
    for (final call in calls) {
      expect(call.headers['X-Tenant-Id'], '1', reason: call.path);
    }
  });

  testWidgets('tenant 2 (the same person is a VIEWER there): its id, and the permissions of that tenant', (
    tester,
  ) async {
    final app = await openAs(tester, 2);
    expect(find.byKey(EditorKeys.canvas), findsOneWidget);
    expect(find.byKey(EditorKeys.tool('wall')), findsNothing);
    expect(find.byKey(EditorKeys.publish), findsNothing);
    final calls = mapCalls(app).toList();
    expect(calls, isNotEmpty);
    for (final call in calls) {
      expect(call.headers['X-Tenant-Id'], '2', reason: call.path);
    }
    expect(app.api.saveCount, 0);
  });

  testWidgets('a venue the tenant does not own is "Not found": no drawing, no blank start, no save', (
    tester,
  ) async {
    final app = EditorTestApp(
      me: 'me_two_tenants',
      rememberedTenants: const {7: 2},
      location: '/admin/map-editor/99',
    );
    await app.open(tester);
    expect(find.byKey(EditorKeys.notFound), findsOneWidget);
    expect(find.byKey(EditorKeys.canvas), findsNothing);
    expect(find.byKey(EditorKeys.blankStart), findsNothing);
    expect(app.api.saveCount, 0);
  });
}
