import '../../core/config/closed_sets.dart';
import '../../l10n/app_localizations.dart';
import 'select_option.dart';

/// The label of every value of the closed sets the map editor shows (P0-11 r3
/// AC-134), from ARB, keyed by the value as closed-sets.json says. The admin page
/// is English by design (L166). Each function is an exhaustive switch over the
/// generated enum with no default, so a value added to closed-sets.json without a
/// label fails to compile; `closed_set_labels_test` also walks `.values`.

/// The label of a [ImdfUnitCategory] value.
String imdfUnitCategoryLabel(
  ImdfUnitCategory value,
  AppLocalizations l10n,
) => switch (value) {
  ImdfUnitCategory.auditorium => l10n.unitCategoryAuditorium,
  ImdfUnitCategory.brick => l10n.unitCategoryBrick,
  ImdfUnitCategory.classroom => l10n.unitCategoryClassroom,
  ImdfUnitCategory.column => l10n.unitCategoryColumn,
  ImdfUnitCategory.concrete => l10n.unitCategoryConcrete,
  ImdfUnitCategory.conferenceroom => l10n.unitCategoryConferenceroom,
  ImdfUnitCategory.drywall => l10n.unitCategoryDrywall,
  ImdfUnitCategory.elevator => l10n.unitCategoryElevator,
  ImdfUnitCategory.escalator => l10n.unitCategoryEscalator,
  ImdfUnitCategory.fieldofplay => l10n.unitCategoryFieldofplay,
  ImdfUnitCategory.firstaid => l10n.unitCategoryFirstaid,
  ImdfUnitCategory.fitnessroom => l10n.unitCategoryFitnessroom,
  ImdfUnitCategory.foodservice => l10n.unitCategoryFoodservice,
  ImdfUnitCategory.footbridge => l10n.unitCategoryFootbridge,
  ImdfUnitCategory.glass => l10n.unitCategoryGlass,
  ImdfUnitCategory.huddleroom => l10n.unitCategoryHuddleroom,
  ImdfUnitCategory.kitchen => l10n.unitCategoryKitchen,
  ImdfUnitCategory.laboratory => l10n.unitCategoryLaboratory,
  ImdfUnitCategory.libraryValue => l10n.unitCategoryLibraryValue,
  ImdfUnitCategory.lobby => l10n.unitCategoryLobby,
  ImdfUnitCategory.lounge => l10n.unitCategoryLounge,
  ImdfUnitCategory.mailroom => l10n.unitCategoryMailroom,
  ImdfUnitCategory.mothersroom => l10n.unitCategoryMothersroom,
  ImdfUnitCategory.movietheater => l10n.unitCategoryMovietheater,
  ImdfUnitCategory.movingwalkway => l10n.unitCategoryMovingwalkway,
  ImdfUnitCategory.nonpublic => l10n.unitCategoryNonpublic,
  ImdfUnitCategory.office => l10n.unitCategoryOffice,
  ImdfUnitCategory.opentobelow => l10n.unitCategoryOpentobelow,
  ImdfUnitCategory.parking => l10n.unitCategoryParking,
  ImdfUnitCategory.phoneroom => l10n.unitCategoryPhoneroom,
  ImdfUnitCategory.platform => l10n.unitCategoryPlatform,
  ImdfUnitCategory.privatelounge => l10n.unitCategoryPrivatelounge,
  ImdfUnitCategory.ramp => l10n.unitCategoryRamp,
  ImdfUnitCategory.recreation => l10n.unitCategoryRecreation,
  ImdfUnitCategory.restroom => l10n.unitCategoryRestroom,
  ImdfUnitCategory.restroomFamily => l10n.unitCategoryRestroomFamily,
  ImdfUnitCategory.restroomFemale => l10n.unitCategoryRestroomFemale,
  ImdfUnitCategory.restroomFemaleWheelchair =>
    l10n.unitCategoryRestroomFemaleWheelchair,
  ImdfUnitCategory.restroomMale => l10n.unitCategoryRestroomMale,
  ImdfUnitCategory.restroomMaleWheelchair =>
    l10n.unitCategoryRestroomMaleWheelchair,
  ImdfUnitCategory.restroomTransgender => l10n.unitCategoryRestroomTransgender,
  ImdfUnitCategory.restroomTransgenderWheelchair =>
    l10n.unitCategoryRestroomTransgenderWheelchair,
  ImdfUnitCategory.restroomUnisex => l10n.unitCategoryRestroomUnisex,
  ImdfUnitCategory.restroomUnisexWheelchair =>
    l10n.unitCategoryRestroomUnisexWheelchair,
  ImdfUnitCategory.restroomWheelchair => l10n.unitCategoryRestroomWheelchair,
  ImdfUnitCategory.road => l10n.unitCategoryRoad,
  ImdfUnitCategory.room => l10n.unitCategoryRoom,
  ImdfUnitCategory.serverroom => l10n.unitCategoryServerroom,
  ImdfUnitCategory.shower => l10n.unitCategoryShower,
  ImdfUnitCategory.smokingarea => l10n.unitCategorySmokingarea,
  ImdfUnitCategory.stairs => l10n.unitCategoryStairs,
  ImdfUnitCategory.steps => l10n.unitCategorySteps,
  ImdfUnitCategory.storage => l10n.unitCategoryStorage,
  ImdfUnitCategory.structure => l10n.unitCategoryStructure,
  ImdfUnitCategory.terrace => l10n.unitCategoryTerrace,
  ImdfUnitCategory.theater => l10n.unitCategoryTheater,
  ImdfUnitCategory.unenclosedarea => l10n.unitCategoryUnenclosedarea,
  ImdfUnitCategory.unspecified => l10n.unitCategoryUnspecified,
  ImdfUnitCategory.vegetation => l10n.unitCategoryVegetation,
  ImdfUnitCategory.waitingroom => l10n.unitCategoryWaitingroom,
  ImdfUnitCategory.walkway => l10n.unitCategoryWalkway,
  ImdfUnitCategory.walkwayIsland => l10n.unitCategoryWalkwayIsland,
  ImdfUnitCategory.wood => l10n.unitCategoryWood,
};

