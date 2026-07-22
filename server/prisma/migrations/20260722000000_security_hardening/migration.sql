-- Deny Supabase Data API roles and add RLS as a deny-by-default boundary.
-- The Prisma migration role must have BYPASSRLS; Supabase postgres does.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

DO $security$
DECLARE
  target_schema text := current_schema();
  object_record record;
BEGIN
  EXECUTE format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM anon, authenticated, PUBLIC', target_schema);

  FOR object_record IN SELECT tablename FROM pg_tables WHERE schemaname = target_schema
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon, authenticated, PUBLIC', target_schema, object_record.tablename);
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target_schema, object_record.tablename);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = target_schema AND c.relname = object_record.tablename
        AND p.polname = 'deny_direct_data_api_access'
    ) THEN
      EXECUTE format('CREATE POLICY deny_direct_data_api_access ON %I.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)', target_schema, object_record.tablename);
    END IF;
  END LOOP;

  EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated, PUBLIC', target_schema);
  EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %I FROM anon, authenticated, PUBLIC', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC', target_schema);
END
$security$;
