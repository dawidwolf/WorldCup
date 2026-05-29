-- 013_save_bonus_pick_rpc.sql
-- Security-definer RPC for saving tournament winner / top scorer picks.

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
  round_one_cutoff timestamptz;
BEGIN
  SELECT MIN(kickoff_utc), MAX(kickoff_utc)
    INTO tournament_start, round_one_cutoff
  FROM public.matches
  WHERE (lower(trim(coalesce(round, ''))) = 'group stage' OR group_turn = 1)
    AND group_turn = 1
    AND kickoff_utc IS NOT NULL;

  IF tournament_start IS NULL OR round_one_cutoff IS NULL THEN
    RAISE EXCEPTION 'Bonus picks are not available yet.';
  END IF;

  IF now() >= round_one_cutoff THEN
    RAISE EXCEPTION 'Winner and top scorer picks are closed after Group Stage Turn 1 cutoff.';
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