import '../../features/session/viewmodels/active_tenant.dart';
import '../../features/session/viewmodels/session_state.dart';
import 'app_paths.dart';
import 'permission_check.dart';

/// The longest `from` value the guard honours, in characters (DC-22). A longer
/// one is ignored, not truncated: a crafted link is refused, not trimmed into
/// something else.
const int kMaxFromLength = 2048;

/// The admin surface's one redirect, as a pure function of the session, the
/// tenant in effect and the location (SEC-3, AC-30). It decides in this order:
///
/// 1. Signed out (or the restore not read yet): `/login`, carrying the page the
///    person was on as `from` (the page they were on, with its query), except
///    on `/login` itself, and except after a manual sign-out, which carries
///    nothing (AC-23, AC-42).
/// 2. Signed in (the account loading, failed or known) and on `/login` or `/`:
///    the valid `from` of the address, else `/admin`.
/// 3. The account loading or failed, anywhere else: no redirect. The shell shows
///    that state in place of the page (AC-41).
/// 4. Signed in and under `/admin`: the permission check of AC-31; a page the
///    account may not open goes to `/unauthorized`.
///
/// Returns the location to go to, or null to stay.
String? adminRedirect(SessionState session, ActiveTenant tenant, Uri location) {
  final path = location.path;
  final onLogin = path == AuthPaths.login;
  switch (session) {
    case SessionRestoring():
    case SignedOut():
      if (onLogin) return null;
      final manual =
          session is SignedOut && session.reason == SignedOutReason.manual;
      return AuthPaths.loginWith(from: manual ? null : _fromFor(location));
    case LoadingAccount():
    case AccountError():
      if (onLogin || path == '/') {
        return fromParameter(location) ?? AdminPaths.home;
      }
      return null;
    case SignedIn(:final profile):
      if (onLogin || path == '/') {
        return fromParameter(location) ?? AdminPaths.home;
      }
      final verdict = permissionVerdict(
        profile: profile,
        tenant: tenant,
        path: path,
      );
      return verdict == PermissionVerdict.forbidden
          ? AdminPaths.unauthorized
          : null;
  }
}

/// The address to come back to after a sign-in, from the page [location]: the
/// page itself when it is a valid admin page, else none.
String? _fromFor(Uri location) {
  final candidate = location.hasQuery
      ? '${location.path}?${location.query}'
      : location.path;
  return safeFrom(Uri.encodeQueryComponent(candidate));
}

/// The valid `from` of [location] (a `/login?from=...` address), or null when
/// there is none, there is more than one (a repeated parameter is ignored, not
/// resolved to the first, DC-22), or the value is not safe (see [safeFrom]).
///
/// The value is read from the address's raw query, so it is percent-decoded
/// exactly once, in [safeFrom].
String? fromParameter(Uri location) {
  if (!location.hasQuery) return null;
  String? raw;
  var count = 0;
  for (final pair in location.query.split('&')) {
    final equals = pair.indexOf('=');
    final name = equals < 0 ? pair : pair.substring(0, equals);
    if (name != AuthPaths.fromParam) continue;
    count++;
    raw = equals < 0 ? '' : pair.substring(equals + 1);
  }
  return count == 1 ? safeFrom(raw) : null;
}

/// [raw] (a `from` value as it sits in the address, percent-encoded) as an
/// address that is safe to go to after signing in, or null (SEC-3, AC-42,
/// EC-41). It is decoded once, and kept only when it is then a path under
/// `/admin`, with an optional query, that is:
///
/// - not empty, not longer than [kMaxFromLength], with no control character or
///   backslash;
/// - a path, not an address: no scheme, no host, no leading `//`;
/// - still under `/admin` after the `.` and `..` segments are resolved (so
///   `/admin/../login` is `/login` and is refused), and never `/login` or `/`.
///
/// The fragment is dropped. Anything else gives null, and the person goes to
/// `/admin`.
String? safeFrom(String? raw) {
  if (raw == null || raw.isEmpty || raw.length > kMaxFromLength) return null;
  final String decoded;
  try {
    decoded = Uri.decodeQueryComponent(raw);
  } on FormatException {
    return null;
  } on ArgumentError {
    return null;
  }
  if (decoded.isEmpty || decoded.length > kMaxFromLength) return null;
  if (RegExp(r'[\u0000-\u001f\u007f\\]').hasMatch(decoded)) return null;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  // A still-encoded dot is a dot, and a still-encoded slash is refused: a path
  // that the router would read differently from the check below is no path.
  final cut = decoded.indexOf('?');
  final pathPart = cut < 0 ? decoded : decoded.substring(0, cut);
  final queryPart = cut < 0 ? '' : decoded.substring(cut);
  if (RegExp('%2f|%5c', caseSensitive: false).hasMatch(pathPart)) return null;
  final undotted =
      pathPart.replaceAll(RegExp('%2e', caseSensitive: false), '.') + queryPart;
  final parsed = Uri.tryParse(undotted);
  if (parsed == null || parsed.hasScheme || parsed.hasAuthority) return null;
  final normalised = parsed.normalizePath();
  final path = normalised.path;
  if (path != AdminPaths.home && !path.startsWith('${AdminPaths.home}/')) {
    return null;
  }
  return normalised.hasQuery ? '$path?${normalised.query}' : path;
}
