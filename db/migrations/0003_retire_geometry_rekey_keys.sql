-- 0003_retire_geometry_rekey_keys.sql: schema 0.16 -> 0.17 (OA-3a; spec/OA-3.md r2 AC-1 to AC-7; plan/OA-3a-migration-rekey.md
-- 1.1 sections 1.1 and 5). The FIRST migration that drops tables. The venue map document (0.15) is now the only geometry:
--   1. the stop: a 0.16 database holding a PUBLISHED venue version is refused, nothing changed (AC-5, DC-2);
--   2. the stop for object types: a blocking type with a default size of 0 or less is refused, nothing changed (the
--      owner's I2 (b), read by the ruling of 2026-10-16; plan 1.1 item 4);
--   3. the twelve geometry tables dropped, children first (H-1);
--   4. the twelve element-id columns re-keyed IN PLACE to element keys: VARCHAR(40) holding the old id's decimal text
--      (DC-2), renamed, their PostgreSQL 18 NOT NULL constraints renamed with them (H-2, AC-6);
--   5. ConnectorType's metre costs become SECONDS: CostBaseS and CostPerRiseS (renamed in step 4), every row set to its
--      CostModel's pair (AC-7; spec/P0-03.md r5 AC-101), NOT NULL, no default;
--   6. the named CHECKs: one on the schema file's ELEMENT_KEY pattern for each key column, CostBaseS >= 0 and
--      CostPerRiseS >= 0, and CK_ObjectType_BlockingSize;
--   7. IX_SSC_Unit and IX_ADU_Unit lead with the venue (AC-6);
--   8. Venue's BoundaryGeoJson, GeoreferenceJson and MapUpDeg dropped (CK_Venue_MapUpDeg goes with its column).
--
-- Idempotent (db/migrations/README.md rule 3): every step is guarded, so a second run, a fresh 0.17 database and the half
-- state (0.17's schema.sql run over a 0.16 database: its preamble drops every foreign key, and it does not know the twelve
-- tables) all converge on a fresh 0.17. It changes nothing that 0001 or 0002 created. No row moves between tenants or
-- venues (EC-12), and no PUBLISHED row is ever updated (EC-23). The runner sends this file as one query inside its own
-- transaction, so a failure leaves the database as it was; this file holds no transaction statement of its own.
-- Identifiers are PascalCase and never quoted, as in schema.sql.

-- 1. The stop (AC-5). Only where Occupant.UnitId still exists (the 0.16 marker), so a later database with published
--    versions is never refused. BUILDING and FAILED rows do not stop it (EC-21).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'gabay' AND table_name = 'occupant' AND column_name = 'unitid'
    ) AND EXISTS (SELECT 1 FROM gabay.VenueVersion WHERE Status = 'PUBLISHED') THEN
        RAISE EXCEPTION 'Published versions exist; recreate this throwaway database with npm run setup-db (E-20)';
    END IF;
END $$;

-- 2. The object-type stop (I2 (b)). Only while the constraint is absent. A row is never rewritten: a size is the
--    mall's, so a bad one is named and the database is rebuilt or fixed by hand (throwaway data, E-20).
DO $$
DECLARE
    codes TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint AS k
          JOIN pg_class AS t ON t.oid = k.conrelid
          JOIN pg_namespace AS n ON n.oid = t.relnamespace
         WHERE n.nspname = 'gabay' AND t.relname = 'objecttype' AND k.conname = 'ck_objecttype_blockingsize'
    ) THEN
        SELECT string_agg(DISTINCT Code, ', ' ORDER BY Code) INTO codes
          FROM gabay.ObjectType
         WHERE BlocksWalk AND (DefaultWidthM <= 0 OR (NOT IsRound AND DefaultDepthM <= 0));
        IF codes IS NOT NULL THEN
            RAISE EXCEPTION 'Object types that block walking have a default size of 0 or less (%); fix them or recreate this throwaway database with npm run setup-db (E-20)', codes;
        END IF;
    END IF;
END $$;

