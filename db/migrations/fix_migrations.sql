-- ============================================================
-- WORLD CUP PREDICTOR — DATABASE FIX MIGRATIONS
-- Run these blocks in order, top to bottom, in Supabase SQL Editor.
-- Each block is safe to re-run (uses IF NOT EXISTS / DO guards).
-- ============================================================


-- ============================================================
-- BLOCK 1: CRITICAL — Missing UNIQUE constraints
-- Without these, double-taps and race conditions corrupt data.
-- ============================================================

-- 1a. Prevent a user from having two prediction rows for the same match.
--     Your upsert logic depends on this existing at DB level.
ALTER TABLE public.predictions
  ADD CONSTRAINT IF NOT EXISTS uq_prediction_user_match
  UNIQUE (user_id, match_id);

-- 1b. Prevent a user from joining the same pool twice.
--     Invite-link double-clicks and re-joins create duplicate leaderboard rows.
ALTER TABLE public.user_pools
  ADD CONSTRAINT IF NOT EXISTS uq_user_pool_membership
  UNIQUE (user_id, pool_id);


-- ============================================================
-- BLOCK 2: CRITICAL — Deadline enforcement trigger
-- Blocks any INSERT or UPDATE on predictions after match kickoff.
-- This is the server-side guard your plan describes in section 6.2.
-- Safe to run even if it already exists — it will replace it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_prediction_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_kickoff timestamptz;
BEGIN
  SELECT kickoff_utc INTO v_kickoff
  FROM public.matches
  WHERE match_id = NEW.match_id;

  IF v_kickoff IS NULL THEN
    RAISE EXCEPTION 'Match % not found or has no kickoff time.', NEW.match_id;
  END IF;

  IF now() >= v_kickoff THEN
    RAISE EXCEPTION
      'Prediction deadline has passed. Kickoff was at %.',
      v_kickoff
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate so this is always fresh.
DROP TRIGGER IF EXISTS trg_enforce_deadline ON public.predictions;

CREATE TRIGGER trg_enforce_deadline
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_prediction_deadline();


