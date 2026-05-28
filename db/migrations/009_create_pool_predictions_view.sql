-- 009_create_pool_predictions_view.sql
-- Security-filtered view for match predictions inside pools.
-- Scores stay hidden until kickoff so early queries cannot leak friends' picks.

DROP VIEW IF EXISTS public.pool_predictions_view;

CREATE OR REPLACE VIEW public.pool_predictions_view
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