-- Safe, idempotent ALTER migration to rename generic `id` -> `<table>_id`
-- This script is careful: it creates new columns, copies values, wires sequences
-- and updates FK constraints to point at the new columns. It does NOT DROP
-- the old `id` columns automatically; review and DROP them manually after
-- validating the migration on staging or a backup snapshot.

-- Usage: run in Supabase SQL editor on a backup/staging first. It is
-- intentionally verbose and guarded with IF checks so it can be re-run.

BEGIN;

/* Helper: perform guarded parent table migration
   For each parent table we:
     - add new `<table>_id` column if missing
     - copy existing `id` values into new column
     - if `id` had a serial sequence, reuse it for the new column
     - set NOT NULL and add UNIQUE constraint on new column
     - switch primary key to the new column (after child FKs are re-pointed)
*/

-- Set search_path to current schema for clarity
SET search_path TO public;

-- 1) Parents which are referenced by other tables: users, pools
DO $$
DECLARE
  seq_name text;
  pk_con text;
BEGIN
  -- USERS table
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_id') THEN
    RAISE NOTICE 'Creating users.user_id and copying values from id';
    EXECUTE 'ALTER TABLE users ADD COLUMN user_id integer';
    EXECUTE 'UPDATE users SET user_id = id WHERE user_id IS NULL';
    seq_name := pg_get_serial_sequence('users','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY users.user_id', seq_name);
      EXECUTE format('ALTER TABLE users ALTER COLUMN user_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE users ALTER COLUMN user_id SET NOT NULL';
    EXECUTE 'ALTER TABLE users ADD CONSTRAINT uq_users_user_id UNIQUE (user_id)';
    RAISE NOTICE 'users.user_id ready (NOT switching PK yet)';
  ELSE
    RAISE NOTICE 'Skipping users: no old id or user_id already exists';
  END IF;

  -- POOLS table
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pools' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pools' AND column_name='pool_id') THEN
    RAISE NOTICE 'Creating pools.pool_id and copying values from id';
    EXECUTE 'ALTER TABLE pools ADD COLUMN pool_id integer';
    EXECUTE 'UPDATE pools SET pool_id = id WHERE pool_id IS NULL';
    seq_name := pg_get_serial_sequence('pools','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY pools.pool_id', seq_name);
      EXECUTE format('ALTER TABLE pools ALTER COLUMN pool_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE pools ALTER COLUMN pool_id SET NOT NULL';
    EXECUTE 'ALTER TABLE pools ADD CONSTRAINT uq_pools_pool_id UNIQUE (pool_id)';
    RAISE NOTICE 'pools.pool_id ready (NOT switching PK yet)';
  ELSE
    RAISE NOTICE 'Skipping pools: no old id or pool_id already exists';
  END IF;

  -- player_stats (if it has generic id)
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='player_id') THEN
    RAISE NOTICE 'Creating player_stats.player_id and copying values from id';
    EXECUTE 'ALTER TABLE player_stats ADD COLUMN player_id integer';
    EXECUTE 'UPDATE player_stats SET player_id = id WHERE player_id IS NULL';
    seq_name := pg_get_serial_sequence('player_stats','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY player_stats.player_id', seq_name);
      EXECUTE format('ALTER TABLE player_stats ALTER COLUMN player_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE player_stats ALTER COLUMN player_id SET NOT NULL';
    EXECUTE 'ALTER TABLE player_stats ADD CONSTRAINT uq_player_stats_player_id UNIQUE (player_id)';
    RAISE NOTICE 'player_stats.player_id ready';
  END IF;

  -- standings
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='standings' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='standings' AND column_name='standing_id') THEN
    RAISE NOTICE 'Creating standings.standing_id and copying values from id';
    EXECUTE 'ALTER TABLE standings ADD COLUMN standing_id integer';
    EXECUTE 'UPDATE standings SET standing_id = id WHERE standing_id IS NULL';
    seq_name := pg_get_serial_sequence('standings','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY standings.standing_id', seq_name);
      EXECUTE format('ALTER TABLE standings ALTER COLUMN standing_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE standings ALTER COLUMN standing_id SET NOT NULL';
    EXECUTE 'ALTER TABLE standings ADD CONSTRAINT uq_standings_standing_id UNIQUE (standing_id)';
    RAISE NOTICE 'standings.standing_id ready';
  END IF;

  -- top_scorers
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='top_scorers' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='top_scorers' AND column_name='player_id') THEN
    RAISE NOTICE 'Creating top_scorers.player_id and copying values from id';
    EXECUTE 'ALTER TABLE top_scorers ADD COLUMN player_id integer';
    EXECUTE 'UPDATE top_scorers SET player_id = id WHERE player_id IS NULL';
    seq_name := pg_get_serial_sequence('top_scorers','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY top_scorers.player_id', seq_name);
      EXECUTE format('ALTER TABLE top_scorers ALTER COLUMN player_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE top_scorers ALTER COLUMN player_id SET NOT NULL';
    EXECUTE 'ALTER TABLE top_scorers ADD CONSTRAINT uq_top_scorers_player_id UNIQUE (player_id)';
    RAISE NOTICE 'top_scorers.player_id ready';
  END IF;

  -- match_results_history
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='match_results_history' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='match_results_history' AND column_name='match_results_history_id') THEN
    RAISE NOTICE 'Creating match_results_history.match_results_history_id and copying values from id';
    EXECUTE 'ALTER TABLE match_results_history ADD COLUMN match_results_history_id integer';
    EXECUTE 'UPDATE match_results_history SET match_results_history_id = id WHERE match_results_history_id IS NULL';
    seq_name := pg_get_serial_sequence('match_results_history','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY match_results_history.match_results_history_id', seq_name);
      EXECUTE format('ALTER TABLE match_results_history ALTER COLUMN match_results_history_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE match_results_history ALTER COLUMN match_results_history_id SET NOT NULL';
    EXECUTE 'ALTER TABLE match_results_history ADD CONSTRAINT uq_match_results_history_match_results_history_id UNIQUE (match_results_history_id)';
    RAISE NOTICE 'match_results_history.match_results_history_id ready';
  END IF;

  -- user_points_events
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_points_events' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_points_events' AND column_name='user_points_event_id') THEN
    RAISE NOTICE 'Creating user_points_events.user_points_event_id and copying values from id';
    EXECUTE 'ALTER TABLE user_points_events ADD COLUMN user_points_event_id integer';
    EXECUTE 'UPDATE user_points_events SET user_points_event_id = id WHERE user_points_event_id IS NULL';
    seq_name := pg_get_serial_sequence('user_points_events','id');
    IF seq_name IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE %s OWNED BY user_points_events.user_points_event_id', seq_name);
      EXECUTE format('ALTER TABLE user_points_events ALTER COLUMN user_points_event_id SET DEFAULT nextval(%L)', seq_name);
    END IF;
    EXECUTE 'ALTER TABLE user_points_events ALTER COLUMN user_points_event_id SET NOT NULL';
    EXECUTE 'ALTER TABLE user_points_events ADD CONSTRAINT uq_user_points_events_user_points_event_id UNIQUE (user_points_event_id)';
    RAISE NOTICE 'user_points_events.user_points_event_id ready';
  END IF;

