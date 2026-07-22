-- Run with psql. The password is prompted for and is never stored here.

\prompt 'Enter a new strong password for socialhub_backend: ' backend_password

SELECT 'CREATE ROLE socialhub_backend LOGIN NOINHERIT BYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'socialhub_backend')
\gexec

ALTER ROLE socialhub_backend WITH LOGIN NOINHERIT BYPASSRLS PASSWORD :'backend_password';

DO $grants$
DECLARE
  target_schema text := current_schema();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO socialhub_backend', current_database());
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO socialhub_backend', target_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO socialhub_backend', target_schema);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO socialhub_backend', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO socialhub_backend', target_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO socialhub_backend', target_schema);
END
$grants$;
