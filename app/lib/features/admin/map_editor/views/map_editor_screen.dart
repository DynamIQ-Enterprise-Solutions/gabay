import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../map_editor_paths.dart';
import '../tools/tool_context.dart';
import '../tools/tool_controller.dart';
import '../viewmodels/autosave_controller.dart';
import '../viewmodels/editor_access.dart';
import '../viewmodels/editor_state.dart';
import '../viewmodels/editor_view_model.dart';
import 'canvas/editor_canvas.dart';
import 'conflict_banner.dart';
import 'dialogs/add_floor_dialog.dart';
import 'dialogs/blank_start_dialog.dart';
import 'dialogs/leave_dialog.dart';
import 'dialogs/reload_confirm_dialog.dart';
import 'editor_keys.dart';
import 'editor_notice_text.dart';
import 'floor_tabs.dart';
import 'leave_warning.dart';
import 'panels/panel_host.dart';
import 'problems_list.dart';
import 'publishing_banner.dart';
import 'save_error_banner.dart';
import 'tool_rail.dart';
import 'top_bar.dart';

/// A window at least this wide (logical px) has the panel beside the canvas; a
/// narrower one moves it into a sheet (P0-11 r3 AC-135, DESIGN CHOICE).
const double kEditorWideBreakpoint = 720;

/// The width of the panel beside the canvas.
const double kEditorPanelWidth = 320;

/// The map editor of one venue (P0-11 r3 AC-58 to AC-77): the page of
/// `/admin/map-editor/:venueId`. It shows the four states of AC-58 (loading, the
/// error with Retry, empty with "Start a blank map", and the data), and "Not
/// found" for another tenant's venue or none. The data state is the top bar, the
/// tools, the canvas, the floor tabs and the panel; the dock under the canvas is
/// reserved for the 3D preview of OA-6 and stays collapsed (nothing is drawn in it
/// before OA-6).
class MapEditorScreen extends ConsumerStatefulWidget {
  const MapEditorScreen({required this.venueId, super.key});

  final int venueId;

  @override
  ConsumerState<MapEditorScreen> createState() => _MapEditorScreenState();
}

class _MapEditorScreenState extends ConsumerState<MapEditorScreen> {
  final GlobalKey<EditorCanvasState> _canvas = GlobalKey<EditorCanvasState>();
  final FocusNode _focus = FocusNode(debugLabel: 'map editor');
  late final EditorViewModel _vm;
  LeaveWarning? _warning;

  @override
  void initState() {
    super.initState();
    _vm = ref.read(editorViewModelProvider(widget.venueId).notifier)
      ..attachLeaveQuestion(_askLeave);
    _warning = LeaveWarning.install(_shouldWarn);
  }

  @override
  void dispose() {
    _vm.attachLeaveQuestion(null);
    _warning?.remove();
    _focus.dispose();
    super.dispose();
  }

  /// The browser's own leave warning is shown while the save is dirty, running,
  /// in error or in conflict (P0-11 r3 AC-73). A pending edit is at most
  /// `AUTOSAVE_DEBOUNCE` old (plan 1.1, DC-P6').
  bool _shouldWarn() {
    final save = ref.read(editorViewModelProvider(widget.venueId)).save;
    return save != SaveState.none && save != SaveState.saved;
  }

  Future<bool> _askLeave() {
    if (!mounted) return Future<bool>.value(true);
    return showLeaveDialog(context);
  }

  // -------------------------------------------------------------------- keys