-- 3. The twelve geometry tables, children before parents. CASCADE also drops every foreign key that pointed at them
--    (the re-keyed columns' FK_*_Unit, FK_*_Level, FK_Closure_Conn).
DROP TABLE IF EXISTS gabay.NavCorrection    CASCADE;
DROP TABLE IF EXISTS gabay.NavConnectorStop CASCADE;
DROP TABLE IF EXISTS gabay.NavConnector     CASCADE;
DROP TABLE IF EXISTS gabay.Anchor           CASCADE;
DROP TABLE IF EXISTS gabay.TransitPoint     CASCADE;
DROP TABLE IF EXISTS gabay.Amenity          CASCADE;
DROP TABLE IF EXISTS gabay.FloorObject      CASCADE;
DROP TABLE IF EXISTS gabay.FloorUnderlay    CASCADE;
DROP TABLE IF EXISTS gabay.Opening          CASCADE;
DROP TABLE IF EXISTS gabay.Unit             CASCADE;
DROP TABLE IF EXISTS gabay.Level            CASCADE;
DROP TABLE IF EXISTS gabay.Building         CASCADE;

-- 4. The re-keys, in place: the type change keeps the column's position, and the primary key, the indexes and
--    CK_Closure_Target follow the rename. A column is changed only while its old name exists (it is then still an
--    integer). PostgreSQL 18 records each NOT NULL as a named constraint, <table>_<column>_not_null, and a rename keeps
--    the old name, so it is renamed too; ConnectorType's two cost columns (step 8) are in the same list for that.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('occupant',           'unitid',            'unitkey',            TRUE),
            ('storestatuschange',  'unitid',            'unitkey',            TRUE),
            ('beacon',             'levelid',           'levelkey',           TRUE),
            ('beaconplan',         'levelid',           'levelkey',           TRUE),
            ('sentinel',           'levelid',           'levelkey',           TRUE),
            ('closure',            'levelid',           'levelkey',           TRUE),
            ('closure',            'navconnectorid',    'connectorkey',       TRUE),
            ('analyticsevent',     'unitid',            'unitkey',            TRUE),
            ('analyticsdailyunit', 'unitid',            'unitkey',            TRUE),
            ('forecast',           'unitid',            'unitkey',            TRUE),
            ('analyticsdailycell', 'levelid',           'levelkey',           TRUE),
            ('analyticsdailycell', 'destinationunitid', 'destinationunitkey', TRUE),
            ('connectortype',      'costbasem',         'costbases',          FALSE),
            ('connectortype',      'costperrisem',      'costperrises',       FALSE)
        ) AS k (table_name, old_name, new_name, to_key)
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'gabay' AND table_name = c.table_name AND column_name = c.old_name
        ) THEN
            IF c.to_key THEN
                EXECUTE format('ALTER TABLE gabay.%I ALTER COLUMN %I TYPE VARCHAR(40) USING %I::text',
                               c.table_name, c.old_name, c.old_name);
            END IF;
            EXECUTE format('ALTER TABLE gabay.%I RENAME COLUMN %I TO %I', c.table_name, c.old_name, c.new_name);
        END IF;
        IF EXISTS (
            SELECT 1
              FROM pg_constraint AS k
              JOIN pg_class AS t ON t.oid = k.conrelid
              JOIN pg_namespace AS n ON n.oid = t.relnamespace
             WHERE n.nspname = 'gabay' AND t.relname = c.table_name
               AND k.conname = c.table_name || '_' || c.old_name || '_not_null'
        ) THEN
            EXECUTE format('ALTER TABLE gabay.%I RENAME CONSTRAINT %I TO %I', c.table_name,
                           c.table_name || '_' || c.old_name || '_not_null',
                           c.table_name || '_' || c.new_name || '_not_null');
        END IF;
    END LOOP;
END $$;

-- 5. ConnectorType in seconds. Step 4 renamed the columns; here every row, platform and tenant, takes its CostModel's
--    pair, while any row still holds a metre figure. A metre figure means nothing in seconds, so a mall's tuned row
--    takes the platform pair too (AC-7). The four pairs are spec/P0-03.md r5 AC-101's, copied here as history; a LEVEL
--    row has no pair and takes 0, 0 (plan DC-F). The marker that the values are still metres is the old column
--    default (DEFAULT 0), which 0.17 does not have; it is dropped in the same step, so a re-run changes no row. The
--    CHECKs (>= 0) are added in step 6, after the values are seconds.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'gabay' AND table_name = 'connectortype' AND column_name = 'costbases'
           AND column_default IS NOT NULL
    ) THEN
        UPDATE gabay.ConnectorType AS t
           SET CostBaseS = v.BaseS, CostPerRiseS = v.PerRiseS
          FROM (VALUES
                 ('ELEVATOR',  4.000, 0.400),
                 ('STAIRS',    1.500, 1.100),
                 ('ESCALATOR', 1.000, 0.800),
                 ('RAMP',      1.000, 1.000),
                 ('LEVEL',     0.000, 0.000)
               ) AS v (CostModel, BaseS, PerRiseS)
         WHERE t.CostModel = v.CostModel;
        ALTER TABLE gabay.ConnectorType
            ALTER COLUMN CostBaseS DROP DEFAULT,
            ALTER COLUMN CostPerRiseS DROP DEFAULT;
    END IF;
END $$;

