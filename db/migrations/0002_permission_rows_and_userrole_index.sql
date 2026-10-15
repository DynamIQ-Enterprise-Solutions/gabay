-- 0002_permission_rows_and_userrole_index.sql: schema 0.15 -> 0.16 (SEC-1; spec/SEC-1.md r2 sections 2.3, 2.4 and
-- AC-34 to AC-36; plan/SEC-1.md 1.0 step 1). The access rows the guards read, and one redundant index dropped:
--   (i)   the four Role rows of L41, if absent (DC-9: a deployed database has no seed, and a grant needs a role);
--   (ii)  the four PermissionRoute rows of the 14 routes built so far (T1);
--   (iii) the twelve default RolePermission rows of T2, all-false cells included (DC-8); SUPERADMIN has none and
--         bypasses in code (PH2 Q8, DC-7);
--   (iv)  UX_UserRole dropped (PH2 Q13, ruled L149): UQ_UserRole (UNIQUE NULLS NOT DISTINCT on the same columns, 0.14)
--         covers it wholly and is stricter.
--
-- Idempotent (db/migrations/README.md rule 3), and the runner re-applies every file every time, so every insert DOES
-- NOTHING on a conflict: a re-run never overwrites a role label or a grant an admin has since changed (AC-34), and it
-- restores a grant row deleted by hand (EC-48: R9's grid sets flags to false, never deletes a row). A role of the same
-- code with other flags (bad data) is kept as it is (AC-35 g). The labels are db/seeds/lib/lookups.js's, so the seed,
-- which finds each role by Code, inserts none. CreatedBy and UpdatedBy stay NULL (no request made these rows).
-- The runner sends this file as one query inside its own transaction; it holds no transaction statement of its own.
-- Identifiers are PascalCase and never quoted, as in schema.sql.

-- (i) The roles (L41). Next release's MERCHANT, UNIT and MAINTENANCE come with their own migration.
INSERT INTO gabay.Role (Code, Label, IsPlatformRole)
VALUES ('SUPERADMIN', 'Super admin', TRUE),
       ('MALL_ADMIN', 'Mall admin', FALSE),
       ('VENUE_EDITOR', 'Venue editor', FALSE),
       ('VIEWER', 'Viewer', FALSE)
ON CONFLICT (Code) DO NOTHING;

-- (ii) The route keys (T1; functions/src/auth/routeKeys.js names the same four, and a test ties the two).
INSERT INTO gabay.PermissionRoute (RouteKey, Label)
VALUES ('lookups', 'Lookups (read)'),
       ('venues', 'Venues'),
       ('venue-maps', 'Venue maps: draft, floor plans, clear, object catalog'),
       ('venue-versions', 'Published versions: publish and roll back')
ON CONFLICT (RouteKey) DO NOTHING;

-- (iii) The default grants (T2). C, R, U, D = CanCreate, CanRead, CanUpdate, CanDelete. Publishing and rolling back are
--       Create on venue-versions (Blueprint 2.4); clearing a draft is Delete on venue-maps; a VENUE_EDITOR may clear
--       (L186 Q1 (a)) and may not publish; venues Delete is false for all (no route deletes a venue, P0-01 B4).
INSERT INTO gabay.RolePermission (RoleId, PermissionRouteId, CanCreate, CanRead, CanUpdate, CanDelete)
SELECT r.RoleId, pr.PermissionRouteId, g.C, g.R, g.U, g.D
  FROM (VALUES
         ('MALL_ADMIN',   'lookups',        FALSE, TRUE,  FALSE, FALSE),
         ('MALL_ADMIN',   'venues',         TRUE,  TRUE,  TRUE,  FALSE),
         ('MALL_ADMIN',   'venue-maps',     TRUE,  TRUE,  TRUE,  TRUE),
         ('MALL_ADMIN',   'venue-versions', TRUE,  FALSE, FALSE, FALSE),
         ('VENUE_EDITOR', 'lookups',        FALSE, TRUE,  FALSE, FALSE),
         ('VENUE_EDITOR', 'venues',         FALSE, TRUE,  FALSE, FALSE),
         ('VENUE_EDITOR', 'venue-maps',     TRUE,  TRUE,  TRUE,  TRUE),
         ('VENUE_EDITOR', 'venue-versions', FALSE, FALSE, FALSE, FALSE),
         ('VIEWER',       'lookups',        FALSE, TRUE,  FALSE, FALSE),
         ('VIEWER',       'venues',         FALSE, TRUE,  FALSE, FALSE),
         ('VIEWER',       'venue-maps',     FALSE, TRUE,  FALSE, FALSE),
         ('VIEWER',       'venue-versions', FALSE, FALSE, FALSE, FALSE)
       ) AS g (RoleCode, RouteKey, C, R, U, D)
  JOIN gabay.Role AS r ON r.Code = g.RoleCode
  JOIN gabay.PermissionRoute AS pr ON pr.RouteKey = g.RouteKey
ON CONFLICT (RoleId, PermissionRouteId) DO NOTHING;

-- (iv) The redundant index (AC-36). IF EXISTS: a database without it (a fresh 0.16, or a second run) is left alone.
DROP INDEX IF EXISTS gabay.UX_UserRole;

-- verify:
-- SELECT (SELECT COUNT(*) FROM gabay.Role
--          WHERE Code IN ('SUPERADMIN', 'MALL_ADMIN', 'VENUE_EDITOR', 'VIEWER')) AS roles,
--        (SELECT COUNT(*) FROM gabay.PermissionRoute
--          WHERE RouteKey IN ('lookups', 'venues', 'venue-maps', 'venue-versions')) AS routes,
--        (SELECT COUNT(*) FROM gabay.RolePermission AS rp
--           JOIN gabay.PermissionRoute AS pr ON pr.PermissionRouteId = rp.PermissionRouteId
--          WHERE pr.RouteKey IN ('lookups', 'venues', 'venue-maps', 'venue-versions')) AS grants,
--        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'gabay' AND indexname = 'ux_userrole') AS ux_userrole_exists
