import 'package:flutter/foundation.dart';

/// The kinds of element the editor selects in this slice. A level is selected
/// when nothing else is: its panel is the floor panel.
enum ElementKind { wall, opening, unit }

/// What is selected: one element of the active level, and, for a polygon, the
/// vertex that is selected on it (Delete removes it, AC-62). Several elements
/// at once is OA-4a-2 (AC-85).
@immutable
class Selection {
  const Selection(this.kind, this.id, {this.vertex});

  final ElementKind kind;
  final String id;

  /// The index of the selected vertex of a unit's polygon, or null.
  final int? vertex;

  Selection withVertex(int? index) => Selection(kind, id, vertex: index);

  @override
  bool operator ==(Object other) =>
      other is Selection &&
      other.kind == kind &&
      other.id == id &&
      other.vertex == vertex;

  @override
  int get hashCode => Object.hash(kind, id, vertex);

  @override
  String toString() => 'Selection(${kind.name} $id, vertex $vertex)';
}
