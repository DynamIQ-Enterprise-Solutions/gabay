import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/venue_map_schema.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/network/network_providers.dart';
import '../../../session/viewmodels/pending_work_gate.dart';
import '../../../session/viewmodels/session_notifier.dart';
import '../../../session/viewmodels/session_state.dart';
import '../constants/editor_constants.dart';
import '../models/blank_start.dart';
import '../models/floor_rules.dart';
import '../models/level_fit.dart';
import '../models/map_document.dart';
import '../models/map_document_json.dart';
import '../models/map_ids.dart';
import '../models/map_limits.dart';
import '../models/map_load.dart';
import '../models/map_problem.dart';
import '../models/selection.dart';
import '../services/map_editor_service.dart';
import '../tools/editor_notice.dart';
import '../tools/hit_test.dart';
import '../tools/tool_context.dart';
import '../tools/tool_controller.dart';
import 'autosave_controller.dart';
import 'editor_access.dart';
import 'editor_state.dart';
import 'undo_stack.dart';

/// The one [MapEditorService], over the one `ApiClient`.
final Provider<MapEditorService> mapEditorServiceProvider =
    Provider<MapEditorService>(
      (ref) => MapEditorService(ref.watch(apiClientProvider)),
    );

/// The clock and the timers autosave and the typing coalescence use. A widget
/// test advances them with `pump`; a unit test passes a fake.
final Provider<AutosaveClock> autosaveClockProvider = Provider<AutosaveClock>(
  (ref) => const SystemAutosaveClock(),
);

/// The map editor of one venue (P0-11 r3; plan/OA-4a-1-draw-a-floor.md): the
/// ViewModel of the editor screen. It loads the map, holds the document, the
/// level, the tool and the selection, applies every change as one undo step,
/// and runs autosave; the view reads [EditorState] and calls these methods. It
/// calls only the stateless [MapEditorService].
///
/// It does **not** watch the tenant scope (plan 1.1 section 0.7): a switch of
/// tenant while a drawing is open would dispose its pending save. The tenant
/// switcher and the sign-out settle [pendingWorkGateProvider] first, which this
/// ViewModel registers [confirmLeave] with, so the save finishes while the
/// tenant and the token are still the drawing's own.
class EditorViewModel extends Notifier<EditorState> {
  EditorViewModel(this.venueId);

  final int venueId;

  late final UndoStack _undo;
  late final AutosaveController _autosave;
  late final AutosaveClock _clock;

  ToolController _tool = EditorTool.select.create();
  double _pxPerMetre = EditorConstants.openingPxPerMetre;
  int _loadGeneration = 0;

  /// The document as it was when the running gesture began.
  MapDocument? _gestureStart;

  /// The document the last save sent: a problem's path names positions in it.
  MapDocument? _sentDocument;

  /// The key and time of the last typed edit, so keystrokes in one field of one
  /// element within one autosave debounce are one undo step (DC-P4).
  String? _typedKey;
  DateTime? _typedAt;

  /// Asks "Stay or Leave without saving"; the screen supplies it.
  Future<bool> Function()? _askLeave;

  /// A leave that was approved stays approved until the document changes.
  bool _leaveApproved = false;

  @override
  EditorState build() {
    _clock = ref.read(autosaveClockProvider);
    _undo = UndoStack();
    _autosave = AutosaveController(
      send: _send,
      clock: _clock,
      onChanged: _publishSave,
    );
    final release = ref.read(pendingWorkGateProvider).register(confirmLeave);
    ref.onDispose(() {
      _autosave.dispose();
      release();
    });
    // The first load starts after this build returns: a build must not set state.
    unawaited(Future<void>.microtask(load));
    return const EditorState();
  }

  // ----------------------------------------------------------------- reading

  bool get _isReady => state.phase == EditorPhase.ready;

  /// Whether the drawing tools and the panels' inputs work: the account may
  /// draw (`venue-maps` update) and the save is not in conflict (DC-E8).
  bool get canEdit =>
      _isReady &&
      ref.read(editorAccessProvider).canDraw &&
      state.save != SaveState.conflict;

