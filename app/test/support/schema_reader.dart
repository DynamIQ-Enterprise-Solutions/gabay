import 'dart:io';

/// One column of `db/schema.sql`, read for the specs' tests (FF-1: the
/// `FieldSpec`s must match the schema, and `DecimalRange` the CHECKs). The
/// `schema-forms` linter checks kind, required, maxLength and scale in
/// `npm run verify`; these tests add what it does not read (precision and the
/// range) and name the specs explicitly.
class SchemaColumn {
  SchemaColumn({
    required this.table,
    required this.name,
    required this.type,
    required this.length,
    required this.precision,
    required this.scale,
    required this.notNull,
    required this.hasDefault,
    required this.isForeignKey,
    required this.checkText,
  });

  final String table;
  final String name;

  /// `VARCHAR`, `DECIMAL`, `INT`, `BOOLEAN`, ...
  final String type;
  final int? length;
  final int? precision;
  final int? scale;
  final bool notNull;
  final bool hasDefault;
  final bool isForeignKey;

  /// The text of the column's own CHECK, or null.
  final String? checkText;
}

/// Reads one table of `db/schema.sql` (the tests run in `app/`, so the file is
/// one level up).
Map<String, SchemaColumn> readSchemaTable(String table) {
  final sql = File('../db/schema.sql').readAsStringSync();
  final start = RegExp(
    'CREATE TABLE gabay\\.$table \\(',
    caseSensitive: false,
  ).firstMatch(sql);
  if (start == null) throw StateError('no table $table in db/schema.sql');
  final end = sql.indexOf('\n);', start.end);
  final lines = sql.substring(start.end, end).split('\n');

  final columns = <String, SchemaColumn>{};
  // A column starts at four spaces and a name; a CHECK may continue on the
  // next line, indented further.
  final head = RegExp(r'^    (\w+)\s+([A-Z]+)(?:\((\d+)(?:,(\d+))?\))?(.*)$');
  for (var i = 0; i < lines.length; i++) {
    final match = head.firstMatch(lines[i]);
    if (match == null) continue;
    final name = match.group(1)!;
    if (name == 'CONSTRAINT') continue;
    var rest = match.group(5)!;
    if (i + 1 < lines.length && lines[i + 1].startsWith('      ')) {
      rest = '$rest ${lines[i + 1].trim()}';
    }
    final type = match.group(2)!;
    final first = match.group(3);
    final second = match.group(4);
    final isDecimal = type == 'DECIMAL';
    final check = RegExp(r'CHECK\s*\((.*?)\)(?:,|\s*--|$)').firstMatch(rest);
    columns[name] = SchemaColumn(
      table: table,
      name: name,
      type: type,
      length: type == 'VARCHAR' && first != null ? int.parse(first) : null,
      precision: isDecimal && first != null ? int.parse(first) : null,
      scale: isDecimal && second != null ? int.parse(second) : null,
      notNull: rest.contains('NOT NULL') || rest.contains('PRIMARY KEY'),
      hasDefault:
          rest.contains(' DEFAULT ') || rest.contains('GENERATED ALWAYS'),
      isForeignKey: rest.contains('REFERENCES'),
      checkText: check?.group(1),
    );
  }
  return columns;
}
