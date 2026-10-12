import 'package:flutter/material.dart';

import '../../../core/modules/module_registry.dart';
import '../../../shared/components/module_placeholder.dart';
import '../../../shared/navigation/built_screens.dart';

/// One shopper tab's page (FF-SK plan section 6): its own screen once a slice
/// has built it (`built_screens.dart`), else the shared placeholder. No
/// package and no API call.
class ShopperTabScreen extends StatelessWidget {
  const ShopperTabScreen({required this.tab, super.key});

  final ShopperTab tab;

  @override
  Widget build(BuildContext context) {
    final built = builtShopperScreens[tab.id];
    if (tab.built && built != null) return built(context);
    return ModulePlaceholderBody(module: tab);
  }
}