  /// The canvas scale in pixels per metre, reported by the canvas; the snap
  /// radius and the hit tolerance depend on it.
  set canvasScale(double pxPerMetre) => _pxPerMetre = pxPerMetre;

  /// Loads the map (and again on "Retry"): the four states of AC-58.
  Future<void> load() async {
    final generation = ++_loadGeneration;
    state = const EditorState();
    try {
      final loaded = await ref.read(mapEditorServiceProvider).load(venueId);
      if (!ref.mounted || generation != _loadGeneration) return;
      _applyLoad(loaded);
    } on DioException catch (error) {
      if (!ref.mounted || generation != _loadGeneration) return;
      state = error.response?.statusCode == 404
          ? const EditorState(phase: EditorPhase.notFound)
          : EditorState(phase: EditorPhase.error, loadError: error);
    } catch (error) {
      if (!ref.mounted || generation != _loadGeneration) return;
      state = EditorState(phase: EditorPhase.error, loadError: error);
    }
  }

  void _applyLoad(MapLoad loaded) {
    _undo.clear();
    _tool.cancel();
    _tool = EditorTool.select.create();
    _typedKey = null;
    _typedAt = null;
    _leaveApproved = false;
    _gestureStart = null;
    _sentDocument = null;
    _autosave.start(loaded.draftVersion);
    final draft = loaded.draft;
    state = draft == null
        ? EditorState(
            phase: EditorPhase.empty,
            venue: loaded.venue,
            publishing: loaded.publishing,
          )
        : EditorState(
            phase: EditorPhase.ready,
            venue: loaded.venue,
            document: draft,
            levelId: _defaultLevelId(draft),
            publishing: loaded.publishing,
          );
  }

  /// The floor shown first: an indoor ground floor (ordinal 0) of the first
  /// building when there is one, else the first tab.
  String? _defaultLevelId(MapDocument document) {
    final groups = floorTabGroups(document);
    for (final group in groups) {
      if (group.buildingId == null) continue;
      for (final level in group.levels) {
        if (level.ordinal == 0) return level.id;
      }
      break;
    }
    if (groups.isNotEmpty) return groups.first.levels.first.id;
    return document.levels.isEmpty ? null : document.levels.first.id;
  }

  // ------------------------------------------------------------------- saving

  Future<SaveOutcome> _send(int baseVersion) async {
    final document = state.document;
    if (document == null) return SaveFailed(StateError('no document'));
    _sentDocument = document;
    try {
      final ack = await ref
          .read(mapEditorServiceProvider)
          .saveDraft(venueId, mapDocumentToJson(document), baseVersion);
      return SaveSucceeded(ack);
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      final body = errorBodyOf(error);
      if (status == 409 && body != null && body['draftVersion'] is int) {
        return SaveStale(body['draftVersion'] as int);
      }
      if (status == 400 && body != null && body['problems'] is List) {
        final problems = [
          for (final text in body['problems'] as List<Object?>)
            if (text is String) MapProblem(text),
        ];
        final total = body['total'];
        return SaveRejected(
          problems: problems,
          total: total is int ? total : problems.length,
        );
      }
      return SaveFailed(error);
    } catch (error) {
      return SaveFailed(error);
    }
  }

  void _publishSave() {
    if (!ref.mounted) return;
    state = state.copyWith(
      save: _autosave.state,
      savedAt: _autosave.savedAt,
      problems: _autosave.problems,
      problemsTotal: _autosave.problemsTotal,
      saveError: _autosave.failure,
    );
  }

  /// "Try again" after an error (AC-72).
  Future<void> tryAgain() => _autosave.tryAgain();

