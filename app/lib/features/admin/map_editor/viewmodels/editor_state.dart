import '../models/map_document.dart';
import '../models/map_load.dart';
import '../models/map_problem.dart';
import '../models/selection.dart';
import '../tools/editor_notice.dart';
import '../tools/tool_context.dart';
import '../tools/tool_controller.dart';
import 'autosave_controller.dart';

/// Which of the editor's four states the page is in (AC-58), plus the
/// not-found page.
enum EditorPhase {
  /// The map is loading.
  loading,

  /// The load failed: the message and Retry.
  error,

  /// The venue has no map (the draft is null): "Start a blank map".
  empty,

  /// Another tenant's venue, or none by that id: "Not found", no editor.
  notFound,

  /// The map is loaded and drawn.
  ready,
}

/// What the screen shows, as one immutable value held by the ViewModel
/// (MVVM: the view reads this and calls the ViewModel's methods).
///
/// The document, the active level and the selection are what OA-6's preview
/// reads (plan: hooks for later slices); the document is exposed as read-only
/// data because it is immutable.
class EditorState {
  const EditorState({
    this.phase = EditorPhase.loading,
    this.loadError,
    this.venue,
    this.document,
    this.levelId,
    this.tool = EditorTool.select,
    this.selection,
    this.preview = ToolPreview.none,
    this.save = SaveState.none,
    this.savedAt,
    this.problems = const <MapProblem>[],
    this.problemsTotal = 0,
    this.saveError,
    this.canUndo = false,
    this.canRedo = false,
    this.publishing,
    this.notice,
    this.noticeSerial = 0,
  });

  final EditorPhase phase;

  /// What the load threw, for `formatApiError`.
  final Object? loadError;

  /// The venue, once the load answered.
  final MapVenue? venue;

  /// The document being edited; null until the map is loaded and while empty.
  final MapDocument? document;

  /// The level being drawn on (the active floor tab).
  final String? levelId;

  final EditorTool tool;
  final Selection? selection;

  /// The tool's work in progress, for the painter.
  final ToolPreview preview;

  final SaveState save;

  /// When the last save finished.
  final DateTime? savedAt;

  /// The problems of a refused save (at most 20) and how many there were.
  final List<MapProblem> problems;
  final int problemsTotal;

  /// What a failed save threw, for `formatApiError`.
  final Object? saveError;

  final bool canUndo;
  final bool canRedo;

  /// A publish of this venue that is building now (AC-74).
  final PublishingInfo? publishing;

  /// The last thing to tell the admin in a sentence; [noticeSerial] changes
  /// with each, so the same notice twice is shown twice.
  final EditorNotice? notice;
  final int noticeSerial;

  /// The active level, or null.
  Level? get level {
    final id = levelId;
    return id == null ? null : document?.levelById(id);
  }

  EditorState copyWith({
    EditorPhase? phase,
    Object? loadError,
    MapVenue? venue,
    Object? document = _keep,
    Object? levelId = _keep,
    EditorTool? tool,
    Object? selection = _keep,
    ToolPreview? preview,
    SaveState? save,
    Object? savedAt = _keep,
    List<MapProblem>? problems,
    int? problemsTotal,
    Object? saveError = _keep,
    bool? canUndo,
    bool? canRedo,
    Object? publishing = _keep,
    EditorNotice? notice,
    int? noticeSerial,
  }) => EditorState(
    phase: phase ?? this.phase,
    loadError: loadError ?? this.loadError,
    venue: venue ?? this.venue,
    document: identical(document, _keep)
        ? this.document
        : document as MapDocument?,
    levelId: identical(levelId, _keep) ? this.levelId : levelId as String?,
    tool: tool ?? this.tool,
    selection: identical(selection, _keep)
        ? this.selection
        : selection as Selection?,
    preview: preview ?? this.preview,
    save: save ?? this.save,
    savedAt: identical(savedAt, _keep) ? this.savedAt : savedAt as DateTime?,
    problems: problems ?? this.problems,
    problemsTotal: problemsTotal ?? this.problemsTotal,
    saveError: identical(saveError, _keep) ? this.saveError : saveError,
    canUndo: canUndo ?? this.canUndo,
    canRedo: canRedo ?? this.canRedo,
    publishing: identical(publishing, _keep)
        ? this.publishing
        : publishing as PublishingInfo?,
    notice: notice ?? this.notice,
    noticeSerial: noticeSerial ?? this.noticeSerial,
  );
}

const Object _keep = Object();
