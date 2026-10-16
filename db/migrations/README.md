# db/migrations

The history of `db/schema.sql` (standard §8.2, CLAUDE.md rule 4). **0001 (OA-2) is the first**: `0001_venue_map_storage.sql` brings schema 0.14 to 0.15, additive only. **0002 (SEC-1) is the second**: `0002_permission_rows_and_userrole_index.sql` brings 0.15 to 0.16: it inserts the four roles (if absent), the permission route keys of the first fourteen admin routes and their default grants, and drops the redundant index `UX_UserRole`. **0003 (OA-3a) is the third, and the first that drops tables**: `0003_retire_geometry_rekey_keys.sql` brings 0.16 to 0.17: it stops on a database holding a `PUBLISHED` version (or a blocking object type with a default size of 0 or less), drops the twelve geometry tables and `Venue`'s spatial columns, re-keys the twelve element-id columns in place to element keys (`VARCHAR(40)`, the old id's text, a `CHECK` on the schema file's `ELEMENT_KEY`), puts `ConnectorType`'s costs in seconds, and adds `CK_ObjectType_BlockingSize`. Because 0.17's `schema.sql` no longer knows the twelve tables, `setup-db` reads its counts after the migrations. `db/schema.sql` always holds the whole current schema; `setup-db` runs it, then every migration (each a no-op on the catalog of a fresh database; 0002 still writes its rows there, which `schema.sql` does not hold).

A migration may drop (0002 drops an index; 0003 drops tables and columns), as long as it stays idempotent (`DROP ... IF EXISTS`) and `schema.sql` drops the same thing in the same commit. Rows a migration seeds are inserted with `ON CONFLICT ... DO NOTHING`, never updated: the runner re-applies every file every time, and a re-run must never overwrite what an admin has changed since.

## Conventions

1. **Name:** `NNNN_snake_case_name.sql`, a four-digit zero-padded number (`0001_add_x.sql`). Unpadded numbers sort wrong (`100_` before `19_`). The runner refuses any other name and any repeated number.
2. **Never edited once committed.** A change is a new file with the next number, and `db/schema.sql` is updated to match in the same commit. The `migrations-immutable` linter (plan S4) enforces this.
3. **Idempotent.** Every migration is safe to run again on a database that already has it (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO` blocks). There is no ledger table (plan DC-4): the runner applies every file, in order, every time.
4. **One transaction per file.** The runner sends the file as one query inside `BEGIN`/`COMMIT`, so a failure leaves the database as it was. Do not put `BEGIN`/`COMMIT` in the file, and avoid statements PostgreSQL cannot run in a transaction (`CREATE INDEX CONCURRENTLY`).
5. **A verification query.** End the file with a `-- verify:` line followed by commented lines holding **one** `SELECT`. The runner runs it after the migration and prints the rows, so the operator sees the effect:

   ```sql
   ALTER TABLE gabay.Venue ADD COLUMN IF NOT EXISTS Example VARCHAR(40) NULL;

   -- verify:
   -- SELECT column_name, data_type FROM information_schema.columns
   --  WHERE table_schema = 'gabay' AND table_name = 'venue' AND column_name = 'example';
   ```

   A migration without one is refused.

6. **Identifiers** are written PascalCase and never quoted, as in `schema.sql`.

## Running

```sh
npm run migrate        # apply all, in order; with none present it says so and exits 0
npm run setup-db       # dev mode: schema -> migrations -> test seed (see INSTALL.md)
```
