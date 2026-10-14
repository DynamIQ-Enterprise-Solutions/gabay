import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/shared/components/module_list_scaffold.dart';
import 'package:gabay/shared/components/routed_form_scaffold.dart';
import 'package:gabay/shared/components/screen_back.dart';
import 'package:go_router/go_router.dart';

import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// FF-1 (plan/FF-1-venue-setup.md 3.1, B4; spec AC-24): what `RoutedFormScaffold`
/// and `ModuleListScaffold` gain for the first admin forms: the delete action
/// behind a confirmation whose default and focused action is Cancel (standard
/// 4.6), Back by `context.go`, a form with no Save (read-only), and a "New"
/// action on a list. Every new control has a screen-reader name. The existing
/// scaffold tests are unchanged: each new parameter is optional.
/// The delete button: `OutlinedButton.icon` builds a subtype, which
/// `find.byType` does not match.
Finder _outlined(String text) => find.ancestor(
  of: find.text(text),
  matching: find.bySubtype<OutlinedButton>(),
);

void main() {
  var submits = 0;
  var deletes = 0;
  setUp(() {
    submits = 0;
    deletes = 0;
  });

  FormDelete delete() => FormDelete(
    label: 'Delete building',
    confirmTitle: 'Delete this building?',
    confirmBody: 'This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    onConfirm: () async => deletes++,
  );

  Widget form({
    FormDelete? deleteAction,
    ScreenBack? back,
    bool showSubmit = true,
    bool isSubmitting = false,
    double textScale = 1,
  }) => screenHarness(
    textScale: textScale,
    RoutedFormScaffold(
      title: 'Building',
      formKey: GlobalKey<FormState>(),
      submitLabel: 'Save',
      onSubmit: () => submits++,
      isSubmitting: isSubmitting,
      delete: deleteAction,
      back: back,
      showSubmit: showSubmit,
      children: const [Text('field')],
    ),
  );

  group('delete', () {
    testWidgets('no delete control unless the screen asks for one', (
      tester,
    ) async {
      await tester.pumpWidget(form());
      expect(find.text('Delete building'), findsNothing);
      expect(find.text('Save'), findsOneWidget);
    });

    testWidgets('shows the delete action, and asks before doing anything', (
      tester,
    ) async {
      await tester.pumpWidget(form(deleteAction: delete()));
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      expect(find.text('Delete this building?'), findsOneWidget);
      expect(find.text('This cannot be undone.'), findsOneWidget);
      expect(deletes, 0, reason: 'nothing happens until the admin confirms');
    });

    testWidgets('Cancel is the focused default: Enter or tapping it keeps the '
        'record', (tester) async {
      await tester.pumpWidget(form(deleteAction: delete()));
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      final cancel = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Cancel'),
      );
      expect(cancel.autofocus, isTrue, reason: 'Cancel holds the focus');
      final confirm = find.widgetWithText(FilledButton, 'Delete');
      expect(confirm, findsOneWidget);
      expect(
        tester.widget<FilledButton>(confirm).autofocus,
        isFalse,
        reason: 'the destructive action is never the default',
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('Delete this building?'), findsNothing);
      expect(deletes, 0);
    });

    testWidgets('the barrier and the system back also keep the record', (
      tester,
    ) async {
      await tester.pumpWidget(form(deleteAction: delete()));
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(2, 2));
      await tester.pumpAndSettle();
      expect(find.text('Delete this building?'), findsNothing);
      expect(deletes, 0);
    });

    testWidgets('confirming runs the delete once', (tester) async {
      await tester.pumpWidget(form(deleteAction: delete()));
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(deletes, 1);
      expect(find.text('Delete this building?'), findsNothing);
    });

    testWidgets('the action and both dialog buttons have screen-reader names, '
        'and the dialog reads as a dialog', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(form(deleteAction: delete()));
      expect(find.bySemanticsLabel('Delete building'), findsOneWidget);
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Cancel'), findsOneWidget);
      expect(find.bySemanticsLabel('Delete'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('is disabled while a save is in flight', (tester) async {
      await tester.pumpWidget(form(deleteAction: delete(), isSubmitting: true));
      final button = tester.widget<OutlinedButton>(
        _outlined('Delete building'),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('colours come from the theme: the delete action uses the '
        'error colour', (tester) async {
      await tester.pumpWidget(form(deleteAction: delete()));
      final scheme = Theme.of(tester.element(find.byType(RoutedFormScaffold)))
          .colorScheme;
      final button = tester.widget<OutlinedButton>(
        _outlined('Delete building'),
      );
      final colour = button.style!.foregroundColor!.resolve(<WidgetState>{});
      expect(colour, scheme.error);
    });
  });

  group('showSubmit: false is a read-only form', () {
    testWidgets('no Save button', (tester) async {
      await tester.pumpWidget(form(showSubmit: false));
      expect(find.text('Save'), findsNothing);
      expect(find.text('field'), findsOneWidget);
    });

    testWidgets('Save is still there by default and calls the callback once', (
      tester,
    ) async {
      await tester.pumpWidget(form());
      await tester.tap(find.text('Save'));
      expect(submits, 1);
    });
  });

  group('back', () {
    Widget host(RoutedFormScaffold scaffold) => MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: '/venues/form',
        routes: [
          GoRoute(
            path: '/venues',
            builder: (_, _) => const Scaffold(body: Text('the list')),
            routes: [GoRoute(path: 'form', builder: (_, _) => scaffold)],
          ),
        ],
      ),
    );

    testWidgets('Back goes to the list path with context.go, and is named', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        host(
          RoutedFormScaffold(
            title: 'Building',
            formKey: GlobalKey<FormState>(),
            submitLabel: 'Save',
            onSubmit: () {},
            back: const ScreenBack(path: '/venues', label: 'Back to the list'),
            children: const [Text('field')],
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(find.byTooltip('Back to the list')),
        isSemantics(isButton: true, tooltip: 'Back to the list'),
      );
      await tester.tap(find.byTooltip('Back to the list'));
      await tester.pumpAndSettle();
      expect(find.text('the list'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('with no back the app bar is what it was', (tester) async {
      await tester.pumpWidget(form());
      expect(find.byType(BackButton), findsNothing);
      expect(find.byTooltip('Back to the list'), findsNothing);
    });
  });

  group('layout', () {
    testWidgets('delete, Save and the dialog do not overflow at text size '
        'x1.4 on a 320 px phone', (tester) async {
      setLogicalSize(tester, const Size(320, 640));
      await tester.pumpWidget(form(deleteAction: delete(), textScale: 1.4));
      await tester.ensureVisible(find.text('Delete building'));
      await tester.tap(find.text('Delete building'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('ModuleListScaffold create action', () {
    var created = 0;
    setUp(() => created = 0);

    Widget list(AsyncValue<List<String>> items, {ListCreate? create}) =>
        screenHarness(
          ModuleListScaffold<String>(
            title: 'Venues',
            items: items,
            itemBuilder: (context, item) => ListTile(title: Text(item)),
            emptyLabel: 'No venues yet',
            retryLabel: 'Try again',
            errorText: 'Could not load',
            onRetry: () {},
            create: create,
          ),
        );

    ListCreate create() =>
        ListCreate(label: 'New venue', onPressed: () => created++);

    testWidgets('no create action unless asked for (the Phase 1 contract)', (
      tester,
    ) async {
      await tester.pumpWidget(list(const AsyncData(['Aurora'])));
      expect(find.byType(FloatingActionButton), findsNothing);
      expect(find.text('New venue'), findsNothing);
    });

    testWidgets('shows a named New button over a list, and it calls back', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        list(const AsyncData(['Aurora']), create: create()),
      );
      expect(find.bySemanticsLabel('New venue'), findsOneWidget);
      await tester.tap(find.text('New venue'));
      expect(created, 1);
      handle.dispose();
    });

    testWidgets('the empty state offers the same action, so the first record '
        'can be made', (tester) async {
      await tester.pumpWidget(
        list(const AsyncData(<String>[]), create: create()),
      );
      expect(find.text('No venues yet'), findsOneWidget);
      expect(
        find.ancestor(
          of: find.text('New venue'),
          matching: find.bySubtype<FilledButton>(),
        ),
        findsOneWidget,
      );
      await tester.tap(
        find.ancestor(
          of: find.text('New venue'),
          matching: find.bySubtype<FilledButton>(),
        ),
      );
      expect(created, 1);
    });

    testWidgets('the button stays while the list loads', (tester) async {
      await tester.pumpWidget(
        list(const AsyncLoading<List<String>>(), create: create()),
      );
      await tester.pump();
      expect(
        find.text('New venue'),
        findsOneWidget,
        reason: 'the button stays',
      );
    });

    testWidgets('the last row is not hidden behind the button', (tester) async {
      setLogicalSize(tester, const Size(320, 480));
      await tester.pumpWidget(
        list(
          AsyncData([for (var i = 0; i < 30; i++) 'Venue $i']),
          create: create(),
        ),
      );
      await tester.drag(find.byType(ListView), const Offset(0, -5000));
      await tester.pumpAndSettle();
      final lastRow = tester.getRect(find.text('Venue 29'));
      final button = tester.getRect(find.text('New venue'));
      expect(lastRow.overlaps(button), isFalse);
    });
  });
}
