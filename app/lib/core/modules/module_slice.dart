import '../../l10n/app_localizations.dart';

/// Which slice of the feature-first plan (`plan/PH4-feature-first.md`)
/// delivers a module, in the words a placeholder page shows: "Delivered by
/// FF-1", "After the retrofit (P1)", "Delivered by the retrofit (R6, R9)".
///
/// The codes are looked up in the plan by a test (`module_registry_test.dart`),
/// so a renamed slice cannot go stale here.
class ModuleSlice {
  /// Built by feature slice [code] (`FF-1`), and, for a module with a second
  /// part in the retrofit, also by [retrofit] (`R10`).
  const ModuleSlice.feature(String code, {String? retrofit})
    : _kind = retrofit == null
          ? _SliceKind.feature
          : _SliceKind.featureAndRetrofit,
      _value = code,
      _second = retrofit;

  /// Built by the retrofit slices [slices] (`R6, R9`).
  const ModuleSlice.retrofit(String slices)
    : _kind = _SliceKind.retrofit,
      _value = slices,
      _second = null;

  /// Not before the retrofit is done: tier [phase] (`P1`, `P2`, `P3`).
  const ModuleSlice.afterRetrofit(String phase)
    : _kind = _SliceKind.afterRetrofit,
      _value = phase,
      _second = null;

  final _SliceKind _kind;
  final String _value;
  final String? _second;

  /// The slice in words, from ARB.
  String label(AppLocalizations l10n) => switch (_kind) {
    _SliceKind.feature => l10n.sliceFeature(_value),
    _SliceKind.featureAndRetrofit => l10n.sliceFeatureAndRetrofit(
      _value,
      _second!,
    ),
    _SliceKind.retrofit => l10n.sliceRetrofit(_value),
    _SliceKind.afterRetrofit => l10n.sliceAfterRetrofit(_value),
  };
}

enum _SliceKind { feature, featureAndRetrofit, retrofit, afterRetrofit }
