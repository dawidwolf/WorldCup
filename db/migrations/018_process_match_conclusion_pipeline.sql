-- 018_process_match_conclusion_pipeline.sql
-- Production scoring pipeline for finalized matches.
-- This supersedes earlier scoring functions/triggers with a single ledger-first engine.

DROP TRIGGER IF EXISTS trg_on_match_finalized ON public.matches;
DROP TRIGGER IF EXISTS trg_match_finished ON public.matches;
DROP FUNCTION IF EXISTS public.trg_fn_on_match_finalized();
DROP FUNCTION IF EXISTS public.trg_fn_match_finished();
DROP FUNCTION IF EXISTS public.process_match_conclusion(bigint, text);
DROP FUNCTION IF EXISTS public.process_match_conclusion(bigint);
DROP FUNCTION IF EXISTS public.process_match_scoring(bigint);

CREATE OR REPLACE FUNCTION public.process_match_conclusion(
  p_match_id bigint,
  p_source text DEFAULT 'API-Sync'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_score integer;
  v_away_score integer;
  v_round text;
  v_match_group text;
  v_group_turn integer;
  v_is_group_stage boolean;
  v_home_team_id bigint;
  v_away_team_id bigint;
  v_prediction record;
  v_is_exact boolean;
  v_is_outcome boolean;
  v_points_delta integer;
BEGIN
  PERFORM pg_advisory_xact_lock(p_match_id);

  SELECT
    m.home_score,
    m.away_score,
    m.round,
    m."group",
    m.group_turn,
    m.home_team_id,
    m.away_team_id
  INTO
    v_home_score,
    v_away_score,
    v_round,
    v_match_group,
    v_group_turn,
    v_home_team_id,
    v_away_team_id
  FROM public.matches m
  WHERE m.match_id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found.', p_match_id;
  END IF;

  IF v_home_score IS NULL OR v_away_score IS NULL THEN
    RAISE EXCEPTION 'Match % does not have final scores yet.', p_match_id;
  END IF;

  v_is_group_stage := v_group_turn IS NOT NULL OR lower(trim(coalesce(v_round, ''))) = 'group stage';

  DELETE FROM public.user_points_events
  WHERE match_id = p_match_id;

  DELETE FROM public.match_results_history
  WHERE match_id = p_match_id;

  FOR v_prediction IN
    SELECT
      p.user_id,
      p.predicted_home_score,
      p.predicted_away_score
    FROM public.predictions p
    WHERE p.match_id = p_match_id
    ORDER BY p.user_id
  LOOP
    v_is_exact := (
      v_prediction.predicted_home_score = v_home_score
      AND v_prediction.predicted_away_score = v_away_score
    );

    v_is_outcome := NOT v_is_exact AND (
      (v_prediction.predicted_home_score > v_prediction.predicted_away_score AND v_home_score > v_away_score)
      OR (v_prediction.predicted_home_score < v_prediction.predicted_away_score AND v_home_score < v_away_score)
      OR (v_prediction.predicted_home_score = v_prediction.predicted_away_score AND v_home_score = v_away_score)
    );

    v_points_delta := CASE
      WHEN v_is_exact THEN 3
      WHEN v_is_outcome THEN 1
      ELSE 0
    END;

    INSERT INTO public.user_points_events (
      user_id,
      match_id,
      event_type,
      points_delta,
      reason
    )
    VALUES (
      v_prediction.user_id,
      p_match_id,
      CASE
        WHEN v_is_exact THEN 'exact_hit'
        WHEN v_is_outcome THEN 'outcome_hit'
        ELSE 'miss'
      END,
      v_points_delta,
      CASE
        WHEN v_is_exact THEN 'Exact score hit'
        WHEN v_is_outcome THEN 'Outcome hit'
        ELSE 'Miss'
      END
    );
  END LOOP;

  WITH affected_users AS (
    SELECT DISTINCT p.user_id
    FROM public.predictions p
    WHERE p.match_id = p_match_id
  )
  UPDATE public.users u
  SET
    points_total = COALESCE((
      SELECT SUM(upe.points_delta)
      FROM public.user_points_events upe
      WHERE upe.user_id = u.user_id
    ), 0),
    exact_hits = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = u.user_id
        AND upe.event_type = 'exact_hit'
    ), 0),
    hits_total = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = u.user_id
        AND upe.event_type = 'outcome_hit'
    ), 0),
    misses_total = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = u.user_id
        AND upe.event_type = 'miss'
    ), 0)
  FROM affected_users au
  WHERE u.user_id = au.user_id;

  IF v_is_group_stage THEN
    IF v_home_team_id IS NULL OR v_away_team_id IS NULL THEN
      RAISE EXCEPTION 'Group Stage match % is missing team ids.', p_match_id;
    END IF;

    DELETE FROM public.standings;

    INSERT INTO public.standings (
      team_id,
      "group",
      played,
      wins,
      draws,
      losses,
      points,
      goal_difference,
      updated_at
    )
    WITH team_rows AS (
      SELECT
        m.home_team_id AS team_id,
        m."group" AS "group",
        1 AS played,
        CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS losses,
        CASE
          WHEN m.home_score > m.away_score THEN 3
          WHEN m.home_score = m.away_score THEN 1
          ELSE 0
        END AS points,
        m.home_score - m.away_score AS goal_difference
      FROM public.matches m
      WHERE (
          lower(trim(coalesce(m.round, ''))) = 'group stage'
          OR m.group_turn IS NOT NULL
        )
        AND m.is_finished = true
        AND m.home_team_id IS NOT NULL
        AND m.away_team_id IS NOT NULL
      UNION ALL
      SELECT
        m.away_team_id AS team_id,
        m."group" AS "group",
        1 AS played,
        CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS losses,
        CASE
          WHEN m.away_score > m.home_score THEN 3
          WHEN m.home_score = m.away_score THEN 1
          ELSE 0
        END AS points,
        m.away_score - m.home_score AS goal_difference
      FROM public.matches m
      WHERE (
          lower(trim(coalesce(m.round, ''))) = 'group stage'
          OR m.group_turn IS NOT NULL
        )
        AND m.is_finished = true
        AND m.home_team_id IS NOT NULL
        AND m.away_team_id IS NOT NULL
    )
    SELECT
      team_id,
      MAX("group") AS "group",
      SUM(played) AS played,
      SUM(wins) AS wins,
      SUM(draws) AS draws,
      SUM(losses) AS losses,
      SUM(points) AS points,
      SUM(goal_difference) AS goal_difference,
      now() AS updated_at
    FROM team_rows
    GROUP BY team_id;
  END IF;

  INSERT INTO public.match_results_history (
    match_id,
    home_score,
    away_score,
    recorded_at,
    source,
    recorded_by
  )
  VALUES (
    p_match_id,
    v_home_score,
    v_away_score,
    now(),
    p_source,
    p_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_match_conclusion(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_match_conclusion(bigint, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_fn_on_match_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.process_match_conclusion(NEW.match_id, NEW.status);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_match_finalized
AFTER UPDATE ON public.matches
FOR EACH ROW
WHEN (OLD.is_finished = false AND NEW.is_finished = true)
EXECUTE FUNCTION public.trg_fn_on_match_finalized();

DO $$
DECLARE
  v_match record;
BEGIN
  FOR v_match IN
    SELECT match_id, status
    FROM public.matches
    WHERE is_finished = true
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
  LOOP
    PERFORM public.process_match_conclusion(v_match.match_id, COALESCE(v_match.status, 'Migration-018-Backfill'));
  END LOOP;
END;
$$;
