# shared/utils/

Pure helpers used by several features, with no widget and no state. Validators
live in `shared/utils/validators.dart`. `decimal_text.dart` (FF-1) reads and
compares a decimal written as text exactly, with no `double`: the decimal
validator and the `DecimalRange` checks use it.
