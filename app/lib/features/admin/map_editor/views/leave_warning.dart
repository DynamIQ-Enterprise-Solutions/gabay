/// The browser's own leave warning while the editor holds unsaved work (P0-11 r3
/// AC-73; plan 1.1 section 0.3, DC-P6'). Closing or reloading the tab while the
/// save is dirty, running, in error or in conflict shows the browser's own
/// confirmation; there is **no** best-effort send at unload (that needs a fresh
/// ID token at a synchronous moment, which SEC-3 AC-20 forbids the client to keep).
///
/// `package:web` cannot compile in the VM tests or on the phone, so the web
/// implementation is picked by a conditional import: on every other platform
/// [LeaveWarning.install] does nothing.
library;

export 'leave_warning_stub.dart'
    if (dart.library.js_interop) 'leave_warning_web.dart';
