-- db/migrations/003_drop_redundant_top_scorers.sql
-- Drop the redundant top_scorers table as it is an accidental clone of player_stats.
-- All logic and foreign keys (like users.predicted_top_scorer_id) should reference player_stats instead.

DROP TABLE IF EXISTS top_scorers CASCADE;