  /// "Reload" after a conflict, once the admin has confirmed it (AC-71): the
  /// server's draft replaces the document, and the undo stack is reset.
  Future<void> reload() async {
    final generation = ++_loadGeneration;
    try {
      final loaded = await ref.read(mapEditorServiceProvider).load(venueId);
      if (!ref.mounted || generation != _loadGeneration) return;
      final keepLevel = state.levelId;
      _applyLoad(loaded);
      final document = state.document;
      if (document != null && keepLevel != null) {
        if (document.levelById(keepLevel) != null) {
          state = state.copyWith(levelId: keepLevel);
        }
      }
    } catch (error) {
      if (ref.mounted) _notify(ActionFailed(error));
    }
  }

  // --------------------------------------------------------------- the tools

  /// Picks a drawing tool (a viewer has only Select).
  void selectTool(EditorTool tool) {
    if (!_isReady) return;
    if (tool != EditorTool.select && !canEdit) return;
    _tool.cancel();
    _tool = tool.create();
    state = state.copyWith(tool: tool, preview: ToolPreview.none);
  }

  /// A level tab was chosen: it never asks anything (AC-61).
  void setActiveLevel(String levelId) {
    final document = state.document;
    if (document == null || document.levelById(levelId) == null) return;
    _tool.cancel();
    state = state.copyWith(
      levelId: levelId,
      selection: null,
      preview: ToolPreview.none,
    );
  }

  void pointerDown(Pt p, PointerMods mods) {
    if (!_isReady || state.level == null) return;
    if (!canEdit) {
      _selectOnly(p);
      return;
    }
    _tool.pointerDown(_Host(this), p, mods);
    _refreshPreview();
  }

  void pointerMove(Pt p, PointerMods mods) {
    if (!canEdit || state.level == null) return;
    _tool.pointerMove(_Host(this), p, mods);
    _refreshPreview();
  }

  void pointerUp(Pt p, PointerMods mods) {
    if (!canEdit || state.level == null) return;
    _tool.pointerUp(_Host(this), p, mods);
    _refreshPreview();
  }

  void hover(Pt p, PointerMods mods) {
    if (!canEdit || state.level == null) return;
    _tool.hover(_Host(this), p, mods);
    _refreshPreview();
  }

  /// A viewer, or an editor in conflict, can still pick things to read.
  void _selectOnly(Pt p) {
    final level = state.level;
    if (level == null || state.tool != EditorTool.select) return;
    final hit = hitTest(level, p, pxPerMetre: _pxPerMetre);
    _select(switch (hit) {
      ElementHit(:final kind, :final id) => Selection(kind, id),
      _ => null,
    });
  }

  /// A key for the tool (Enter, Esc, Delete). Esc steps back: the tool's own
  /// work in progress, then Select, then the selection. True when it was used.
  bool keyDown(ToolKey key, PointerMods mods) {
    if (!_isReady) return false;
    if (canEdit && _tool.key(_Host(this), key, mods)) {
      _refreshPreview();
      return true;
    }
    if (key != ToolKey.escape) return false;
    if (state.tool != EditorTool.select) {
      selectTool(EditorTool.select);
      return true;
    }
    if (state.selection != null) {
      _select(null);
      return true;
    }
    return false;
  }

  void _refreshPreview() {
    if (!ref.mounted) return;
    state = state.copyWith(preview: _tool.preview);
  }

  void _select(Selection? selection) {
    state = state.copyWith(selection: selection);
  }

  // What the tools' host reads and does (the host is another class, and state
  // is protected).
  MapDocument get _document => state.document!;
  Level get _level => state.level!;
  Selection? get _selection => state.selection;

  void _beginGesture() => _gestureStart = state.document;

  void _replaceLive(MapDocument next) {
    state = state.copyWith(document: next);
  }

  // ---------------------------------------------------------------- changes

  /// A change made from a panel: [change] edits the active level. [key] names
  /// the field, so keystrokes in one field within one debounce are one undo
  /// step (DC-P4).
  void edit(Level Function(Level level) change, {String? key}) {
    if (!canEdit) {
      _notify(const EditingBlocked());
      return;
    }
    final document = state.document;
    final level = state.level;
    if (document == null || level == null) return;
    _commit(
      document.withLevel(level.id, change),
      typedKey: key == null ? null : '${level.id}/$key',
    );
  }