/// The label of a [WallKind] value.
String wallKindLabel(WallKind value, AppLocalizations l10n) => switch (value) {
  WallKind.solid => l10n.wallKindSolid,
  WallKind.glass => l10n.wallKindGlass,
  WallKind.partition => l10n.wallKindPartition,
};

/// The label of a [OpeningKind] value.
String openingKindLabel(OpeningKind value, AppLocalizations l10n) =>
    switch (value) {
      OpeningKind.door => l10n.openingKindDoor,
      OpeningKind.window => l10n.openingKindWindow,
    };

/// The label of a [FloorFinish] value.
String floorFinishLabel(FloorFinish value, AppLocalizations l10n) =>
    switch (value) {
      FloorFinish.defaultValue => l10n.floorFinishDefaultValue,
      FloorFinish.concrete => l10n.floorFinishConcrete,
      FloorFinish.tile => l10n.floorFinishTile,
      FloorFinish.carpet => l10n.floorFinishCarpet,
      FloorFinish.wood => l10n.floorFinishWood,
      FloorFinish.vinyl => l10n.floorFinishVinyl,
    };

/// The closed sets a `FieldSpec.closedSet` may name, by the enum's own name.
const List<String> kEditorClosedSets = [
  'ImdfUnitCategory',
  'WallKind',
  'OpeningKind',
  'FloorFinish',
];

/// The options of the closed set named [set], each with its code as the value
/// and its label from ARB. Throws for a name that is not one of
/// [kEditorClosedSets], so a misspelt `closedSet:` fails at once.
List<SelectOption> closedSetOptions(String set, AppLocalizations l10n) =>
    switch (set) {
      'ImdfUnitCategory' => [
        for (final value in ImdfUnitCategory.values)
          SelectOption(
            value: value.code,
            label: imdfUnitCategoryLabel(value, l10n),
          ),
      ],
      'WallKind' => [
        for (final value in WallKind.values)
          SelectOption(value: value.code, label: wallKindLabel(value, l10n)),
      ],
      'OpeningKind' => [
        for (final value in OpeningKind.values)
          SelectOption(value: value.code, label: openingKindLabel(value, l10n)),
      ],
      'FloorFinish' => [
        for (final value in FloorFinish.values)
          SelectOption(value: value.code, label: floorFinishLabel(value, l10n)),
      ],
      _ => throw ArgumentError.value(
        set,
        'set',
        'is not a closed set the editor shows',
      ),
    };

/// The label of the value [code] of the closed set [set], or null when the set
/// or the code is not known (an inactive or foreign value is shown as its code).
String? closedSetLabel(String set, String code, AppLocalizations l10n) {
  if (!kEditorClosedSets.contains(set)) return null;
  for (final option in closedSetOptions(set, l10n)) {
    if (option.value == code) return option.label;
  }
  return null;
}
