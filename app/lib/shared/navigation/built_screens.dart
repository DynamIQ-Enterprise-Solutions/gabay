import 'package:flutter/widgets.dart';

/// The screens of modules that are built, by module id. A slice that delivers a
/// module adds its entry here and flips `built` to true in the module registry
/// (`core/modules/module_registry.dart`); until then the module opens the
/// shared placeholder page. A test fails when the flag and the entry disagree.
///
/// Empty at FF-SK: FF-0 has no module.
final Map<String, WidgetBuilder> builtAdminScreens = <String, WidgetBuilder>{};

/// The same for the shopper app's tabs, by tab id (`map`, `places`, ...).
final Map<String, WidgetBuilder> builtShopperScreens =
    <String, WidgetBuilder>{};
