-- 0001_venue_map_storage.sql: schema 0.14 -> 0.15 (OA-2; spec/OA-2.md r1 section 2 and AC-5;
-- plan/OA-2-map-storage.md 1.0 section 3.2). The venue map document's storage: VenueMap, VenueMapBackdrop,
-- VenueVersion.LayoutJson, Tenant.CatalogVersion with its trigger on ObjectType, and ObjectType's resize ranges,
-- Mount and IsRound. ADDITIVE ONLY: nothing is dropped (the old geometry tables go in OA-3's 0002).
--
-- Idempotent (db/migrations/README.md rule 3): on a 0.15 database (setup-db runs schema.sql first) it changes
-- nothing. The runner sends this file as one query inside its own transaction, so a failure leaves the database as
-- it was; this file holds no transaction statement of its own. Each added column is appended, in the order db/schema.sql writes it at
-- the end of its table, so a migrated 0.14 database matches a fresh 0.15 one column for column (plan DC-A13).
-- Identifiers are PascalCase and never quoted, as in schema.sql.

-- 1. The stop (AC-5, EC-32). A PUBLISHED row of 0.14 has no layout, and 0.15 requires one: such a database is
--    throwaway data under E-20, so it is rebuilt, never patched. Nothing has changed yet when this raises.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'gabay' AND table_name = 'venueversion' AND column_name = 'layoutjson'
    ) AND EXISTS (SELECT 1 FROM gabay.VenueVersion WHERE Status = 'PUBLISHED') THEN
        RAISE EXCEPTION 'Published versions exist without a layout; recreate this throwaway database with npm run setup-db (E-20)';
    END IF;
END $$;

-- 2. The added columns, in schema order. No inline CHECK: IF NOT EXISTS would skip it with the column, so the named
--    constraints are added in step 4. A constant DEFAULT rewrites no table.
ALTER TABLE gabay.Tenant
    ADD COLUMN IF NOT EXISTS CatalogVersion INT NOT NULL DEFAULT 1;

ALTER TABLE gabay.ObjectType
    ADD COLUMN IF NOT EXISTS ResizeMinWidthM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS ResizeMaxWidthM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS ResizeMinDepthM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS ResizeMaxDepthM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS ResizeMinHeightM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS ResizeMaxHeightM DECIMAL(9,3) NULL,
    ADD COLUMN IF NOT EXISTS Mount VARCHAR(10) NOT NULL DEFAULT 'floor',
    ADD COLUMN IF NOT EXISTS IsRound BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE gabay.VenueVersion
    ADD COLUMN IF NOT EXISTS LayoutJson JSONB NULL;

