/// A query named an id the open package does not hold (P0-06 EC-14, EC-97).
///
/// Ids are the venue map document's strings (AC-27 and §3 item 10): matching
/// is exact and case-sensitive, so an id that differs from a real one only in
/// case, or that breaks the id pattern, is unknown and never matches another.
class UnknownRoutingIdError implements Exception {
  const UnknownRoutingIdError(this.kind, this.id);

  /// What was looked up, for example `place`.
  final String kind;

  /// The id that was asked for.
  final String id;

  @override
  String toString() => 'UnknownRoutingIdError: no $kind "$id" in the package';
}
