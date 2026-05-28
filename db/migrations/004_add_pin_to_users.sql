-- db/migrations/004_add_pin_to_users.sql
-- Add a 4-digit numeric PIN column to the users table for authentication.

ALTER TABLE public.users ADD COLUMN pin text;

-- Note: In a production app, we would hash this, but per the "vibe coding" 
-- and student project context, we are storing it as requested.
