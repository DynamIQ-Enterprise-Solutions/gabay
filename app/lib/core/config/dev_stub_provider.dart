import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_config.dart';
import 'surface_info.dart';
import 'surface_provider.dart';

/// Whether this build may talk to the development stand-in at all (E-20): not
/// a release build, or one made with `DEV_STUB=true`. Surface-free, so the
/// network layer can ask it without knowing which app it is in.
final Provider<bool> devStubBuildProvider = Provider<bool>(
  (ref) => AppConfig.showsDevStubBanner(
    releaseMode: kReleaseMode,
    devStubDefine: AppConfig.devStubDefine,
  ),
);

/// Whether this process shows the "Development build: no sign-in" banner
/// (E-20). Only the admin page has one: the shopper app has no stub and no
/// banner. A test overrides it to try a release build.
final Provider<bool> devStubBannerVisibleProvider = Provider<bool>(
  (ref) =>
      ref.watch(surfaceProvider).surface == AppSurface.admin &&
      ref.watch(devStubBuildProvider),
);