-- ============================================================
-- BLOCK 3: CRITICAL — Scoring engine trigger
-- Fires when a match flips to is_finished = true.
-- Awards points to every user who predicted that match.
-- Idempotent: re-running for the same match is safe.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_match_scoring(p_match_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_score  integer;
  v_away_score  integer;
  v_rec         record;
  v_points      integer;
  v_is_exact    boolean;
  v_is_outcome  boolean;
BEGIN
  -- 1. Load final score
  SELECT home_score, away_score
  INTO v_home_score, v_away_score
  FROM public.matches
  WHERE match_id = p_match_id;

  IF v_home_score IS NULL OR v_away_score IS NULL THEN
    RAISE EXCEPTION 'Match % has no final score yet.', p_match_id;
  END IF;

  -- 2. Loop over every prediction for this match
  FOR v_rec IN
    SELECT user_id, predicted_home_score, predicted_away_score
    FROM public.predictions
    WHERE match_id = p_match_id
  LOOP
    -- Determine points
    v_is_exact   := (v_rec.predicted_home_score = v_home_score
                    AND v_rec.predicted_away_score = v_away_score);
    v_is_outcome := NOT v_is_exact AND (
                      SIGN(v_rec.predicted_home_score - v_rec.predicted_away_score)
                      = SIGN(v_home_score - v_away_score)
                    );

    v_points := CASE
      WHEN v_is_exact   THEN 3
      WHEN v_is_outcome THEN 1
      ELSE 0
    END;

    -- 3. Write to ledger (ON CONFLICT = idempotent: same match scored twice is ignored)
    INSERT INTO public.user_points_events
      (user_id, match_id, event_type, points_delta, reason)
    VALUES (
      v_rec.user_id,
      p_match_id,
      'match_result',
      v_points,
      CASE
        WHEN v_is_exact   THEN 'Exact score'
        WHEN v_is_outcome THEN 'Correct outcome'
        ELSE 'No points'
      END
    )
    ON CONFLICT (user_id, match_id, event_type) DO NOTHING;

    -- 4. Update users aggregate only if a new ledger row was inserted
    IF FOUND AND v_points > 0 THEN
      UPDATE public.users
      SET
        points_total = points_total + v_points,
        exact_hits   = exact_hits  + (CASE WHEN v_is_exact THEN 1 ELSE 0 END),
        hits_total   = hits_total  + (CASE WHEN v_is_exact OR v_is_outcome THEN 1 ELSE 0 END),
        misses_total = misses_total + (CASE WHEN NOT v_is_exact AND NOT v_is_outcome THEN 1 ELSE 0 END)
      WHERE user_id = v_rec.user_id;
    ELSIF FOUND AND v_points = 0 THEN
      -- Still count the miss even for zero points
      UPDATE public.users
      SET misses_total = misses_total + 1
      WHERE user_id = v_rec.user_id;
    END IF;

  END LOOP;
END;
$$;

-- The trigger that calls the scoring engine when a match finishes
CREATE OR REPLACE FUNCTION public.trg_fn_match_finished()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fire when is_finished flips from false/null → true
  IF (OLD.is_finished IS DISTINCT FROM TRUE) AND (NEW.is_finished = TRUE) THEN
    PERFORM public.process_match_scoring(NEW.match_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_finished ON public.matches;

CREATE TRIGGER trg_match_finished
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_match_finished();


-- ============================================================
-- BLOCK 4: CRITICAL — Idempotency key on the points ledger
-- Prevents double-scoring if the API writes is_finished=true twice.
-- The scoring function above uses ON CONFLICT on this constraint.
-- ============================================================

ALTER TABLE public.user_points_events
  ADD CONSTRAINT IF NOT EXISTS uq_points_event_per_match
  UNIQUE (user_id, match_id, event_type);


-- ============================================================
-- BLOCK 5: CRITICAL — pool_predictions_view
-- Used by the match predictions modal (section 8.11 of plan).
-- Shows all predictions for a match, filtered by pool membership.
-- Hides predicted scores until the match is finished.
-- ============================================================

CREATE OR REPLACE VIEW public.pool_predictions_view AS
SELECT
  p.match_id,
  up.pool_id,
  p.user_id,
  u.username                                          AS predictor_name,

  -- Hide scores until the match is finished (privacy guard)
  CASE WHEN m.is_finished THEN p.predicted_home_score::text
       ELSE NULL END                                  AS display_home_score,
  CASE WHEN m.is_finished THEN p.predicted_away_score::text
       ELSE NULL END                                  AS display_away_score,

  m.is_finished,

  -- Points earned for this prediction (null if match not finished)
  CASE WHEN m.is_finished THEN
    COALESCE((
      SELECT upe.points_delta
      FROM public.user_points_events upe
      WHERE upe.user_id  = p.user_id
        AND upe.match_id = p.match_id
        AND upe.event_type = 'match_result'
      LIMIT 1
    ), 0)
  ELSE NULL END                                       AS points_delta,

  u.points_total,
  u.exact_hits
FROM public.predictions p
JOIN public.users       u  ON u.user_id  = p.user_id
JOIN public.user_pools  up ON up.user_id = p.user_id
JOIN public.matches     m  ON m.match_id = p.match_id;


-- ============================================================
-- BLOCK 6: HIGH — Guard against negative predicted scores
-- Matches already have CHECK (home_score >= 0). Predictions didn't.
-- ============================================================

ALTER TABLE public.predictions
  ADD CONSTRAINT IF NOT EXISTS chk_predicted_scores_non_negative
  CHECK (predicted_home_score >= 0 AND predicted_away_score >= 0);


-- ============================================================
-- BLOCK 7: HIGH — RLS policies for anon role
-- Your app uses custom PIN auth, not Supabase Auth.
-- auth.uid() is always NULL for your users, so policies must
-- use a Postgres session variable you set at login time instead.
--
-- HOW THIS WORKS:
--   In your Next.js login function, after verifying the PIN, call:
--     await supabase.rpc('set_current_user_id', { uid: user.user_id })
--   This sets app.current_user_id for the session.
--   All policies below use current_setting('app.current_user_id') to
--   identify the logged-in user.
-- ============================================================

-- Helper function: returns the current user's ID from session variable.
-- Returns -1 (never a real user_id) if not set, so policies fail safely.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_id', true)::integer,
    -1
  );
$$;

-- Enable RLS on all user-facing tables (safe to run if already enabled)
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pools         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_events ENABLE ROW LEVEL SECURITY;

-- ---- users table ----
DROP POLICY IF EXISTS "users: anyone can register" ON public.users;
CREATE POLICY "users: anyone can register"
  ON public.users FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "users: read own row" ON public.users;
CREATE POLICY "users: read own row"
  ON public.users FOR SELECT TO anon
  USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS "users: update own row" ON public.users;
CREATE POLICY "users: update own row"
  ON public.users FOR UPDATE TO anon
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

-- Leaderboard needs to read all users in a pool — allow SELECT on
-- non-sensitive columns via the view rather than exposing the full table.
-- For the Rankings tab to work, grant SELECT on username/points/etc.
-- but NOT on pin. The safest approach is a leaderboard view:
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  u.user_id,
  u.username,
  u.points_total,
  u.exact_hits,
  u.hits_total,
  u.misses_total,
  u.predicted_tournament_winner_id,
  u.predicted_top_scorer_id
FROM public.users u;

-- ---- predictions table ----
DROP POLICY IF EXISTS "predictions: manage own" ON public.predictions;
CREATE POLICY "predictions: manage own"
  ON public.predictions FOR ALL TO anon
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

-- ---- user_pools table ----
DROP POLICY IF EXISTS "user_pools: read membership" ON public.user_pools;
CREATE POLICY "user_pools: read membership"
  ON public.user_pools FOR SELECT TO anon
  USING (true);  -- everyone can see who is in which pool (needed for leaderboard)

DROP POLICY IF EXISTS "user_pools: join pool" ON public.user_pools;
CREATE POLICY "user_pools: join pool"
  ON public.user_pools FOR INSERT TO anon
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS "user_pools: leave pool" ON public.user_pools;
CREATE POLICY "user_pools: leave pool"
  ON public.user_pools FOR DELETE TO anon
  USING (user_id = public.current_user_id());

-- ---- pools table ----
DROP POLICY IF EXISTS "pools: anyone can read" ON public.pools;
CREATE POLICY "pools: anyone can read"
  ON public.pools FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "pools: anyone can create" ON public.pools;
CREATE POLICY "pools: anyone can create"
  ON public.pools FOR INSERT TO anon
  WITH CHECK (true);

-- ---- user_points_events table ----
DROP POLICY IF EXISTS "points events: read own" ON public.user_points_events;
CREATE POLICY "points events: read own"
  ON public.user_points_events FOR SELECT TO anon
  USING (user_id = public.current_user_id());

-- Read-only tables: matches, teams, standings, player_stats
ALTER TABLE public.matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches: public read" ON public.matches;
CREATE POLICY "matches: public read"
  ON public.matches FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "teams: public read" ON public.teams;
CREATE POLICY "teams: public read"
  ON public.teams FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "standings: public read" ON public.standings;
CREATE POLICY "standings: public read"
  ON public.standings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "player_stats: public read" ON public.player_stats;
CREATE POLICY "player_stats: public read"
  ON public.player_stats FOR SELECT TO anon USING (true);


-- ============================================================
-- BLOCK 8: ARCHITECTURE — Tournament Winner & Top Scorer scoring
-- Called manually (or via an edge function) after the tournament ends.
-- Awards +10 pts for correct winner pick and +10 for correct top scorer.
-- Idempotent: safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_tournament_bonus_scoring(
  p_winner_team_id   bigint,
  p_top_scorer_id    integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec record;
BEGIN
  -- Winner pick: +10 pts
  FOR v_rec IN
    SELECT user_id
    FROM public.users
    WHERE predicted_tournament_winner_id = p_winner_team_id
  LOOP
    INSERT INTO public.user_points_events
      (user_id, match_id, event_type, points_delta, reason)
    VALUES (v_rec.user_id, NULL, 'tournament_winner', 10, 'Correct tournament winner pick')
    ON CONFLICT (user_id, event_type) WHERE match_id IS NULL DO NOTHING;

    IF FOUND THEN
      UPDATE public.users
      SET points_total = points_total + 10
      WHERE user_id = v_rec.user_id;
    END IF;
  END LOOP;

  -- Top scorer pick: +10 pts
  FOR v_rec IN
    SELECT user_id
    FROM public.users
    WHERE predicted_top_scorer_id = p_top_scorer_id
  LOOP
    INSERT INTO public.user_points_events
      (user_id, match_id, event_type, points_delta, reason)
    VALUES (v_rec.user_id, NULL, 'top_scorer', 10, 'Correct top scorer pick')
    ON CONFLICT (user_id, event_type) WHERE match_id IS NULL DO NOTHING;

    IF FOUND THEN
      UPDATE public.users
      SET points_total = points_total + 10
      WHERE user_id = v_rec.user_id;
    END IF;
  END LOOP;
END;
$$;

-- NOTE on the idempotency constraint for bonus events:
-- The uq_points_event_per_match constraint has match_id in it.
-- Bonus events have match_id = NULL, so uniqueness is on (user_id, NULL, event_type).
-- NULL != NULL in SQL, so ON CONFLICT won't fire. Fix:
-- Use a partial unique index instead for NULL match_id events:
CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_event_per_user
  ON public.user_points_events (user_id, event_type)
  WHERE match_id IS NULL;


-- ============================================================
-- BLOCK 9: ARCHITECTURE — Late penalty scoring helper
-- Call this when a user saves a late winner/scorer pick.
-- Deducts -1 point and flips the penalty flag atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_late_pick_penalty(
  p_user_id   integer,
  p_pick_type text  -- 'winner' or 'scorer'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_flag_col   text;
  v_event_type text;
BEGIN
  IF p_pick_type = 'winner' THEN
    v_flag_col   := 'late_winner_penalty';
    v_event_type := 'late_winner_penalty';
  ELSIF p_pick_type = 'scorer' THEN
    v_flag_col   := 'late_scorer_penalty';
    v_event_type := 'late_scorer_penalty';
  ELSE
    RAISE EXCEPTION 'Invalid pick_type: %. Must be winner or scorer.', p_pick_type;
  END IF;

  -- Only apply if not already penalised
  INSERT INTO public.user_points_events
    (user_id, match_id, event_type, points_delta, reason)
  VALUES (p_user_id, NULL, v_event_type, -1, 'Late ' || p_pick_type || ' pick penalty')
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    -- Deduct point and flip flag in one statement
    EXECUTE format(
      'UPDATE public.users SET points_total = points_total - 1, %I = TRUE WHERE user_id = $1',
      v_flag_col
    ) USING p_user_id;
  END IF;
END;
$$;


-- ============================================================
-- BLOCK 10: QUALITY OF LIFE — Leaderboard helper function
-- Returns the ranked leaderboard for a given pool.
-- Handles ties correctly: equal pts+exact_hits = same rank,
-- next person skips a number (RANK not DENSE_RANK).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pool_leaderboard(p_pool_id integer)
RETURNS TABLE (
  rank          bigint,
  user_id       integer,
  username      text,
  points_total  integer,
  exact_hits    integer,
  hits_total    integer,
  misses_total  integer,
  predicted_tournament_winner_id bigint,
  predicted_top_scorer_id        integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    RANK() OVER (
      ORDER BY u.points_total DESC,
               u.exact_hits   DESC,
               u.username     ASC
    )                                     AS rank,
    u.user_id,
    u.username,
    u.points_total,
    u.exact_hits,
    u.hits_total,
    u.misses_total,
    u.predicted_tournament_winner_id,
    u.predicted_top_scorer_id
  FROM public.users u
  JOIN public.user_pools up ON up.user_id = u.user_id
  WHERE up.pool_id = p_pool_id;
$$;


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after the blocks above to confirm everything landed.
-- ============================================================

-- Check constraints exist
SELECT conname, contype
FROM pg_constraint
WHERE conname IN (
  'uq_prediction_user_match',
  'uq_user_pool_membership',
  'uq_points_event_per_match',
  'chk_predicted_scores_non_negative'
);

-- Check triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN ('trg_enforce_deadline', 'trg_match_finished')
ORDER BY trigger_name;

-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'enforce_prediction_deadline',
    'process_match_scoring',
    'trg_fn_match_finished',
    'process_tournament_bonus_scoring',
    'apply_late_pick_penalty',
    'get_pool_leaderboard',
    'current_user_id'
  )
ORDER BY routine_name;

-- Check the view exists
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('pool_predictions_view', 'leaderboard_view');
