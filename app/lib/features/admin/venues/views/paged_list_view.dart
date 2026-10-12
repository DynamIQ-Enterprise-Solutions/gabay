import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/module_list_scaffold.dart';
import '../../../../shared/components/paged_list_notifier.dart';
import '../../../../shared/components/screen_back.dart';

/// A list screen over a [PagedListNotifier]: search, "Load more", the four
/// states, and a reload when the admin comes back to it (standard 4.6; items 5
/// and 7). The venue, building and level lists differ only in their wording,
/// their rows and where New goes, so they share this (FF-1; the third use
/// of the same wiring).
class PagedListView<T, N extends PagedListNotifier<T>> extends ConsumerWidget {
  const PagedListView({
    required this.provider,
    required this.title,
    required this.searchLabel,
    required this.emptyLabel,
    required this.emptySearchLabel,
    required this.itemBuilder,
    this.create,
    this.back,
    super.key,
  });

  final AsyncNotifierProvider<N, PagedList<T>> provider;
  final String title;
  final String searchLabel;

  /// Shown for an empty list.
  final String emptyLabel;

  /// Shown when a search matched nothing.
  final String emptySearchLabel;

  final Widget Function(BuildContext context, T item) itemBuilder;

  /// Null for a role that may not create (AC-36).
  final ListCreate? create;

  final ScreenBack? back;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(provider);
    final notifier = ref.read(provider.notifier);
    final list = state.value;
    return ModuleListScaffold<T>(
      title: title,
      items: state.whenData((page) => page.items),
      itemBuilder: itemBuilder,
      emptyLabel: (list?.search.isNotEmpty ?? false)
          ? emptySearchLabel
          : emptyLabel,
      retryLabel: l10n.retryAction,
      // The footer shows it too, when only the next page failed.
      errorText: switch ((state.error, list?.loadMoreError)) {
        (final Object error, _) => formatApiError(error, l10n),
        (_, final Object error) => formatApiError(error, l10n),
        _ => l10n.errorGeneric,
      },
      onRetry: notifier.reload,
      onReturn: notifier.reload,
      search: ListSearch(label: searchLabel, onChanged: notifier.setSearch),
      paging: list == null
          ? null
          : ListPaging(
              hasMore: list.hasMore,
              isLoadingMore: list.isLoadingMore,
              loadMoreFailed: list.loadMoreFailed,
              loadMoreLabel: l10n.listLoadMore,
              onLoadMore: notifier.loadMore,
            ),
      create: create,
      back: back,
    );
  }
}
