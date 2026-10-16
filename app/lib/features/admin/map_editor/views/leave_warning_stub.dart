/// The leave warning where there is no browser tab (the VM tests, the phone):
/// nothing to install, nothing to remove.
class LeaveWarning {
  LeaveWarning._();

  /// Installs nothing; [shouldWarn] is never called.
  static LeaveWarning install(bool Function() shouldWarn) => LeaveWarning._();

  void remove() {}
}