  bool get _typing {
    final focus = FocusManager.instance.primaryFocus;
    final focusContext = focus?.context;
    if (focusContext == null) return false;
    return focusContext.widget is EditableText ||
        focusContext.findAncestorWidgetOfExactType<EditableText>() != null;
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent || _typing) return KeyEventResult.ignored;
    final keyboard = HardwareKeyboard.instance;
    final mods = PointerMods(
      shift: keyboard.isShiftPressed,
      alt: keyboard.isAltPressed,
      ctrl: keyboard.isControlPressed || keyboard.isMetaPressed,
    );
    final key = event.logicalKey;
    if (mods.ctrl) {
      if (key == LogicalKeyboardKey.keyZ) {
        mods.shift ? _vm.redo() : _vm.undo();
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.keyY) {
        _vm.redo();
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    }
    if (key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter) {
      return _vm.keyDown(ToolKey.enter, mods)
          ? KeyEventResult.handled
          : KeyEventResult.ignored;
    }
    if (key == LogicalKeyboardKey.escape) {
      return _vm.keyDown(ToolKey.escape, mods)
          ? KeyEventResult.handled
          : KeyEventResult.ignored;
    }
    if (key == LogicalKeyboardKey.delete ||
        key == LogicalKeyboardKey.backspace) {
      return _vm.keyDown(ToolKey.delete, mods)
          ? KeyEventResult.handled
          : KeyEventResult.ignored;
    }
    final label = key.keyLabel;
    if (label.length == 1) {
      final tool = EditorTool.forKey(label);
      if (tool != null) {
        _vm.selectTool(tool);
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }

  // ----------------------------------------------------------------- actions

  Future<void> _startBlank() async {
    final values = await showBlankStartDialog(context);
    if (values == null || !mounted) return;
    final error = await _vm.blankStart(values);
    if (error != null && mounted) context.showError(error);
  }

  Future<void> _reload() async {
    final confirmed = await showReloadConfirmDialog(context);
    if (!confirmed || !mounted) return;
    await _vm.reload();
  }

  Future<void> _publish() async {
    final go = await _vm.requestPublish();
    if (go && mounted) context.go(MapEditorPaths.publish(widget.venueId));
  }

  void _openPanel() {
    unawaited(
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => FractionallySizedBox(
          heightFactor: 0.7,
          child: PanelHost(venueId: widget.venueId),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------- build

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    ref.listen(
      editorViewModelProvider(widget.venueId)
          .select((state) => state.noticeSerial),
      (previous, next) {
        final notice = ref.read(editorViewModelProvider(widget.venueId)).notice;
        if (notice != null) context.showError(noticeText(notice, l10n));
      },
    );
    final state = ref.watch(editorViewModelProvider(widget.venueId));
    final access = ref.watch(editorAccessProvider);
    return Focus(
      focusNode: _focus,
      autofocus: true,
      onKeyEvent: _onKey,
      child: switch (state.phase) {
        EditorPhase.loading => Center(
          child: CircularProgressIndicator(
            semanticsLabel: l10n.mapEditorLoading,
          ),
        ),
        EditorPhase.error => _Message(
          icon: Icons.error_outline,
          text: formatApiError(state.loadError ?? '', l10n),
          action: FilledButton(
            key: EditorKeys.retry,
            onPressed: () => unawaited(_vm.load()),
            child: Text(l10n.retryAction),
          ),
        ),
        EditorPhase.notFound => _Message(
          key: EditorKeys.notFound,
          icon: Icons.search_off,
          text: l10n.errorNotFound,
          action: FilledButton(
            onPressed: () => context.go(MapEditorPaths.list),
            child: Text(l10n.mapEditorBackToList),
          ),
        ),
        EditorPhase.empty => _Empty(
          venueName: state.venue?.name ?? '',
          canDraw: access.canDraw,
          onStart: () => unawaited(_startBlank()),
        ),
        EditorPhase.ready => _Ready(
          venueId: widget.venueId,
          state: state,
          access: access,
          canvas: _canvas,
          onReload: () => unawaited(_reload()),
          onPublish: () => unawaited(_publish()),
          onDetails: _openPanel,
          onAddFloor: () =>
              unawaited(showAddFloorDialog(context, widget.venueId)),
        ),
      },
    );
  }
}

/// The data state: top bar, banners, tools, canvas, floor tabs, panel.
class _Ready extends ConsumerWidget {
  const _Ready({
    required this.venueId,
    required this.state,
    required this.access,
    required this.canvas,
    required this.onReload,
    required this.onPublish,
    required this.onDetails,
    required this.onAddFloor,
  });

  final int venueId;
  final EditorState state;
  final EditorAccess access;
  final GlobalKey<EditorCanvasState> canvas;
  final VoidCallback onReload;
  final VoidCallback onPublish;
  final VoidCallback onDetails;
  final VoidCallback onAddFloor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vm = ref.read(editorViewModelProvider(venueId).notifier);
    final canEdit = access.canDraw && state.save != SaveState.conflict;
    final document = state.document!;
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= kEditorWideBreakpoint;
        final tools = canEdit
            ? ToolRail(
                selected: state.tool,
                onPick: vm.selectTool,
                horizontal: !wide,
              )
            : null;
        final tabs = FloorTabs(
          document: document,
          activeId: state.levelId,
          onPick: vm.setActiveLevel,
          onAddFloor: canEdit ? onAddFloor : null,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EditorTopBar(
              state: state,
              canPublish: access.canPublish,
              canEdit: canEdit,
              onUndo: vm.undo,
              onRedo: vm.redo,
              onZoomIn: () => canvas.currentState?.zoomBy(0.5),
              onZoomOut: () => canvas.currentState?.zoomBy(-0.5),
              onPublish: onPublish,
              onTryAgain: () => unawaited(vm.tryAgain()),
              onDetails: wide ? null : onDetails,
            ),
            if (state.save == SaveState.conflict)
              ConflictBanner(onReload: onReload),
            if (state.publishing case final publishing?)
              PublishingBanner(version: publishing.version),
            if (state.save == SaveState.error && state.problems.isNotEmpty)
              ProblemsList(
                problems: state.problems,
                total: state.problemsTotal,
                onPick: vm.selectProblem,
              )
            else if (state.save == SaveState.error && state.saveError != null)
              SaveErrorBanner(error: state.saveError!),
            if (tools != null && !wide)
              Align(alignment: Alignment.centerLeft, child: tools),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (tools != null && wide)
                    Align(alignment: Alignment.topCenter, child: tools),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: EditorCanvas(key: canvas, venueId: venueId),
                        ),
                        tabs,
                        // The dock under the canvas is reserved for OA-6's 3D
                        // preview: collapsed, nothing drawn in it before OA-6.
                      ],
                    ),
                  ),
                  if (wide) ...[
                    const VerticalDivider(width: 1),
                    SizedBox(
                      width: kEditorPanelWidth,
                      child: PanelHost(venueId: venueId),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// The empty state: the venue has no map (P0-11 r3 AC-58).
class _Empty extends StatelessWidget {
  const _Empty({
    required this.venueName,
    required this.canDraw,
    required this.onStart,
  });

  final String venueName;
  final bool canDraw;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _Message(
      icon: Icons.map_outlined,
      title: l10n.mapEditorTitle(venueName),
      text: l10n.mapEditorEmptyTitle,
      detail: canDraw ? l10n.mapEditorEmptyBody : l10n.mapEditorEmptyReadOnly,
      action: canDraw
          ? FilledButton.icon(
              key: EditorKeys.blankStart,
              onPressed: onStart,
              icon: const Icon(Icons.add),
              label: Text(l10n.mapEditorStartBlank),
            )
          : null,
    );
  }
}

/// A centred message with an icon and an optional action: the error, not-found
/// and empty states.
class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.text,
    this.title,
    this.detail,
    this.action,
    super.key,
  });

  final IconData icon;
  final String text;
  final String? title;
  final String? detail;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            if (title != null) ...[
              Semantics(
                header: true,
                child: Text(
                  title!,
                  style: theme.textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 8),
            ],
            Text(text, textAlign: TextAlign.center),
            if (detail != null) ...[
              const SizedBox(height: 8),
              Text(detail!, textAlign: TextAlign.center),
            ],
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}