-- 3. The new tables' columns, in schema.sql's order. Their named constraints are added in step 4 like every other,
--    so a table left without them (schema.sql's preamble drops every foreign key in the schema) gets them back.
CREATE TABLE IF NOT EXISTS gabay.VenueMap (
    VenueMapId           INT GENERATED ALWAYS AS IDENTITY,
    TenantId             INT                NOT NULL,
    VenueId              INT                NOT NULL,
    DraftJson            JSONB              NULL,
    DraftVersion         INT                NOT NULL DEFAULT 0,
    PublishedVersion     INT                NULL,
    CreatedBy            INT                NULL,
    CreatedAt            TIMESTAMPTZ(3)     NOT NULL DEFAULT now(),
    UpdatedBy            INT                NULL,
    UpdatedAt            TIMESTAMPTZ(3)     NULL
);

CREATE TABLE IF NOT EXISTS gabay.VenueMapBackdrop (
    BackdropKey          CHAR(32)           NOT NULL,
    TenantId             INT                NOT NULL,
    VenueId              INT                NOT NULL,
    FileId               BIGINT             NOT NULL,
    WidthPx              INT                NOT NULL,
    HeightPx             INT                NOT NULL,
    CreatedBy            INT                NULL,
    CreatedAt            TIMESTAMPTZ(3)     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS IX_VenueMapBackdrop_Venue ON gabay.VenueMapBackdrop (TenantId, VenueId, CreatedAt);

-- 4. Every named constraint. PostgreSQL 18 has no ADD CONSTRAINT IF NOT EXISTS, so each is added only when its
--    table has no constraint of that name. Keys come before the foreign keys that need them.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('venuemap', 'pk_venuemap',
             'ALTER TABLE gabay.VenueMap ADD CONSTRAINT PK_VenueMap PRIMARY KEY (VenueMapId)'),
            ('venuemap', 'ck_venuemap_draftversion',
             'ALTER TABLE gabay.VenueMap ADD CONSTRAINT CK_VenueMap_DraftVersion CHECK (DraftVersion >= 0)'),
            ('venuemap', 'uq_venuemap',
             'ALTER TABLE gabay.VenueMap ADD CONSTRAINT UQ_VenueMap UNIQUE (TenantId, VenueId)'),
            ('venuemap', 'fk_venuemap_venue',
             'ALTER TABLE gabay.VenueMap ADD CONSTRAINT FK_VenueMap_Venue FOREIGN KEY (TenantId, VenueId) REFERENCES gabay.Venue (TenantId, VenueId)'),
            ('venuemap', 'fk_venuemap_published',
             'ALTER TABLE gabay.VenueMap ADD CONSTRAINT FK_VenueMap_Published FOREIGN KEY (TenantId, VenueId, PublishedVersion) REFERENCES gabay.VenueVersion (TenantId, VenueId, VersionNo)'),
            ('venuemapbackdrop', 'pk_venuemapbackdrop',
             'ALTER TABLE gabay.VenueMapBackdrop ADD CONSTRAINT PK_VenueMapBackdrop PRIMARY KEY (BackdropKey)'),
            ('venuemapbackdrop', 'ck_venuemapbackdrop_key',
             'ALTER TABLE gabay.VenueMapBackdrop ADD CONSTRAINT CK_VenueMapBackdrop_Key CHECK (BackdropKey ~ ''^[0-9a-f]{32}$'')'),
            ('venuemapbackdrop', 'fk_venuemapbackdrop_venue',
             'ALTER TABLE gabay.VenueMapBackdrop ADD CONSTRAINT FK_VenueMapBackdrop_Venue FOREIGN KEY (TenantId, VenueId) REFERENCES gabay.Venue (TenantId, VenueId)'),
            ('venuemapbackdrop', 'fk_venuemapbackdrop_file',
             'ALTER TABLE gabay.VenueMapBackdrop ADD CONSTRAINT FK_VenueMapBackdrop_File FOREIGN KEY (TenantId, FileId) REFERENCES gabay.StoredFile (TenantId, FileId)'),
            ('tenant', 'ck_tenant_catalogversion',
             'ALTER TABLE gabay.Tenant ADD CONSTRAINT CK_Tenant_CatalogVersion CHECK (CatalogVersion >= 1)'),
            ('objecttype', 'ck_objecttype_mount',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_Mount CHECK (Mount IN (''floor'', ''wall''))'),
            ('objecttype', 'ck_objecttype_resizew_pair',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeW_Pair CHECK ((ResizeMinWidthM IS NULL) = (ResizeMaxWidthM IS NULL))'),
            ('objecttype', 'ck_objecttype_resizew_order',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeW_Order CHECK (ResizeMinWidthM > 0 AND ResizeMinWidthM <= ResizeMaxWidthM)'),
            ('objecttype', 'ck_objecttype_resizew_default',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeW_Default CHECK (DefaultWidthM BETWEEN ResizeMinWidthM AND ResizeMaxWidthM)'),
            ('objecttype', 'ck_objecttype_resized_pair',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeD_Pair CHECK ((ResizeMinDepthM IS NULL) = (ResizeMaxDepthM IS NULL))'),
            ('objecttype', 'ck_objecttype_resized_order',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeD_Order CHECK (ResizeMinDepthM > 0 AND ResizeMinDepthM <= ResizeMaxDepthM)'),
            ('objecttype', 'ck_objecttype_resized_default',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeD_Default CHECK (DefaultDepthM BETWEEN ResizeMinDepthM AND ResizeMaxDepthM)'),
            ('objecttype', 'ck_objecttype_resizeh_pair',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeH_Pair CHECK ((ResizeMinHeightM IS NULL) = (ResizeMaxHeightM IS NULL))'),
            ('objecttype', 'ck_objecttype_resizeh_order',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeH_Order CHECK (ResizeMinHeightM > 0 AND ResizeMinHeightM <= ResizeMaxHeightM)'),
            ('objecttype', 'ck_objecttype_resizeh_default',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_ResizeH_Default CHECK (DefaultHeightM BETWEEN ResizeMinHeightM AND ResizeMaxHeightM)')
        ) AS wanted (table_name, constraint_name, ddl)
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM pg_constraint AS k
              JOIN pg_class AS t ON t.oid = k.conrelid
              JOIN pg_namespace AS n ON n.oid = t.relnamespace
             WHERE n.nspname = 'gabay' AND t.relname = c.table_name AND k.conname = c.constraint_name
        ) THEN
            EXECUTE c.ddl;
        END IF;
    END LOOP;

    -- CK_VenueVersion_Published gains LayoutJson IS NOT NULL: replaced only while its text does not name the column.
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint AS k
          JOIN pg_class AS t ON t.oid = k.conrelid
          JOIN pg_namespace AS n ON n.oid = t.relnamespace
         WHERE n.nspname = 'gabay' AND t.relname = 'venueversion' AND k.conname = 'ck_venueversion_published'
           AND pg_get_constraintdef(k.oid) LIKE '%layoutjson%'
    ) THEN
        ALTER TABLE gabay.VenueVersion DROP CONSTRAINT IF EXISTS CK_VenueVersion_Published;
        ALTER TABLE gabay.VenueVersion ADD CONSTRAINT CK_VenueVersion_Published CHECK (Status <> 'PUBLISHED' OR (PackageFileId IS NOT NULL AND PackageSha256 IS NOT NULL AND PublishedAt IS NOT NULL AND LayoutJson IS NOT NULL));
    END IF;
END $$;

-- 5. The catalog version's trigger (spec section 2.2, Q5 (a)): the same function body as schema.sql's, replaced
--    every run (a trigger fires on rows only, so replacing it touches no row).
CREATE OR REPLACE FUNCTION gabay.tr_objecttype_catalogversion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    counts_old_owner BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        counts_old_owner := TRUE;
    ELSIF TG_OP = 'UPDATE' THEN
        counts_old_owner := OLD.TenantId IS DISTINCT FROM NEW.TenantId;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        IF NEW.TenantId IS NULL THEN
            UPDATE gabay.Tenant SET CatalogVersion = CatalogVersion + 1;
        ELSE
            UPDATE gabay.Tenant SET CatalogVersion = CatalogVersion + 1 WHERE TenantId = NEW.TenantId;
        END IF;
    END IF;
    IF counts_old_owner THEN
        IF OLD.TenantId IS NULL THEN
            UPDATE gabay.Tenant SET CatalogVersion = CatalogVersion + 1;
        ELSE
            UPDATE gabay.Tenant SET CatalogVersion = CatalogVersion + 1 WHERE TenantId = OLD.TenantId;
        END IF;
    END IF;
    RETURN NULL;  -- an AFTER trigger's result is ignored
END $$;
CREATE OR REPLACE TRIGGER TR_ObjectType_CatalogVersion
    AFTER INSERT OR UPDATE OR DELETE ON gabay.ObjectType
    FOR EACH ROW EXECUTE FUNCTION gabay.tr_objecttype_catalogversion();

-- verify:
-- SELECT (SELECT COUNT(*) FROM information_schema.tables
--          WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE') AS tables,
--        EXISTS (SELECT 1 FROM information_schema.columns
--                 WHERE table_schema = 'gabay' AND table_name = 'venueversion' AND column_name = 'layoutjson') AS layout_json,
--        (SELECT COUNT(*) FROM pg_trigger AS g
--           JOIN pg_class AS c ON c.oid = g.tgrelid
--           JOIN pg_namespace AS s ON s.oid = c.relnamespace
--          WHERE s.nspname = 'gabay' AND NOT g.tgisinternal) AS triggers