-- 6. Every named CHECK (the keys, the costs, the blocking size), each added only when its table has no constraint of
--    that name (PostgreSQL 18 has no ADD CONSTRAINT IF NOT EXISTS; 0001's pattern). The key pattern is the schema file's ELEMENT_KEY (its ID pattern);
--    db/tools/test/schema017.test.js asserts that each CHECK's text holds exactly that pattern (AC-6, EC-35).
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('occupant', 'ck_occupant_unitkey',
             'ALTER TABLE gabay.Occupant ADD CONSTRAINT CK_Occupant_UnitKey CHECK (UnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('storestatuschange', 'ck_ssc_unitkey',
             'ALTER TABLE gabay.StoreStatusChange ADD CONSTRAINT CK_SSC_UnitKey CHECK (UnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('beacon', 'ck_beacon_levelkey',
             'ALTER TABLE gabay.Beacon ADD CONSTRAINT CK_Beacon_LevelKey CHECK (LevelKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('beaconplan', 'ck_beaconplan_levelkey',
             'ALTER TABLE gabay.BeaconPlan ADD CONSTRAINT CK_BeaconPlan_LevelKey CHECK (LevelKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('sentinel', 'ck_sentinel_levelkey',
             'ALTER TABLE gabay.Sentinel ADD CONSTRAINT CK_Sentinel_LevelKey CHECK (LevelKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('closure', 'ck_closure_levelkey',
             'ALTER TABLE gabay.Closure ADD CONSTRAINT CK_Closure_LevelKey CHECK (LevelKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('closure', 'ck_closure_connectorkey',
             'ALTER TABLE gabay.Closure ADD CONSTRAINT CK_Closure_ConnectorKey CHECK (ConnectorKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('analyticsevent', 'ck_analyticsevent_unitkey',
             'ALTER TABLE gabay.AnalyticsEvent ADD CONSTRAINT CK_AnalyticsEvent_UnitKey CHECK (UnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('analyticsdailyunit', 'ck_adu_unitkey',
             'ALTER TABLE gabay.AnalyticsDailyUnit ADD CONSTRAINT CK_ADU_UnitKey CHECK (UnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('forecast', 'ck_forecast_unitkey',
             'ALTER TABLE gabay.Forecast ADD CONSTRAINT CK_Forecast_UnitKey CHECK (UnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('analyticsdailycell', 'ck_adc_levelkey',
             'ALTER TABLE gabay.AnalyticsDailyCell ADD CONSTRAINT CK_ADC_LevelKey CHECK (LevelKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('analyticsdailycell', 'ck_adc_destinationunitkey',
             'ALTER TABLE gabay.AnalyticsDailyCell ADD CONSTRAINT CK_ADC_DestinationUnitKey CHECK (DestinationUnitKey ~ ''^[A-Za-z0-9_-]{1,40}$'')'),
            ('connectortype', 'ck_connectortype_costbases',
             'ALTER TABLE gabay.ConnectorType ADD CONSTRAINT CK_ConnectorType_CostBaseS CHECK (CostBaseS >= 0)'),
            ('connectortype', 'ck_connectortype_costperrises',
             'ALTER TABLE gabay.ConnectorType ADD CONSTRAINT CK_ConnectorType_CostPerRiseS CHECK (CostPerRiseS >= 0)'),
            ('objecttype', 'ck_objecttype_blockingsize',
             'ALTER TABLE gabay.ObjectType ADD CONSTRAINT CK_ObjectType_BlockingSize CHECK (NOT BlocksWalk OR ((DefaultWidthM IS NULL OR DefaultWidthM > 0) AND (IsRound OR DefaultDepthM IS NULL OR DefaultDepthM > 0)))')
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
END $$;

-- 7. The two indexes that named an element id lead with the venue now (keys are unique per venue only), each replaced
--    only while its definition lacks VenueId. The other re-keyed indexes already carried VenueId and follow the rename.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE schemaname = 'gabay' AND indexname = 'ix_ssc_unit' AND indexdef LIKE '%venueid%'
    ) THEN
        DROP INDEX IF EXISTS gabay.IX_SSC_Unit;
        CREATE INDEX IX_SSC_Unit ON gabay.StoreStatusChange (TenantId, VenueId, UnitKey, ChangedAt);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE schemaname = 'gabay' AND indexname = 'ix_adu_unit' AND indexdef LIKE '%venueid%'
    ) THEN
        DROP INDEX IF EXISTS gabay.IX_ADU_Unit;
        CREATE INDEX IX_ADU_Unit ON gabay.AnalyticsDailyUnit (TenantId, VenueId, UnitKey, Day);
    END IF;
END $$;

-- 8. Venue's spatial columns: the document's site holds them (L170 Q1).
ALTER TABLE gabay.Venue
    DROP COLUMN IF EXISTS BoundaryGeoJson,
    DROP COLUMN IF EXISTS GeoreferenceJson,
    DROP COLUMN IF EXISTS MapUpDeg;

-- verify:
-- SELECT (SELECT COUNT(*) FROM information_schema.tables
--          WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE') AS tables,
--        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'gabay') AS indexes,
--        (SELECT COUNT(*) FROM information_schema.columns
--          WHERE table_schema = 'gabay'
--            AND column_name IN ('unitkey', 'levelkey', 'connectorkey', 'destinationunitkey')) AS key_columns,
--        EXISTS (SELECT 1 FROM information_schema.columns
--                 WHERE table_schema = 'gabay' AND table_name = 'connectortype' AND column_name = 'costbases') AS seconds,
--        (SELECT COUNT(*) FROM information_schema.tables
--          WHERE table_schema = 'gabay'
--            AND table_name IN ('building', 'level', 'unit', 'opening', 'floorunderlay', 'floorobject', 'amenity',
--                               'transitpoint', 'anchor', 'navconnector', 'navconnectorstop', 'navcorrection')) AS retired_left