  /// A change to the active floor's own fields (the floor panel): the rules an
  /// ordinal must keep, and the rectangle's fit, are checked first (AC-61).
  /// Returns the refusal, or null when the change was made.
  EditorNotice? editFloor(
    Level Function(Level level) change, {
    required String key,
  }) {
    if (!canEdit) {
      _notify(const EditingBlocked());
      return const EditingBlocked();
    }
    final document = state.document;
    final level = state.level;
    if (document == null || level == null) return null;
    final updated = change(level);
    if (identical(updated, level)) return null;
    if (updated.ordinal != level.ordinal) {
      final problem = checkFloorRules(
        document,
        buildingId: level.isOutdoor ? null : level.building,
        ordinal: updated.ordinal,
        editing: level.id,
      );
      if (problem != null) return _refuse(FloorRuleBroken(problem));
    }
    if (updated.origin != level.origin || updated.size != level.size) {
      final fit = checkFloorFit(document, level, updated.origin, updated.size);
      switch (fit.problem) {
        case FloorFitProblem.outsideVenue:
          return _refuse(const OutsideVenue());
        case FloorFitProblem.elementsOutside:
          return _refuse(ElementsOutside(fit.outsideCount));
        case null:
          break;
      }
    }
    _commit(
      document.withLevel(level.id, (_) => updated),
      typedKey: '${level.id}/$key',
    );
    return null;
  }

  EditorNotice _refuse(EditorNotice notice) {
    _notify(notice);
    return notice;
  }

  /// Replaces the whole document as one undo step and saves at once: the entry
  /// the Restore, Import and AI-conversion slices use (the plan's hook for
  /// later slices).
  void replaceDocument(MapDocument document) {
    if (!canEdit) return;
    _commit(document, structural: true);
  }

  /// Adds a floor (AC-61): to [buildingId], or the outdoor ground when null.
  /// One undo step and a structural save. Returns the refusal, or null.
  EditorNotice? addFloor({
    required String? buildingId,
    required String name,
    required String shortName,
    required String? spokenName,
    required int ordinal,
    required double elevation,
    required double height,
    required Pt origin,
    required Pt size,
    required String? finish,
  }) {
    final document = state.document;
    if (document == null || !canEdit) return const EditingBlocked();
    final cap = checkCap(Cap.levels, document.levels.length);
    if (cap != null) return _refuse(CapReached(cap));
    final problem = checkFloorRules(
      document,
      buildingId: buildingId,
      ordinal: ordinal,
    );
    if (problem != null) return _refuse(FloorRuleBroken(problem));
    final fit = checkFloorFit(
      document,
      Level(
        id: '',
        name: name,
        shortName: shortName,
        ordinal: ordinal,
        origin: origin,
        size: size,
      ),
      origin,
      size,
    );
    if (fit.problem == FloorFitProblem.outsideVenue) {
      return _refuse(const OutsideVenue());
    }
    final id = newLevelId(document.allIds());
    final level = Level(
      id: id,
      name: name,
      shortName: shortName,
      spokenName: spokenName,
      building: buildingId,
      outdoor: buildingId == null ? true : null,
      ordinal: ordinal,
      elevation: elevation == VenueMapConstants.elevationDefaultM
          ? null
          : elevation,
      height: height == VenueMapConstants.levelHeightDefaultM ? null : height,
      origin: origin,
      size: size,
      floorFinish: finish,
    );
    _commit(
      document.copyWith(levels: [...document.levels, level]),
      structural: true,
    );
    _tool.cancel();
    state = state.copyWith(
      levelId: id,
      selection: null,
      preview: ToolPreview.none,
    );
    return null;
  }

