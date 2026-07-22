-- Emergency rollback for 20260722000000_security_hardening.
-- WARNING: this restores the previous broad Supabase Data API access.

DO $rollback$
DECLARE
  target_schema text := current_schema();
  object_record record;
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated', target_schema);
  FOR object_record IN SELECT tablename FROM pg_tables WHERE schemaname = target_schema
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_direct_data_api_access ON %I.%I', target_schema, object_record.tablename);
    EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', target_schema, object_record.tablename);
  END LOOP;
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO anon, authenticated', target_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO anon, authenticated', target_schema);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO anon, authenticated, PUBLIC', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, PUBLIC', target_schema);
END
$rollback$;

ALTER TABLE "User" DROP COLUMN IF EXISTS "accountStatus";