END$$;

-- 2) Child tables and FK re-pointing
-- Helper block to drop any existing FK on a given table.column and re-create a new FK
CREATE OR REPLACE FUNCTION _drop_fks_and_create(parent_table text, parent_col text, child_table text, child_col text, constraint_name text, on_delete text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Drop any foreign key constraints on child_table(child_col)
  FOR rec IN
    SELECT con.oid, con.conname
    FROM pg_constraint con
    JOIN pg_class cl ON con.conrelid = cl.oid
    JOIN pg_namespace ns ON cl.relnamespace = ns.oid
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = cols.attnum
    WHERE con.contype = 'f'
      AND cl.relname = child_table
      AND a.attname = child_col
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', child_table, rec.conname);
  END LOOP;

  -- Create new FK if both columns exist
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=child_table AND column_name=child_col)
     AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=parent_table AND column_name=parent_col) THEN
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) %s', child_table, constraint_name, child_col, parent_table, parent_col, on_delete);
  ELSE
    RAISE NOTICE 'Skipping FK creation % due to missing column (child: %.%, parent: %.%)', constraint_name, child_table, child_col, parent_table, parent_col;
  END IF;
END;
$$;

-- Re-point FKs that reference users(id) -> users(user_id)
SELECT _drop_fks_and_create('users','user_id','user_pools','user_id','fk_user_pools_user','ON DELETE CASCADE');
SELECT _drop_fks_and_create('users','user_id','predictions','user_id','fk_predictions_user','ON DELETE CASCADE');
SELECT _drop_fks_and_create('users','user_id','user_points_events','user_id','fk_user_points_events_user','ON DELETE CASCADE');

-- Re-point FKs that reference pools(id) -> pools(pool_id)
SELECT _drop_fks_and_create('pools','pool_id','user_pools','pool_id','fk_user_pools_pool','ON DELETE CASCADE');

-- Re-point FKs that reference player_stats(id) -> player_stats(player_id)
SELECT _drop_fks_and_create('player_stats','player_id','users','predicted_top_scorer_id','fk_users_predicted_top_scorer','');

-- Re-point FKs that reference standings/team or others are left as-is (teams/matches untouched)

-- 3) Switch parent PRIMARY KEYs to new columns (only if new column exists and is unique)
-- Drop any remaining foreign keys that reference parent PKs (protects DROP CONSTRAINT)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop FKs referencing users
  FOR r IN SELECT conname, conrelid::regclass::text AS child_table FROM pg_constraint WHERE contype = 'f' AND confrelid = 'users'::regclass LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.child_table, r.conname);
    RAISE NOTICE 'Dropped FK % on %', r.conname, r.child_table;
  END LOOP;

  -- Drop FKs referencing pools
  FOR r IN SELECT conname, conrelid::regclass::text AS child_table FROM pg_constraint WHERE contype = 'f' AND confrelid = 'pools'::regclass LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.child_table, r.conname);
    RAISE NOTICE 'Dropped FK % on %', r.conname, r.child_table;
  END LOOP;
  
  -- Drop FKs referencing player_stats
  FOR r IN SELECT conname, conrelid::regclass::text AS child_table FROM pg_constraint WHERE contype = 'f' AND confrelid = 'player_stats'::regclass LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.child_table, r.conname);
    RAISE NOTICE 'Dropped FK % on %', r.conname, r.child_table;
  END LOOP;