  /// The Blank-start dialog's "Create the map" (AC-59): reads the catalog's
  /// current version, makes the document, saves it at once with the loaded
  /// `draftVersion` as `baseVersion`. Returns the error, or null on success.
  Future<Object?> blankStart(BlankStartValues values) async {
    if (state.phase != EditorPhase.empty ||
        !ref.read(editorAccessProvider).canDraw) {
      return const EditingBlocked();
    }
    final int version;
    try {
      version = await ref.read(mapEditorServiceProvider).catalogVersion();
    } catch (error) {
      return error;
    }
    if (!ref.mounted) return null;
    final document = blankStartDocument(values, catalogVersion: version);
    _undo.clear();
    _typedKey = null;
    state = state.copyWith(
      phase: EditorPhase.ready,
      document: document,
      levelId: document.levels.first.id,
      selection: null,
      canUndo: false,
      canRedo: false,
    );
    _autosave.documentChanged();
    unawaited(_autosave.saveNow());
    return null;
  }

  void _commit(MapDocument next, {String? typedKey, bool structural = false}) {
    final before = state.document;
    if (before == null || identical(before, next)) return;
    final now = _clock.now();
    final lastAt = _typedAt;
    final coalesce =
        typedKey != null &&
        typedKey == _typedKey &&
        lastAt != null &&
        now.difference(lastAt) < EditorConstants.autosaveDebounce;
    if (!coalesce) _undo.push(before);
    _typedKey = typedKey;
    _typedAt = typedKey == null ? null : now;
    _leaveApproved = false;
    state = state.copyWith(
      document: next,
      canUndo: _undo.canUndo,
      canRedo: _undo.canRedo,
      selection: _validSelection(next, state.selection),
    );
    _autosave.documentChanged();
    if (structural) unawaited(_autosave.saveNow());
  }

  void _endGesture() {
    final start = _gestureStart;
    _gestureStart = null;
    final now = state.document;
    if (start == null || now == null || identical(start, now)) return;
    _undo.push(start);
    _typedKey = null;
    _typedAt = null;
    _leaveApproved = false;
    state = state.copyWith(
      canUndo: _undo.canUndo,
      canRedo: _undo.canRedo,
      selection: _validSelection(now, state.selection),
    );
    _autosave.documentChanged();
  }

  /// [selection] if the element is still on the active level, else none.
  Selection? _validSelection(MapDocument document, Selection? selection) {
    if (selection == null) return null;
    final level = document.levelById(state.levelId ?? '');
    if (level == null) return null;
    final exists = switch (selection.kind) {
      ElementKind.wall => level.wallList.any((w) => w.id == selection.id),
      ElementKind.opening => level.openingList.any((o) => o.id == selection.id),
      ElementKind.unit => level.unitList.any((u) => u.id == selection.id),
    };
    if (!exists) return null;
    final vertex = selection.vertex;
    if (vertex == null) return selection;
    for (final unit in level.unitList) {
      if (unit.id == selection.id && vertex < unit.poly.length) {
        return selection;
      }
    }
    return Selection(selection.kind, selection.id);
  }

  // ------------------------------------------------------------ undo and redo

  void undo() => _step(undo: true);
  void redo() => _step(undo: false);

  void _step({required bool undo}) {
    final current = state.document;
    if (!canEdit || current == null) return;
    final MapDocument? target = undo
        ? _undo.undo(current)
        : _undo.redo(current);
    if (target == null) return;
    _typedKey = null;
    _typedAt = null;
    _leaveApproved = false;
    _tool.cancel();
    final levelId = target.levelById(state.levelId ?? '') != null
        ? state.levelId
        : _defaultLevelId(target);
    state = state.copyWith(
      document: target,
      levelId: levelId,
      canUndo: _undo.canUndo,
      canRedo: _undo.canRedo,
      preview: ToolPreview.none,
    );
    state = state.copyWith(selection: _validSelection(target, state.selection));
    _autosave.documentChanged();
  }

  // ---------------------------------------------------------------- problems

