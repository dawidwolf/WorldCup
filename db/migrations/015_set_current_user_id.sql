-- 015_set_current_user_id.sql
-- Helper for the custom PIN auth flow.
-- Stores the app user id in a session-local setting so RLS policies can
-- reference public.current_user_id() during the current request/connection.

CREATE OR REPLACE FUNCTION public.set_current_user_id(uid integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(uid::text, '-1'), true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_current_user_id(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_user_id(integer) TO anon, authenticated;
