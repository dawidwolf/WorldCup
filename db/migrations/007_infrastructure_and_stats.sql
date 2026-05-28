-- db/migrations/007_infrastructure_and_stats.sql
-- 1) Create Teams table
CREATE TABLE IF NOT EXISTS teams (
  team_id serial PRIMARY KEY,
  team_name text NOT NULL,
  abbreviation text NOT NULL UNIQUE,
  team_flag text,
  "group" text
);

-- 2) Create Matches table
CREATE TABLE IF NOT EXISTS matches (
  match_id serial PRIMARY KEY,
  round text,
  kickoff_utc timestamptz NOT NULL,
  location text,
  group_turn integer,
  "group" text,
  home_team_id integer REFERENCES teams(team_id),
  away_team_id integer REFERENCES teams(team_id),
  home_score integer,
  away_score integer,
  is_finished boolean DEFAULT false,
  status text
);

-- 3) Add exact_hits to users if not present (from previous suggestion)
ALTER TABLE users ADD COLUMN IF NOT EXISTS exact_hits integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hits_total integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS misses_total integer NOT NULL DEFAULT 0;

-- 4) Ensure FKs on users and other tables match what the app expects
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_predicted_winner_team;
ALTER TABLE users ADD CONSTRAINT fk_users_predicted_winner_team 
  FOREIGN KEY (predicted_tournament_winner_id) REFERENCES teams(team_id);

-- 5) Add home/away flag directly to matches if needed (Master Plan 8.5)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_flag text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_flag text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team text; -- For convenience
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team text; -- For convenience
