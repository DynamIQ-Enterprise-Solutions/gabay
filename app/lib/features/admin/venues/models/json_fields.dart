/// Typed readers for the venue API's JSON.
///
/// The models read a reply through these, so a reply of the wrong shape is a
/// [FormatException] (`formatApiError` words it "unexpected reply"), never a
/// null-check crash or a silently wrong value.
library;

/// [value] as an object, or a [FormatException] naming [what].
Map<String, Object?> jsonObject(Object? value, String what) {
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected $what as an object.');
}

int jsonInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is int) return value;
  throw FormatException('Expected "$key" as a whole number.');
}

String jsonString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String) return value;
  throw FormatException('Expected "$key" as text.');
}

String? jsonStringOrNull(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value == null) return null;
  return jsonString(json, key);
}

bool jsonBool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is bool) return value;
  throw FormatException('Expected "$key" as true or false.');
}
