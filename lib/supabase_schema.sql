-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.match_results_history (
  match_id bigint NOT NULL,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL,
  recorded_by text,
  match_results_history_id integer NOT NULL DEFAULT nextval('match_results_history_match_results_history_id_seq'::regclass) UNIQUE,
  CONSTRAINT match_results_history_pkey PRIMARY KEY (match_results_history_id),
  CONSTRAINT match_results_history_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(match_id)
);
CREATE TABLE public.matches (
  match_id bigint NOT NULL,
  round text,
  location text,
  home_team text,
  away_team text,
  group text,
  home_score integer CHECK (home_score IS NULL OR home_score >= 0),
  away_score integer CHECK (away_score IS NULL OR away_score >= 0),
  group_turn integer,
  api_fixture_id integer,
  is_finished boolean DEFAULT false,
  home_flag text,
  away_flag text,
  status text,
  home_team_id bigint,
  away_team_id bigint,
  kickoff_utc timestamp with time zone,
  CONSTRAINT matches_pkey PRIMARY KEY (match_id),
  CONSTRAINT fk_matches_home_team FOREIGN KEY (home_team_id) REFERENCES public.teams(team_id),
  CONSTRAINT fk_matches_away_team FOREIGN KEY (away_team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.player_stats (
  player_id integer NOT NULL DEFAULT nextval('player_stats_player_id_seq'::regclass),
  player_name text NOT NULL,
  team_id bigint,
  goals integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  api_player_id integer,
  CONSTRAINT player_stats_pkey PRIMARY KEY (player_id),
  CONSTRAINT fk_player_stats_team FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.pools (
  pool_name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pool_id integer NOT NULL DEFAULT nextval('pools_pool_id_seq'::regclass) UNIQUE,
  invite_code text UNIQUE,
  CONSTRAINT pools_pkey PRIMARY KEY (pool_id)
);
CREATE TABLE public.predictions (
  user_id integer NOT NULL,
  match_id bigint NOT NULL,
  predicted_home_score integer NOT NULL DEFAULT 0,
  predicted_away_score integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  late_penalty_applied boolean NOT NULL DEFAULT false,
  prediction_id integer NOT NULL DEFAULT nextval('predictions_prediction_id_seq'::regclass) UNIQUE,
  CONSTRAINT predictions_pkey PRIMARY KEY (prediction_id),
  CONSTRAINT fk_predictions_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(match_id)
);
CREATE TABLE public.standings (
  team_id bigint NOT NULL UNIQUE,
  group text,
  played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  goal_difference integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  standing_id integer NOT NULL DEFAULT nextval('standings_standing_id_seq'::regclass) UNIQUE,
  CONSTRAINT standings_pkey PRIMARY KEY (standing_id),
  CONSTRAINT fk_standings_team FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.teams (
  team_id bigint NOT NULL,
  team_name text,
  abbreviation text UNIQUE,
  group text,
  team_flag text,
  CONSTRAINT teams_pkey PRIMARY KEY (team_id)
);
CREATE TABLE public.user_points_events (
  user_id integer NOT NULL,
  match_id bigint,
  event_type text NOT NULL,
  points_delta integer NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_points_event_id integer NOT NULL DEFAULT nextval('user_points_events_user_points_event_id_seq'::regclass) UNIQUE,
  CONSTRAINT user_points_events_pkey PRIMARY KEY (user_points_event_id),
  CONSTRAINT fk_user_points_events_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_points_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(match_id)
);
CREATE TABLE public.user_pools (
  user_id integer NOT NULL,
  pool_id integer NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  user_pool_id integer NOT NULL DEFAULT nextval('user_pools_user_pool_id_seq'::regclass) UNIQUE,
  is_admin boolean DEFAULT false,
  CONSTRAINT user_pools_pkey PRIMARY KEY (user_pool_id),
  CONSTRAINT fk_user_pools_user FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_user_pools_pool FOREIGN KEY (pool_id) REFERENCES public.pools(pool_id)
);
CREATE TABLE public.users (
  user_id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username text NOT NULL UNIQUE,
  predicted_tournament_winner_id bigint,
  predicted_top_scorer_id integer,
  points_total integer NOT NULL DEFAULT 0,
  late_winner_penalty boolean NOT NULL DEFAULT false,
  late_scorer_penalty boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pin text,
  exact_hits integer NOT NULL DEFAULT 0,
  hits_total integer DEFAULT 0,
  misses_total integer DEFAULT 0,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT fk_users_predicted_winner_team FOREIGN KEY (predicted_tournament_winner_id) REFERENCES public.teams(team_id),
  CONSTRAINT fk_users_predicted_top_scorer FOREIGN KEY (predicted_top_scorer_id) REFERENCES public.player_stats(player_id)
);