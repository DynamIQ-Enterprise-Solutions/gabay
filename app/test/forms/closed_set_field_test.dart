import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/field_spec.dart';
import 'package:gabay/shared/forms/spec_form_field.dart';

import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// P0-11 r3 AC-66 and DC-E11: a `text` field with `closedSet` is a select over
/// the generated set (never free text), each option labelled from ARB and valued
/// by its code; read-only it shows the label; a value outside the set shows as
/// nothing chosen (the field never invents an option).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final spec = FieldSpec(
    table: 'map.wall',
    name: 'kind',
    label: (_) => 'Wall kind',
    kind: ColKind.text,
    closedSet: 'WallKind',
  );

  Future<void> pump(
    WidgetTester tester, {
    FieldSpec? use,
    Object? value,
    ValueChanged<Object?>? onChanged,
    double textScale = 1,
  }) => tester.pumpWidget(
    formHarness(
      textScale: textScale,
      SpecFormField(
        spec: use ?? spec,
        value: value,
        onChanged: onChanged ?? (_) {},
      ),
    ),
  );

  testWidgets('shows its label, is a select, and has no text box', (
    tester,
  ) async {
    await pump(tester, value: 'solid');
    expect(find.text('Wall kind'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsOneWidget);
    expect(find.byType(EditableText), findsNothing);
  });

  testWidgets('the current code shows as its label', (tester) async {
    await pump(tester, value: 'solid');
    expect(find.text(l10n.wallKindSolid), findsOneWidget);
  });

  testWidgets('choosing an option reports its code', (tester) async {
    Object? got;
    await pump(tester, value: 'solid', onChanged: (v) => got = v);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.wallKindGlass).last);
    await tester.pumpAndSettle();
    expect(got, 'glass');
  });

  testWidgets('a value outside the set shows nothing chosen', (tester) async {
    await pump(tester, value: 'brick-and-mortar');
    final field = tester.widget<DropdownButtonFormField<String>>(
      find.byType(DropdownButtonFormField<String>),
    );
    expect(field.initialValue, isNull);
  });

  testWidgets('a required one with nothing chosen says it is required', (
    tester,
  ) async {
    final key = GlobalKey<FormState>();
    final required = FieldSpec(
      table: 'map.unit',
      name: 'category',
      label: (_) => 'Category',
      kind: ColKind.text,
      required: true,
      closedSet: 'ImdfUnitCategory',
    );
    await tester.pumpWidget(
      formHarness(
        Form(
          key: key,
          child: SpecFormField(spec: required, value: null, onChanged: (_) {}),
        ),
      ),
    );
    expect(key.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.textContaining('is required'), findsOneWidget);
  });

  testWidgets('read-only it shows the label as text, with a screen-reader name', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pump(tester, use: spec.asReadOnly(), value: 'glass');
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
    expect(find.text(l10n.wallKindGlass), findsOneWidget);
    expect(
      find.bySemanticsLabel('Wall kind'),
      findsOneWidget,
      reason: 'the read-only value is announced under its field name',
    );
    handle.dispose();
  });

  testWidgets('a misspelt set name fails at once, not silently', (tester) async {
    final bad = FieldSpec(
      table: 'map.wall',
      name: 'kind',
      label: (_) => 'Wall kind',
      kind: ColKind.text,
      closedSet: 'WallKinds',
    );
    await pump(tester, use: bad, value: 'solid');
    expect(tester.takeException(), isA<ArgumentError>());
  });

  testWidgets('at text size x1.4 a long label does not overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final category = FieldSpec(
      table: 'map.unit',
      name: 'category',
      label: (_) => 'Category',
      kind: ColKind.text,
      closedSet: 'ImdfUnitCategory',
    );
    await pump(
      tester,
      use: category,
      value: 'restroom.transgender.wheelchair',
      textScale: 1.4,
    );
    expect(tester.takeException(), isNull);
  });
}
