import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/modules/module_registry.dart';
import '../../../l10n/app_localizations.dart';

/// A window at least this wide (logical px) gets the rail; narrower gets the
/// bottom bar. Tablets get the wide layout (L103).
const double kShopperWideBreakpoint = 600;

/// The shopper app's shell (FF-SK plan section 6): the Gabay Demo app's four
/// tabs, Places, Map, Parking and Me (L85), as a bottom bar on a phone and a
/// rail on a tablet. Each tab is its own branch, so it keeps its place while
/// another is open. The tabs come from the module registry.
class ShopperShell extends StatelessWidget {
  const ShopperShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  void _goTo(int index) => navigationShell.goBranch(
    index,
    // Tapping the current tab returns it to its first page.
    initialLocation: index == navigationShell.currentIndex,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tabs = ModuleRegistry.shopper;
    final current = navigationShell.currentIndex;
    final wide = MediaQuery.sizeOf(context).width >= kShopperWideBreakpoint;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          tabs[current].name(l10n),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: wide
          ? Row(
              children: [
                NavigationRail(
                  selectedIndex: current,
                  onDestinationSelected: _goTo,
                  labelType: NavigationRailLabelType.all,
                  destinations: [
                    for (final tab in tabs)
                      NavigationRailDestination(
                        icon: Icon(tab.icon),
                        label: Text(tab.name(l10n)),
                      ),
                  ],
                ),
                const VerticalDivider(width: 1),
                Expanded(child: navigationShell),
              ],
            )
          : navigationShell,
      bottomNavigationBar: wide
          ? null
          : Semantics(
              container: true,
              explicitChildNodes: true,
              label: l10n.shopperTabsLabel,
              child: NavigationBar(
                selectedIndex: current,
                onDestinationSelected: _goTo,
                destinations: [
                  for (final tab in tabs)
                    NavigationDestination(
                      icon: Icon(tab.icon),
                      label: tab.name(l10n),
                    ),
                ],
              ),
            ),
    );
  }
}
