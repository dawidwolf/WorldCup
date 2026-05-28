-- db/migrations/005_users_rls.sql
-- Enable Row Level Security (RLS), define policies, and fix schema inconsistencies

-- 0) Fix Schema Inconsistencies
-- Add invite_code to pools if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pools' AND column_name='invite_code') THEN
    ALTER TABLE public.pools ADD COLUMN invite_code text UNIQUE;
  END IF;

  -- Add is_admin to user_pools if it doesn't exist (code uses is_admin whereas migration 001 used role)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_pools' AND column_name='is_admin') THEN
    ALTER TABLE public.user_pools ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END
$$;

-- 1) USERS Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous signup" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous select" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous update" ON public.users;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
CREATE POLICY "Allow anonymous signup" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous select" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous update" ON public.users FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow authenticated signup" ON public.users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update" ON public.users FOR UPDATE TO authenticated USING (true);

-- 2) POOLS Table RLS
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous pools insert" ON public.pools;
DROP POLICY IF EXISTS "Allow anonymous pools select" ON public.pools;
CREATE POLICY "Allow anonymous pools insert" ON public.pools FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous pools select" ON public.pools FOR SELECT TO anon USING (true);

-- 3) USER_POOLS Table RLS
ALTER TABLE public.user_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous user_pools insert" ON public.user_pools;
DROP POLICY IF EXISTS "Allow anonymous user_pools select" ON public.user_pools;
DROP POLICY IF EXISTS "Allow anonymous user_pools delete" ON public.user_pools;
CREATE POLICY "Allow anonymous user_pools insert" ON public.user_pools FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous user_pools select" ON public.user_pools FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous user_pools delete" ON public.user_pools FOR DELETE TO anon USING (true);

-- 4) PREDICTIONS Table RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous predictions insert" ON public.predictions;
DROP POLICY IF EXISTS "Allow anonymous predictions select" ON public.predictions;
DROP POLICY IF EXISTS "Allow anonymous predictions update" ON public.predictions;
DROP POLICY IF EXISTS "Allow anonymous predictions delete" ON public.predictions;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
CREATE POLICY "Allow anonymous predictions insert" ON public.predictions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous predictions select" ON public.predictions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous predictions update" ON public.predictions FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous predictions delete" ON public.predictions FOR DELETE TO anon USING (true);
CREATE POLICY "Allow authenticated predictions insert" ON public.predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated predictions select" ON public.predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated predictions update" ON public.predictions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated predictions delete" ON public.predictions FOR DELETE TO authenticated USING (true);

-- 5) PLAYER_STATS Table RLS (Read-only)
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous player_stats select" ON public.player_stats;
CREATE POLICY "Allow anonymous player_stats select" ON public.player_stats FOR SELECT TO anon USING (true);

-- 6) STANDINGS Table RLS (Read-only)
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous standings select" ON public.standings;
CREATE POLICY "Allow anonymous standings select" ON public.standings FOR SELECT TO anon USING (true);

-- 7) Optional Tables: MATCHES and TEAMS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'matches') THEN
    ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anonymous matches select" ON public.matches;
    GRANT SELECT ON public.matches TO anon, authenticated;
    CREATE POLICY "Allow anonymous matches select" ON public.matches FOR SELECT TO anon USING (true);
    CREATE POLICY "Allow authenticated matches select" ON public.matches FOR SELECT TO authenticated USING (true);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anonymous teams select" ON public.teams;
    CREATE POLICY "Allow anonymous teams select" ON public.teams FOR SELECT TO anon USING (true);
  END IF;
END
$$;


