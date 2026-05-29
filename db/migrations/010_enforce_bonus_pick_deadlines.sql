-- 010_enforce_bonus_pick_deadlines.sql
-- Enforce winner/top-scorer deadline rules in the users table.
-- 1) Free edits before tournament kickoff.
-- 2) Late-window edits after kickoff but before Group Stage Turn 1 cutoff incur -1 per pick via the ledger.
-- 3) After the cutoff, winner/top-scorer edits are blocked.

CREATE OR REPLACE FUNCTION public.enforce_bonus_pick_deadlines()
RETURNS trigger
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
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.predicted_tournament_winner_id IS NULL AND NEW.predicted_top_scorer_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF now() >= round_one_cutoff THEN
      RAISE EXCEPTION 'Winner and top scorer picks are closed after Group Stage Turn 1 cutoff.';
    END IF;

    IF now() >= tournament_start THEN
      IF NEW.predicted_tournament_winner_id IS NOT NULL THEN
        NEW.late_winner_penalty := TRUE;
        INSERT INTO public.user_points_events (
          user_id,
          match_id,
          event_type,
          points_delta,
          reason
        )
        SELECT
          NEW.user_id,
          NULL,
          'late_bonus_penalty',
          -1,
          'winner_pick'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_points_events upe
          WHERE upe.user_id = NEW.user_id
            AND upe.event_type = 'late_bonus_penalty'
            AND upe.reason = 'winner_pick'
        );
      END IF;

      IF NEW.predicted_top_scorer_id IS NOT NULL THEN
        NEW.late_scorer_penalty := TRUE;
        INSERT INTO public.user_points_events (
          user_id,
          match_id,
          event_type,
          points_delta,
          reason
        )
        SELECT
          NEW.user_id,
          NULL,
          'late_bonus_penalty',
          -1,
          'top_scorer_pick'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_points_events upe
          WHERE upe.user_id = NEW.user_id
            AND upe.event_type = 'late_bonus_penalty'
            AND upe.reason = 'top_scorer_pick'
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.predicted_tournament_winner_id IS NOT DISTINCT FROM OLD.predicted_tournament_winner_id
     AND NEW.predicted_top_scorer_id IS NOT DISTINCT FROM OLD.predicted_top_scorer_id THEN
    RETURN NEW;
  END IF;

  IF now() >= round_one_cutoff THEN
    RAISE EXCEPTION 'Winner and top scorer picks are closed after Group Stage Turn 1 cutoff.';
  END IF;

  IF now() >= tournament_start THEN
    IF NEW.predicted_tournament_winner_id IS DISTINCT FROM OLD.predicted_tournament_winner_id THEN
      IF OLD.predicted_tournament_winner_id IS NOT NULL THEN
        RAISE EXCEPTION 'Winner pick is locked after tournament kickoff. Missing picks can still be added until Group Stage Turn 1 cutoff.';
      END IF;

      IF OLD.late_winner_penalty IS DISTINCT FROM TRUE AND NEW.predicted_tournament_winner_id IS NOT NULL THEN
        INSERT INTO public.user_points_events (
          user_id,
          match_id,
          event_type,
          points_delta,
          reason
        )
        SELECT
          NEW.user_id,
          NULL,
          'late_bonus_penalty',
          -1,
          'winner_pick'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_points_events upe
          WHERE upe.user_id = NEW.user_id
            AND upe.event_type = 'late_bonus_penalty'
            AND upe.reason = 'winner_pick'
        );
      END IF;
      NEW.late_winner_penalty := TRUE;
    END IF;

    IF NEW.predicted_top_scorer_id IS DISTINCT FROM OLD.predicted_top_scorer_id THEN
      IF OLD.predicted_top_scorer_id IS NOT NULL THEN
        RAISE EXCEPTION 'Top scorer pick is locked after tournament kickoff. Missing picks can still be added until Group Stage Turn 1 cutoff.';
      END IF;

      IF OLD.late_scorer_penalty IS DISTINCT FROM TRUE AND NEW.predicted_top_scorer_id IS NOT NULL THEN
        INSERT INTO public.user_points_events (
          user_id,
          match_id,
          event_type,
          points_delta,
          reason
        )
        SELECT
          NEW.user_id,
          NULL,
          'late_bonus_penalty',
          -1,
          'top_scorer_pick'
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_points_events upe
          WHERE upe.user_id = NEW.user_id
            AND upe.event_type = 'late_bonus_penalty'
            AND upe.reason = 'top_scorer_pick'
        );
      END IF;
      NEW.late_scorer_penalty := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_late_bonus_penalty ON public.users;
DROP TRIGGER IF EXISTS trg_enforce_bonus_pick_deadlines_insert ON public.users;
DROP TRIGGER IF EXISTS trg_enforce_bonus_pick_deadlines_update ON public.users;

CREATE TRIGGER trg_enforce_bonus_pick_deadlines_insert
BEFORE INSERT ON public.users
FOR EACH ROW
WHEN (
  NEW.predicted_tournament_winner_id IS NOT NULL
  OR NEW.predicted_top_scorer_id IS NOT NULL
)
EXECUTE FUNCTION public.enforce_bonus_pick_deadlines();

CREATE TRIGGER trg_enforce_bonus_pick_deadlines_update
BEFORE UPDATE ON public.users
FOR EACH ROW
WHEN (
  OLD.predicted_tournament_winner_id IS DISTINCT FROM NEW.predicted_tournament_winner_id
  OR OLD.predicted_top_scorer_id IS DISTINCT FROM NEW.predicted_top_scorer_id
)
EXECUTE FUNCTION public.enforce_bonus_pick_deadlines();

CREATE OR REPLACE FUNCTION public.record_tournament_bonus_hit(
  p_user_id integer,
  p_event_type text,
  p_points_delta integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_points_events (
    user_id,
    match_id,
    event_type,
    points_delta,
    reason
  )
  SELECT
    p_user_id,
    NULL,
    p_event_type,
    p_points_delta,
    p_reason
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_points_events upe
    WHERE upe.user_id = p_user_id
      AND upe.event_type = p_event_type
      AND COALESCE(upe.reason, '') = COALESCE(p_reason, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_tournament_winner_hit(p_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_tournament_bonus_hit(p_user_id, 'tournament_winner_hit', 5, 'winner_pick');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_tournament_top_scorer_hit(p_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_tournament_bonus_hit(p_user_id, 'tournament_top_scorer_hit', 3, 'top_scorer_pick');
END;
$$;