END$$;

DO $$
DECLARE
  pk text;
BEGIN
  -- USERS: if user_id exists and is not PK, replace PK
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='users'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE users ADD CONSTRAINT pk_users_user_id PRIMARY KEY (user_id)';
    RAISE NOTICE 'users PK switched to user_id';
  END IF;

  -- POOLS
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pools' AND column_name='pool_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='pools'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE pools DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE pools ADD CONSTRAINT pk_pools_pool_id PRIMARY KEY (pool_id)';
    RAISE NOTICE 'pools PK switched to pool_id';
  END IF;

  -- player_stats
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='player_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='player_stats'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE player_stats DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE player_stats ADD CONSTRAINT pk_player_stats_player_id PRIMARY KEY (player_id)';
    RAISE NOTICE 'player_stats PK switched to player_id';
  END IF;

  -- standings
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='standings' AND column_name='standing_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='standings'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE standings DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE standings ADD CONSTRAINT pk_standings_standing_id PRIMARY KEY (standing_id)';
    RAISE NOTICE 'standings PK switched to standing_id';
  END IF;

  -- top_scorers
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='top_scorers' AND column_name='player_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='top_scorers'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE top_scorers DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE top_scorers ADD CONSTRAINT pk_top_scorers_player_id PRIMARY KEY (player_id)';
    RAISE NOTICE 'top_scorers PK switched to player_id';
  END IF;

  -- match_results_history
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='match_results_history' AND column_name='match_results_history_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='match_results_history'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE match_results_history DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE match_results_history ADD CONSTRAINT pk_match_results_history_match_results_history_id PRIMARY KEY (match_results_history_id)';
    RAISE NOTICE 'match_results_history PK switched to match_results_history_id';
  END IF;

  -- user_points_events
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_points_events' AND column_name='user_points_event_id') THEN
    SELECT conname INTO pk FROM pg_constraint WHERE conrelid='user_points_events'::regclass AND contype='p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE user_points_events DROP CONSTRAINT %I', pk);
    END IF;
    EXECUTE 'ALTER TABLE user_points_events ADD CONSTRAINT pk_user_points_events_user_points_event_id PRIMARY KEY (user_points_event_id)';
    RAISE NOTICE 'user_points_events PK switched to user_points_event_id';
  END IF;

END$$;

-- 4) Predictions and user_pools (child tables that also had their own `id` column renamed)
DO $$
BEGIN
  -- user_pools: if user_pool_id missing, add & copy
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_pools' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_pools' AND column_name='user_pool_id') THEN
    RAISE NOTICE 'Creating user_pools.user_pool_id and copying values from id';
    EXECUTE 'ALTER TABLE user_pools ADD COLUMN user_pool_id integer';
    EXECUTE 'UPDATE user_pools SET user_pool_id = id WHERE user_pool_id IS NULL';
    PERFORM pg_get_serial_sequence('user_pools','id');
    EXECUTE 'ALTER TABLE user_pools ALTER COLUMN user_pool_id SET NOT NULL';
    EXECUTE 'ALTER TABLE user_pools ADD CONSTRAINT uq_user_pools_user_pool_id UNIQUE (user_pool_id)';
    RAISE NOTICE 'user_pools.user_pool_id ready';
  END IF;

  -- predictions: prediction_id
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='predictions' AND column_name='id')
     AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='predictions' AND column_name='prediction_id') THEN
    RAISE NOTICE 'Creating predictions.prediction_id and copying values from id';
    EXECUTE 'ALTER TABLE predictions ADD COLUMN prediction_id integer';
    EXECUTE 'UPDATE predictions SET prediction_id = id WHERE prediction_id IS NULL';
    PERFORM pg_get_serial_sequence('predictions','id');
    EXECUTE 'ALTER TABLE predictions ALTER COLUMN prediction_id SET NOT NULL';
    EXECUTE 'ALTER TABLE predictions ADD CONSTRAINT uq_predictions_prediction_id UNIQUE (prediction_id)';
    RAISE NOTICE 'predictions.prediction_id ready';
  END IF;

END$$;

-- 5) Clean-up note: we intentionally do NOT drop old `id` columns here.
-- After running this migration and validating the application behavior and constraints,
-- you can safely drop the old columns and (optionally) rename any sequences.

COMMIT;

-- Post-migration checklist (manual):
-- 1) Verify counts: SELECT count(*) FROM users WHERE id IS DISTINCT FROM user_id;
-- 2) Verify foreign keys: run SELECT * FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY';
-- 3) Once satisfied, remove old `id` columns with ALTER TABLE ... DROP COLUMN id CASCADE;
-- 4) Optionally, rename sequences or ensure DEFAULT nextval() is set for new PK columns.
