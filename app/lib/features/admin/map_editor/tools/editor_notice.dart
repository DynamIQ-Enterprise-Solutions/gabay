import '../models/floor_rules.dart';
import '../models/map_limits.dart';

/// Something the editor tells the admin in a sentence: a refusal, a limit, a
/// segment ignored. The ViewModel and the tools hold these as data; the view
/// words them from ARB (`noticeText`), so no wording sits in logic (AC-134).
sealed class EditorNotice {
  const EditorNotice();
}

/// A wall segment shorter than `wallMinLengthM` was ignored (AC-63).
final class WallTooShort extends EditorNotice {
  const WallTooShort();
}

/// A unit smaller than `polyMinAreaM2` was ignored (AC-64).
final class UnitTooSmall extends EditorNotice {
  const UnitTooSmall();
}

/// A tool refused to add beyond a cap, naming it and the count (AC-75).
final class CapReached extends EditorNotice {
  const CapReached(this.refusal);

  final CapRefusal refusal;
}

/// A door was clicked where there is no wall (AC-65).
final class NoWallThere extends EditorNotice {
  const NoWallThere();
}

/// The wall is shorter than the narrowest opening, so no door or window fits
/// (EC-17: an opening of `openingWidthMinM` is accepted, below it refused).
final class WallTooShortForOpening extends EditorNotice {
  const WallTooShortForOpening();
}

/// A floor's size or origin change was refused: [count] elements of the level
/// would be outside the rectangle (AC-61, EC-20).
final class ElementsOutside extends EditorNotice {
  const ElementsOutside(this.count);

  final int count;
}

/// A floor's rectangle would leave the venue extent (AC-61).
final class OutsideVenue extends EditorNotice {
  const OutsideVenue();
}

/// A floor's values break a rule of the document (AC-61).
final class FloorRuleBroken extends EditorNotice {
  const FloorRuleBroken(this.problem);

  final FloorRuleProblem problem;
}

/// The save is in error or in conflict, so Publish is refused (AC-74).
final class FixSaveFirst extends EditorNotice {
  const FixSaveFirst();
}

/// A tool or a typed field cannot be used while the editor is read-only or the
/// save is in conflict (DC-E8).
final class EditingBlocked extends EditorNotice {
  const EditingBlocked();
}
