-- db/migrations/006_add_exact_hits_to_users.sql
-- Add exact_hits column for leaderboard tie-breaking as specified in Section 7.3

ALTER TABLE users ADD COLUMN IF NOT EXISTS exact_hits integer NOT NULL DEFAULT 0;
