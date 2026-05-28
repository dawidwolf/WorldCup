-- 008_add_late_bonus_penalty_trigger.sql
-- Adds a trigger to apply a -1 points penalty when users submit winner/top-scorer picks after tournament start
-- Idempotent: safe to run multiple times (function/trigger replaced)

-- Function: apply_late_bonus_penalty()
CREATE OR REPLACE FUNCTION public.apply_late_bonus_penalty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tournament_start timestamptz;
BEGIN
  -- Determine tournament start: earliest kickoff of the Group Stage
  SELECT MIN(kickoff_utc) INTO tournament_start FROM public.matches WHERE round = 'Group Stage' AND kickoff_utc IS NOT NULL;

  -- If we can't determine a start, do nothing
  IF tournament_start IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only consider updates that set a previously-null pick to a non-null value
  IF now() >= tournament_start THEN
    -- Winner pick: if previously NULL and now set, and penalty not yet applied
    IF (OLD.predicted_tournament_winner_id IS NULL) AND (NEW.predicted_tournament_winner_id IS NOT NULL) AND (OLD.late_winner_penalty IS DISTINCT TRUE) = FALSE THEN
      NEW.points_total := COALESCE(NEW.points_total, 0) - 1;
      NEW.late_winner_penalty := TRUE;
    END IF;

    -- Top scorer pick: similar logic
    IF (OLD.predicted_top_scorer_id IS NULL) AND (NEW.predicted_top_scorer_id IS NOT NULL) AND (OLD.late_scorer_penalty IS DISTINCT TRUE) = FALSE THEN
      NEW.points_total := COALESCE(NEW.points_total, 0) - 1;
      NEW.late_scorer_penalty := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: run before update on users to potentially apply penalties
DROP TRIGGER IF EXISTS trg_apply_late_bonus_penalty ON public.users;
CREATE TRIGGER trg_apply_late_bonus_penalty
BEFORE UPDATE ON public.users
FOR EACH ROW
WHEN (
  (OLD.predicted_tournament_winner_id IS NULL AND NEW.predicted_tournament_winner_id IS NOT NULL)
  OR (OLD.predicted_top_scorer_id IS NULL AND NEW.predicted_top_scorer_id IS NOT NULL)
)
EXECUTE FUNCTION public.apply_late_bonus_penalty();

-- Notes:
-- 1) This trigger subtracts 1 point per late pick at the moment of update, and sets the corresponding
--    late_winner_penalty / late_scorer_penalty flags to true to avoid double-charging.
-- 2) You may prefer to replace the tournament_start computation with a configuration table or
--    an environment-controlled timestamp if computing MIN(kickoff_utc) is expensive in your setup.
-- 3) To deploy on Supabase, run this SQL via the SQL editor or as a migration script.
