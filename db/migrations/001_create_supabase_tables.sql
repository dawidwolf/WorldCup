-- Migration: create Supabase tables (excluding matches and teams)
-- Generated to match Documentation/PROJECT_MASTER_PLAN_TEMPLATE.md

/* Order matters so referenced tables exist for FK constraints */
BEGIN;

-- 1) pools
CREATE TABLE IF NOT EXISTS pools (
  pool_id serial PRIMARY KEY,
  pool_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) player_stats (derived canonical)
CREATE TABLE IF NOT EXISTS player_stats (
  player_id serial PRIMARY KEY,
  player_name text NOT NULL,
  team_id integer,
  goals integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_stats_goals_desc ON player_stats (goals DESC);

-- 3) users
CREATE TABLE IF NOT EXISTS users (
  user_id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  predicted_tournament_winner_id integer,
  predicted_top_scorer_id integer REFERENCES player_stats(player_id),
  points_total integer NOT NULL DEFAULT 0,
  late_winner_penalty boolean NOT NULL DEFAULT FALSE,
  late_scorer_penalty boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) user_pools (join table)
CREATE TABLE IF NOT EXISTS user_pools (
  user_pool_id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pool_id integer NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pool_id)
);

-- 5) predictions
CREATE TABLE IF NOT EXISTS predictions (
  prediction_id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  match_id integer NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  predicted_home_score integer NOT NULL DEFAULT 0,
  predicted_away_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  late_penalty_applied boolean NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_pred_scores_nonnegative CHECK (predicted_home_score >= 0 AND predicted_away_score >= 0),
  CONSTRAINT uq_user_match UNIQUE (user_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);

-- 6) standings (derived team standings)
CREATE TABLE IF NOT EXISTS standings (
  standing_id serial PRIMARY KEY,
  team_id integer NOT NULL,
  "group" text,
  played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  goal_difference integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standings_group_points ON standings ("group", points DESC, goal_difference DESC);

-- 7) user_points_events (audit ledger)
CREATE TABLE IF NOT EXISTS user_points_events (
  user_points_event_id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  match_id integer REFERENCES matches(match_id),
  event_type text NOT NULL,
  points_delta integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_points_events_user_id ON user_points_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_events_event_type ON user_points_events(event_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_points_events_bonus_once
  ON user_points_events (user_id, event_type, reason)
  WHERE event_type IN ('late_bonus_penalty', 'tournament_winner_hit', 'tournament_top_scorer_hit');

-- 8) match_results_history
CREATE TABLE IF NOT EXISTS match_results_history (
  match_results_history_id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  recorded_by text
);
CREATE INDEX IF NOT EXISTS idx_match_results_history_match_id ON match_results_history(match_id);

-- 9) top_scorers (legacy compatibility)
CREATE TABLE IF NOT EXISTS top_scorers (
  player_id serial PRIMARY KEY,
  player_name text NOT NULL,
  team_flag text,
  goals integer NOT NULL DEFAULT 0
);

COMMIT;

-- Optional: helper function to refresh updated_at on UPDATE (used by application or triggers)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Conditional FK constraints for `teams` (handles different identifier casing or absent table)
DO $$
DECLARE
  tbl text := NULL;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'teams' AND n.nspname = current_schema()
  ) THEN
    tbl := 'teams';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Teams' AND n.nspname = current_schema()
  ) THEN
    tbl := 'Teams';
  END IF;

  IF tbl IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_player_stats_team') THEN
      EXECUTE format('ALTER TABLE player_stats ADD CONSTRAINT fk_player_stats_team FOREIGN KEY (team_id) REFERENCES %I(team_id)', tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_predicted_winner_team') THEN
      EXECUTE format('ALTER TABLE users ADD CONSTRAINT fk_users_predicted_winner_team FOREIGN KEY (predicted_tournament_winner_id) REFERENCES %I(team_id)', tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_standings_team') THEN
      EXECUTE format('ALTER TABLE standings ADD CONSTRAINT fk_standings_team FOREIGN KEY (team_id) REFERENCES %I(team_id)', tbl);
    END IF;
  ELSE
    RAISE NOTICE 'No teams table detected in schema %, skipping FK creation.', current_schema();
  END IF;
END
$$;
