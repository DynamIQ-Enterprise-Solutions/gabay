import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/editor_notice.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';

/// Test support for the map editor (plan section 4). Invented data only.

/// A `Random` whose `nextInt(n)` counts up (0, 1, 2, ...) modulo `n`, so a
/// generated id is the same on every run: the first id's six characters are
/// `012345`, the next `6789ab`, and so on. A fixture can then hold the ids.
class SequenceRandom implements Random {
  int _next = 0;

  @override
  int nextInt(int max) => _next++ % max;

  @override
  bool nextBool() => nextInt(2) == 1;

  @override
  double nextDouble() => nextInt(1000) / 1000;
}

/// The committed fixture [name] under `test/fixtures/editor/`, as decoded JSON.
Object? fixtureJson(String name) =>
    jsonDecode(File('test/fixtures/editor/$name').readAsStringSync());

/// The fixture as a document.
MapDocument fixtureDocument(String name) =>
    mapDocumentFromJson(fixtureJson(name));

/// Compares [document]'s JSON with the committed fixture [name], deep-equal
/// (the same ids, the same order of every array). With
/// `GABAY_WRITE_FIXTURES=1` the fixture is written instead, so a changed
/// producer is reviewed as a diff of the file. The Node test
/// `functions/test/venueMap.editorDocuments.test.js` feeds the same files to
/// `PUT .../map/draft` (plan section 4).
void expectMatchesFixture(String name, MapDocument document) {
  final produced = jsonDecode(jsonEncode(mapDocumentToJson(document)));
  final file = File('test/fixtures/editor/$name');
  if (Platform.environment['GABAY_WRITE_FIXTURES'] == '1') {
    file.writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(produced)}\n',
    );
    return;
  }
  expect(produced, equals(jsonDecode(file.readAsStringSync())));
}

/// A level with a rectangle of [width] by [depth] metres at the origin and
/// nothing drawn on it.
Level plainLevel({
  String id = 'L1',
  double width = 40,
  double depth = 40,
  Pt origin = const Pt(0, 0),
  List<Wall>? walls,
  List<Opening>? openings,
  List<Unit>? units,
}) => Level(
  id: id,
  name: 'Ground',
  shortName: 'G',
  building: 'b-main',
  ordinal: 0,
  origin: origin,
  size: Pt(width, depth),
  walls: walls,
  openings: openings,
  units: units,
);

/// A document with one building and the given levels.
MapDocument documentOf(
  List<Level> levels, {
  List<Building>? buildings,
}) => MapDocument(
  catalog: 7,
  site: const Site(boundary: [Pt(0, 0), Pt(100, 0), Pt(100, 100), Pt(0, 100)]),
  buildings:
      buildings ?? const [Building(id: 'b-main', name: 'Main', type: 'MAIN')],
  levels: levels,
);

Wall wallAt(String id, Pt a, Pt b, {double? t, String? kind}) =>
    Wall(id: id, a: a, b: b, t: t, kind: kind);

Unit rectUnit(String id, Pt a, Pt b, {String category = 'room'}) =>
    Unit(id: id, category: category, poly: [a, Pt(b.x, a.z), b, Pt(a.x, b.z)]);

/// A [ToolContext] that records what a tool does, over a document it holds.
class FakeToolContext implements ToolContext {
  FakeToolContext(this._document, {this.levelId = 'L1', this.pxPerMetre = 20})
    : selectionValue = null;

  MapDocument _document;
  final String levelId;

  @override
  final double pxPerMetre;

  Selection? selectionValue;

  /// Every document passed to [commit], in order.
  final List<MapDocument> commits = [];

  /// Every notice, in order.
  final List<EditorNotice> notices = [];

  /// How many gestures began and ended, and the live documents in between.
  int gesturesBegun = 0;
  int gesturesEnded = 0;
  final List<MapDocument> live = [];

  /// The document when the current gesture began.
  MapDocument? _gestureStart;

  /// Steps recorded as the ViewModel would: one per commit, one per gesture
  /// that changed the document.
  int steps = 0;

  final Random _random = SequenceRandom();

  @override
  MapDocument get document => _document;

  @override
  Level get level => _document.levelById(levelId)!;

  @override
  Selection? get selection => selectionValue;

  @override
  void select(Selection? selection) => selectionValue = selection;

  @override
  void commit(MapDocument next) {
    commits.add(next);
    _document = next;
    steps++;
  }

  @override
  void beginGesture() {
    gesturesBegun++;
    _gestureStart = _document;
  }

  @override
  void replaceLive(MapDocument next) {
    live.add(next);
    _document = next;
  }

  @override
  void endGesture() {
    gesturesEnded++;
    if (!identical(_gestureStart, _document)) steps++;
    _gestureStart = null;
  }

  @override
  void notify(EditorNotice notice) => notices.add(notice);

  @override
  String newId(String prefix) {
    final used = _document.allIds();
    while (true) {
      final chars = StringBuffer();
      for (var i = 0; i < 6; i++) {
        chars.write(
          '0123456789abcdefghijklmnopqrstuvwxyz'[_random.nextInt(36)],
        );
      }
      final id = '$prefix-$chars';
      if (!used.contains(id)) return id;
    }
  }
}

/// A manual clock: time moves only when a test says so, and a scheduled
/// callback runs when its time comes.
class FakeAutosaveClock implements AutosaveClock {
  DateTime _now = DateTime.utc(2026, 10, 16, 8);
  final List<_Scheduled> _scheduled = [];

  @override
  DateTime now() => _now;

  @override
  Timer schedule(Duration delay, void Function() callback) {
    final item = _Scheduled(_now.add(delay), callback);
    _scheduled.add(item);
    return _FakeTimer(item);
  }

  /// How many timers are waiting.
  int get pending => _scheduled.where((s) => !s.done).length;

  /// Moves time forward, running what comes due in order.
  void advance(Duration by) {
    final target = _now.add(by);
    while (true) {
      final due =
          _scheduled.where((s) => !s.done && !s.at.isAfter(target)).toList()
            ..sort((a, b) => a.at.compareTo(b.at));
      if (due.isEmpty) break;
      final next = due.first;
      _now = next.at;
      next.done = true;
      next.callback();
    }
    _now = target;
  }
}

class _Scheduled {
  _Scheduled(this.at, this.callback);

  final DateTime at;
  final void Function() callback;
  bool done = false;
}

class _FakeTimer implements Timer {
  _FakeTimer(this._item);

  final _Scheduled _item;

  @override
  void cancel() => _item.done = true;

  @override
  bool get isActive => !_item.done;

  @override
  int get tick => 0;
}
