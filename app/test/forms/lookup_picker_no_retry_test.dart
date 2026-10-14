import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/paged_list_notifier.dart';
import 'package:gabay/shared/forms/async_lookup_picker.dart';
import 'package:gabay/shared/forms/select_option.dart';

import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// Riverpod 3 retries a provider that throws, with a growing delay, unless told
/// not to. A picker whose first page fails must show the error and "Try again"
/// at once (found while building FF-1's lists, which turn retry off the same
/// way); before the fix the spinner stayed while the fetcher was called again.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  testWidgets('a failed first page shows the error at once, and the fetcher is '
      'asked once, not retried behind the admin\'s back', (tester) async {
    var calls = 0;
    Future<PageResult<SelectOption>> fetcher({
      required String search,
      required int page,
    }) async {
      calls++;
      if (calls == 1) {
        throw DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionError,
        );
      }
      return const PageResult(
        items: [SelectOption(value: 1, label: 'Main building')],
        totalCount: 1,
        page: 1,
        pageSize: 25,
      );
    }

    await tester.pumpWidget(
      screenHarness(
        Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () =>
                  showLookupPicker(context, title: 'Type', fetcher: fetcher),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text(l10n.errorNoConnection), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    expect(calls, 1, reason: 'no automatic retry');
    await tester.tap(find.text(l10n.pickerRetry));
    await tester.pumpAndSettle();
    expect(find.text('Main building'), findsOneWidget);
    expect(calls, 2);
  });
}
