import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../models/map_problem.dart';
import 'editor_keys.dart';

/// The problems of a refused save (P0-11 r3 AC-72): at most the API's 20, with
/// the total, each as the API worded it. A click selects the element its path
/// names, on its level. The drawing is on screen and is not lost.
class ProblemsList extends StatelessWidget {
  const ProblemsList({
    required this.problems,
    required this.total,
    required this.onPick,
    super.key,
  });

  final List<MapProblem> problems;
  final int total;
  final ValueChanged<MapProblem> onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        color: scheme.errorContainer,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 180),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              Row(
                children: [
                  Icon(Icons.error_outline, color: scheme.onErrorContainer),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.mapProblemsHeader(total),
                      style: Theme.of(context).textTheme.titleSmall
                          ?.copyWith(color: scheme.onErrorContainer),
                    ),
                  ),
                ],
              ),
              for (var i = 0; i < problems.length; i++)
                Semantics(
                  hint: l10n.mapProblemSelect,
                  child: ListTile(
                    key: EditorKeys.problem(i),
                    dense: true,
                    textColor: scheme.onErrorContainer,
                    title: Text(problems[i].text),
                    onTap: () => onPick(problems[i]),
                  ),
                ),
              if (total > problems.length)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    l10n.mapProblemsShowing(problems.length, total),
                    style: TextStyle(color: scheme.onErrorContainer),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
