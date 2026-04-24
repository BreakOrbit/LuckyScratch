-- Clear all data from the LuckyScratch backend database.
--
-- Run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/backend/sql/clean_database.sql
--
-- This truncates every table in the public schema, resets identity sequences,
-- and keeps the schema itself.

BEGIN;

DO $$
DECLARE
  truncate_sql TEXT;
BEGIN
  SELECT 'TRUNCATE TABLE '
         || string_agg(format('%I.%I', schemaname, tablename), ', ')
         || ' RESTART IDENTITY CASCADE'
    INTO truncate_sql
    FROM pg_tables
   WHERE schemaname = 'public';

  IF truncate_sql IS NOT NULL THEN
    EXECUTE truncate_sql;
  END IF;
END $$;

COMMIT;
