-- 011_process_match_conclusion.sql
-- Idempotent scoring RPC used by lib/db-actions.ts.

DROP FUNCTION IF EXISTS public.process_match_conclusion(bigint);

CREATE OR REPLACE FUNCTION public.process_match_conclusion(p_match_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_score integer;
  v_away_score integer;
BEGIN
  SELECT m.home_score, m.away_score
    INTO v_home_score, v_away_score
  FROM public.matches m
  WHERE m.match_id = p_match_id
    AND m.is_finished = true;

  IF v_home_score IS NULL OR v_away_score IS NULL THEN
    RAISE EXCEPTION 'Match % is not finished or does not have final scores yet.', p_match_id;
  END IF;

  DELETE FROM public.user_points_events
  WHERE match_id = p_match_id;

  INSERT INTO public.user_points_events (
    user_id,
    match_id,
    event_type,
    points_delta,
    reason
  )
  SELECT
    p.user_id,
    p_match_id,
    CASE
      WHEN p.predicted_home_score = v_home_score
       AND p.predicted_away_score = v_away_score THEN 'exact_hit'
      WHEN (
        (p.predicted_home_score > p.predicted_away_score AND v_home_score > v_away_score)
        OR (p.predicted_home_score < p.predicted_away_score AND v_home_score < v_away_score)
        OR (p.predicted_home_score = p.predicted_away_score AND v_home_score = v_away_score)
      ) THEN 'outcome_hit'
      ELSE 'miss'
    END AS event_type,
    CASE
      WHEN p.predicted_home_score = v_home_score
       AND p.predicted_away_score = v_away_score THEN 3
      WHEN (
        (p.predicted_home_score > p.predicted_away_score AND v_home_score > v_away_score)
        OR (p.predicted_home_score < p.predicted_away_score AND v_home_score < v_away_score)
        OR (p.predicted_home_score = p.predicted_away_score AND v_home_score = v_away_score)
      ) THEN 1
      ELSE 0
    END AS points_delta,
    CASE
      WHEN p.predicted_home_score = v_home_score
       AND p.predicted_away_score = v_away_score THEN 'Exact score hit'
      WHEN (
        (p.predicted_home_score > p.predicted_away_score AND v_home_score > v_away_score)
        OR (p.predicted_home_score < p.predicted_away_score AND v_home_score < v_away_score)
        OR (p.predicted_home_score = p.predicted_away_score AND v_home_score = v_away_score)
      ) THEN 'Outcome hit'
      ELSE 'Miss'
    END AS reason
  FROM public.predictions p
  WHERE p.match_id = p_match_id;

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
    ), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_user_points_summary(p_user_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.users u
  SET
    points_total = COALESCE((
      SELECT SUM(upe.points_delta)
      FROM public.user_points_events upe
      WHERE upe.user_id = p_user_id
    ), 0),
    exact_hits = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = p_user_id
        AND upe.event_type = 'exact_hit'
    ), 0),
    hits_total = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = p_user_id
        AND upe.event_type = 'outcome_hit'
    ), 0),
    misses_total = COALESCE((
      SELECT COUNT(*)
      FROM public.user_points_events upe
      WHERE upe.user_id = p_user_id
        AND upe.event_type = 'miss'
    ), 0)
  WHERE u.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_points_summary_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_user_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_user_id := OLD.user_id;
  ELSE
    affected_user_id := NEW.user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.match_id IS NULL THEN
      PERFORM public.refresh_user_points_summary(affected_user_id);
    END IF;
  ELSIF NEW.match_id IS NULL THEN
    PERFORM public.refresh_user_points_summary(affected_user_id);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.refresh_user_points_summary(OLD.user_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_points_summary_from_ledger ON public.user_points_events;
CREATE TRIGGER trg_sync_user_points_summary_from_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.user_points_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_points_summary_from_ledger();
