-- 016_pool_membership_rpc.sql
-- SECURITY DEFINER RPCs for pool creation and membership changes.
-- These bypass client-side RLS on public.pools/public.user_pools so the
-- custom PIN auth flow can create and join pools reliably.

CREATE OR REPLACE FUNCTION public.create_pool_and_join(
  p_user_id integer,
  p_pool_name text
)
RETURNS TABLE (
  pool_id integer,
  pool_name text,
  invite_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_name text := trim(coalesce(p_pool_name, ''));
  v_invite_code text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
BEGIN
  IF length(v_pool_name) < 3 THEN
    RAISE EXCEPTION 'Pool name must be at least 3 characters.';
  END IF;

  INSERT INTO public.pools (pool_name, invite_code)
  VALUES (v_pool_name, v_invite_code)
  RETURNING public.pools.pool_id, public.pools.pool_name, public.pools.invite_code
  INTO pool_id, pool_name, invite_code;

  INSERT INTO public.user_pools (user_id, pool_id, is_admin)
  VALUES (p_user_id, pool_id, true);

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pool_and_join(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pool_and_join(integer, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_pool_by_name(
  p_user_id integer,
  p_pool_name text
)
RETURNS TABLE (
  pool_id integer,
  pool_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_name text := trim(coalesce(p_pool_name, ''));
BEGIN
  SELECT p.pool_id, p.pool_name
    INTO pool_id, pool_name
  FROM public.pools p
  WHERE lower(p.pool_name) = lower(v_pool_name)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_pools up
    WHERE up.user_id = p_user_id
      AND up.pool_id = pool_id
  ) THEN
    RAISE EXCEPTION 'You are already in this pool.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_pools (user_id, pool_id, is_admin)
  VALUES (p_user_id, pool_id, false);

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_pool_by_name(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_by_name(integer, text) TO anon, authenticated;
