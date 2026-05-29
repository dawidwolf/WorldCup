-- 019_disable_late_bonus_penalty_mode.sql
-- Feature toggle migration: keep existing late-penalty schema/functions in place,
-- but disable the late window behavior for now.
-- Effective behavior after this migration:
-- 1) Winner/top-scorer picks are editable only before tournament kickoff.
-- 2) At kickoff, both picks lock immediately.
-- 3) No -1 late penalty events are produced.

CREATE OR REPLACE FUNCTION public.enforce_bonus_pick_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tournament_start timestamptz;
BEGIN
  SELECT MIN(kickoff_utc)
    INTO tournament_start
  FROM public.matches
  WHERE kickoff_utc IS NOT NULL;

  IF tournament_start IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.predicted_tournament_winner_id IS NULL AND NEW.predicted_top_scorer_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF now() >= tournament_start THEN
      RAISE EXCEPTION 'Winner and top scorer picks are locked after tournament kickoff.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.predicted_tournament_winner_id IS NOT DISTINCT FROM OLD.predicted_tournament_winner_id
     AND NEW.predicted_top_scorer_id IS NOT DISTINCT FROM OLD.predicted_top_scorer_id THEN
    RETURN NEW;
  END IF;

  IF now() >= tournament_start THEN
    RAISE EXCEPTION 'Winner and top scorer picks are locked after tournament kickoff.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_bonus_pick(
  p_user_id integer,
  p_pick_type text,
  p_team_id bigint DEFAULT NULL,
  p_player_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tournament_start timestamptz;
BEGIN
  SELECT MIN(kickoff_utc)
    INTO tournament_start
  FROM public.matches
  WHERE kickoff_utc IS NOT NULL;

  IF tournament_start IS NULL THEN
    RAISE EXCEPTION 'Bonus picks are not available yet.';
  END IF;

  IF now() >= tournament_start THEN
    RAISE EXCEPTION 'Winner and top scorer picks are locked after tournament kickoff.';
  END IF;

  IF p_pick_type = 'winner' THEN
    IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = p_team_id) THEN
      RAISE EXCEPTION 'Invalid team id: %', p_team_id;
    END IF;

    UPDATE public.users
    SET predicted_tournament_winner_id = p_team_id
    WHERE user_id = p_user_id;
    RETURN;
  ELSIF p_pick_type = 'scorer' THEN
    IF p_player_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.player_stats ps WHERE ps.player_id = p_player_id) THEN
      RAISE EXCEPTION 'Invalid player id: %', p_player_id;
    END IF;

    UPDATE public.users
    SET predicted_top_scorer_id = p_player_id
    WHERE user_id = p_user_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Invalid bonus pick type: %', p_pick_type;
END;
$$;

REVOKE ALL ON FUNCTION public.save_bonus_pick(integer, text, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_bonus_pick(integer, text, bigint, integer) TO anon, authenticated;
