-- 017_pool_membership_rpc_repair.sql
-- Recreate the pool membership RPCs and force PostgREST to reload its schema cache.
-- This is safe to re-run and is intended to repair environments that missed 016.

DROP FUNCTION IF EXISTS public.create_pool_and_join(integer, text);

CREATE OR REPLACE FUNCTION public.create_pool_and_join(
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
  IF length(v_pool_name) < 3 THEN
    RAISE EXCEPTION 'Pool name must be at least 3 characters.';
  END IF;

  INSERT INTO public.pools (pool_name)
  VALUES (v_pool_name)
  RETURNING public.pools.pool_id, public.pools.pool_name
  INTO pool_id, pool_name;

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
  v_pool_id integer;
  v_joined_pool_name text;
BEGIN
  SELECT p.pool_id, p.pool_name
    INTO v_pool_id, v_joined_pool_name
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
      AND up.pool_id = v_pool_id
  ) THEN
    RAISE EXCEPTION 'You are already in this pool.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_pools (user_id, pool_id, is_admin)
  VALUES (p_user_id, v_pool_id, false);

  pool_id := v_pool_id;
  pool_name := v_joined_pool_name;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_pool_by_name(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_by_name(integer, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.leave_pool(
  p_user_id integer,
  p_pool_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_pools
  WHERE user_id = p_user_id
    AND pool_id = p_pool_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_pool(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_pool(integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';