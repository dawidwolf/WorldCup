-- 012_save_prediction_rpc.sql
-- Security-definer RPC for creating, updating, or deleting a prediction without relying on client-side table privileges.

CREATE OR REPLACE FUNCTION public.save_prediction(
  p_user_id integer,
  p_match_id bigint,
  p_home_score integer DEFAULT NULL,
  p_away_score integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kickoff timestamptz;
  v_is_finished boolean;
  v_status text;
BEGIN
  SELECT m.kickoff_utc, m.is_finished, m.status
    INTO v_kickoff, v_is_finished, v_status
  FROM public.matches m
  WHERE m.match_id = p_match_id;

  IF v_kickoff IS NULL THEN
    RAISE EXCEPTION 'Match % not found.', p_match_id;
  END IF;

  IF COALESCE(v_is_finished, false) OR UPPER(COALESCE(v_status, '')) IN ('FT', 'LIVE', '1H', '2H', 'ET', 'PEN') OR now() >= v_kickoff THEN
    RAISE EXCEPTION 'Match has already started.';
  END IF;

  IF p_home_score IS NULL AND p_away_score IS NULL THEN
    DELETE FROM public.predictions
    WHERE user_id = p_user_id
      AND match_id = p_match_id;
    RETURN;
  END IF;

  INSERT INTO public.predictions (
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    updated_at
  )
  VALUES (
    p_user_id,
    p_match_id,
    COALESCE(p_home_score, 0),
    COALESCE(p_away_score, 0),
    now()
  )
  ON CONFLICT (user_id, match_id)
  DO UPDATE SET
    predicted_home_score = EXCLUDED.predicted_home_score,
    predicted_away_score = EXCLUDED.predicted_away_score,
    updated_at = EXCLUDED.updated_at,
    version = public.predictions.version + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.save_prediction(integer, bigint, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_prediction(integer, bigint, integer, integer) TO anon, authenticated;