  /// A click on a problem of a refused save selects the element its path names,
  /// on its level (AC-72). The path is read against the document that was sent.
  void selectProblem(MapProblem problem) {
    final current = state.document;
    final sent = _sentDocument ?? current;
    if (sent == null || current == null) return;
    final target = resolveProblem(sent, problem);
    final levelId = target?.levelId;
    if (target == null || levelId == null) return;
    if (current.levelById(levelId) == null) return;
    _tool.cancel();
    state = state.copyWith(levelId: levelId, preview: ToolPreview.none);
    final selection = target.selection;
    state = state.copyWith(
      selection: selection == null ? null : _validSelection(current, selection),
    );
  }

  // ---------------------------------------------------------------- publish

  /// "Publish" (AC-74): waits for a running save, refuses while the save is in
  /// error or conflict, refreshes the running-publish banner, and says whether
  /// the view may open the publish page (false: a publish is building, or the
  /// admin has been told why not).
  Future<bool> requestPublish() async {
    if (!ref.read(editorAccessProvider).canPublish) return false;
    await _autosave.settle(timeout: EditorConstants.leaveSaveWait);
    if (!ref.mounted) return false;
    if (state.save == SaveState.error || state.save == SaveState.conflict) {
      _notify(const FixSaveFirst());
      return false;
    }
    try {
      final loaded = await ref.read(mapEditorServiceProvider).load(venueId);
      if (!ref.mounted) return false;
      state = state.copyWith(publishing: loaded.publishing);
      return loaded.publishing == null;
    } catch (error) {
      if (ref.mounted) _notify(ActionFailed(error));
      return false;
    }
  }

  // ------------------------------------------------------------- leaving

  /// The screen supplies the "Stay or Leave without saving" question.
  // ignore: use_setters_to_change_properties
  void attachLeaveQuestion(Future<bool> Function()? ask) => _askLeave = ask;

  /// Called before the page is left, a tenant is switched or the person signs
  /// out (AC-73): finishes any pending or running save, and when the state is
  /// error or conflict asks Stay (default) or Leave without saving. True when
  /// it is fine to go on.
  ///
  /// With no session left (a 401 ended it) nothing can be sent, and the request
  /// that got the 401 never completes, so it answers true at once.
  Future<bool> confirmLeave() async {
    if (!ref.mounted || !_isReady) return true;
    if (ref.read(sessionProvider) is! SignedIn) return true;
    await _autosave.settle(timeout: EditorConstants.leaveSaveWait);
    if (!ref.mounted) return true;
    final saveState = _autosave.state;
    if (saveState != SaveState.error && saveState != SaveState.conflict) {
      return true;
    }
    if (_leaveApproved) return true;
    final ask = _askLeave;
    if (ask == null) return true;
    final leave = await ask();
    if (leave) _leaveApproved = true;
    return leave;
  }

  // ----------------------------------------------------------------- notices

  void _notify(EditorNotice notice) {
    if (!ref.mounted) return;
    state = state.copyWith(
      notice: notice,
      noticeSerial: state.noticeSerial + 1,
    );
  }
}

/// The ViewModel's face to the tools: what a tool may do, and nothing more.
class _Host implements ToolContext {
  _Host(this._vm);

  final EditorViewModel _vm;

  @override
  MapDocument get document => _vm._document;

  @override
  Level get level => _vm._level;

  @override
  double get pxPerMetre => _vm._pxPerMetre;

  @override
  Selection? get selection => _vm._selection;

  @override
  void select(Selection? selection) => _vm._select(selection);

  @override
  void commit(MapDocument next) => _vm._commit(next);

  @override
  void beginGesture() => _vm._beginGesture();

  @override
  void replaceLive(MapDocument next) => _vm._replaceLive(next);

  @override
  void endGesture() => _vm._endGesture();

  @override
  void notify(EditorNotice notice) => _vm._notify(notice);

  @override
  String newId(String prefix) => newElementId(prefix, document.allIds());
}

/// The editor of venue [venueId]. It is disposed when the page is left, so
/// coming back is a fresh load (definition-of-done item 7 met by construction).
final editorViewModelProvider = NotifierProvider.autoDispose
    .family<EditorViewModel, EditorState, int>(EditorViewModel.new);
