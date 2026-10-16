import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// The browser's leave warning on the admin web page (E-23): a `beforeunload`
/// handler that asks the browser for its own confirmation while [shouldWarn] is
/// true. The browser words the dialog itself (a page may not), and shows it only
/// after the page has had a user interaction, as browsers require.
class LeaveWarning {
  LeaveWarning._(this._listener);

  final JSFunction _listener;

  /// Starts warning; the page's one `beforeunload` listener for this screen.
  static LeaveWarning install(bool Function() shouldWarn) {
    final listener = ((web.Event event) {
      if (!shouldWarn()) return;
      event.preventDefault();
      (event as web.BeforeUnloadEvent).returnValue = '';
    }).toJS;
    web.window.addEventListener('beforeunload', listener);
    return LeaveWarning._(listener);
  }

  /// Stops warning (the editor was left).
  void remove() => web.window.removeEventListener('beforeunload', _listener);
}
