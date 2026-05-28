-- 014_safe_database_hardening.sql
-- Cleaned from the draft fix_migrations.sql.
-- Keeps only the parts that fit the current app:
-- - idempotent uniqueness guards
-- - base table/view grants that the app actually needs
-- - the existing pool_predictions_view privacy behavior
-- - a leaderboard helper function
--
-- Intentionally excluded:
-- - custom session-variable auth
-- - alternate RLS rewrites
-- - duplicate scoring engines
-- - winner/top-scorer logic that conflicts with current migrations

-- ------------------------------------------------------------
-- 1) Base privileges used by the app
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_pools TO anon, authenticated;
GRANT SELECT, INSERT ON public.pools TO anon, authenticated;
GRANT SELECT ON public.user_points_events TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT SELECT ON public.standings TO anon, authenticated;
GRANT SELECT ON public.player_stats TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Constraint guards
--    These are written as DO blocks because PostgreSQL does not
--    support ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.predictions'::regclass
      AND c.contype = 'u'
      AND c.conname = 'uq_prediction_user_match'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.predictions'::regclass
        AND c.contype = 'u'
        AND c.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.predictions'::regclass AND attname = 'user_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.predictions'::regclass AND attname = 'match_id')
        ]
    ) THEN
      ALTER TABLE public.predictions
        ADD CONSTRAINT uq_prediction_user_match UNIQUE (user_id, match_id);
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.user_pools'::regclass
      AND c.contype = 'u'
      AND c.conname = 'uq_user_pool_membership'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.user_pools'::regclass
        AND c.contype = 'u'
        AND c.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_pools'::regclass AND attname = 'user_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_pools'::regclass AND attname = 'pool_id')
        ]
    ) THEN
      ALTER TABLE public.user_pools
        ADD CONSTRAINT uq_user_pool_membership UNIQUE (user_id, pool_id);
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.predictions'::regclass
      AND c.contype = 'c'
      AND c.conname = 'chk_predicted_scores_non_negative'
  ) THEN
    ALTER TABLE public.predictions
      ADD CONSTRAINT chk_predicted_scores_non_negative
      CHECK (predicted_home_score >= 0 AND predicted_away_score >= 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_event_per_user
  ON public.user_points_events (user_id, event_type)
  WHERE match_id IS NULL;

-- ------------------------------------------------------------
-- 3) Match predictions view
--    This matches the current UI behavior: hide scores until kickoff.
-- ------------------------------------------------------------

DROP VIEW IF EXISTS public.pool_predictions_view;

CREATE VIEW public.pool_predictions_view
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  p.match_id,
  up.pool_id,
  p.user_id,
  u.username AS predictor_name,
  CASE
    WHEN m.kickoff_utc IS NOT NULL AND now() < m.kickoff_utc THEN NULL::text
    ELSE p.predicted_home_score::text
  END AS display_home_score,
  CASE
    WHEN m.kickoff_utc IS NOT NULL AND now() < m.kickoff_utc THEN NULL::text
    ELSE p.predicted_away_score::text
  END AS display_away_score,
  m.is_finished,
  CASE
    WHEN m.is_finished IS DISTINCT FROM TRUE THEN NULL
    WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL
    WHEN p.predicted_home_score = m.home_score AND p.predicted_away_score = m.away_score THEN 3
    WHEN (
      (p.predicted_home_score > p.predicted_away_score AND m.home_score > m.away_score)
      OR (p.predicted_home_score < p.predicted_away_score AND m.home_score < m.away_score)
      OR (p.predicted_home_score = p.predicted_away_score AND m.home_score = m.away_score)
    ) THEN 1
    ELSE 0
  END AS points_delta,
  u.points_total,
  u.exact_hits
FROM public.predictions p
JOIN public.users u
  ON u.user_id = p.user_id
JOIN public.user_pools up
  ON up.user_id = p.user_id
JOIN public.matches m
  ON m.match_id = p.match_id;

GRANT SELECT ON public.pool_predictions_view TO anon, authenticated;

-- ------------------------------------------------------------
-- 4) Leaderboard helper
--    Useful for SQL clients and admin checks; does not replace the app query.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_pool_leaderboard(p_pool_id integer)
RETURNS TABLE (
  rank bigint,
  user_id integer,
  username text,
  points_total integer,
  exact_hits integer,
  hits_total integer,
  misses_total integer,
  predicted_tournament_winner_id bigint,
  predicted_top_scorer_id integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    RANK() OVER (
      ORDER BY u.points_total DESC,
               u.exact_hits DESC,
               u.username ASC
    ) AS rank,
    u.user_id,
    u.username,
    u.points_total,
    u.exact_hits,
    u.hits_total,
    u.misses_total,
    u.predicted_tournament_winner_id,
    u.predicted_top_scorer_id
  FROM public.users u
  JOIN public.user_pools up
    ON up.user_id = u.user_id
  WHERE up.pool_id = p_pool_id;
$$;
