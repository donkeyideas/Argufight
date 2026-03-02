-- Enable Row Level Security on all public schema tables.
-- Prisma connects as 'postgres' (BYPASSRLS) — unaffected.
-- PostgREST anon/authenticated roles get zero rows (implicit deny).
--
-- Rollback: DO $$ DECLARE r RECORD; BEGIN
--   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   LOOP EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
--   END LOOP; END $$;

DO $$
DECLARE
  r RECORD;
  tables_processed INT := 0;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    tables_processed := tables_processed + 1;
  END LOOP;
  RAISE NOTICE 'RLS enabled on % tables', tables_processed;
END $$;
