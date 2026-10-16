import '../../../shared/forms/field_spec.dart';
import '../../admin/users/models/user_field_specs.dart';

// The sign-in form's fields, one FieldSpec per field (rule 7). The email is the
// users form's own spec (AppUser.Email, checked against db/schema.sql by the
// `schema-forms` linter); the password has no column (Firebase holds it, E-08),
// so it is the one spec of the linter's `auth.<form>` mode (E-30).

/// The sign-in email: `AppUser.Email`, VARCHAR(254) NOT NULL, an email shape.
final FieldSpec signInEmail = appUserEmail;

/// The sign-in password: form-only (`auth.signIn`), required, hidden, never
/// trimmed, no length limit of the client's own (a long pasted password is sent
/// as typed and Firebase decides, EC-13). `FieldFormat.password` gives it the
/// hidden text, the autofill hint and no suggestions.
final FieldSpec signInPassword = FieldSpec(
  table: 'auth.signIn',
  name: 'password',
  label: (l10n) => l10n.fieldSignInPassword,
  kind: ColKind.text,
  required: true,
  format: FieldFormat.password,
);
