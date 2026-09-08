-- 034_rate_limits.sql
-- Application-level rate limiting for create-login and link-account APIs.
-- Protects against repeated account creation attempts, member-ID probing,
-- and excessive requests to custom Vercel authentication endpoints.
--
-- SECURITY NOTE: The check_rate_limit function is intended to be called
-- server-side by Vercel edge functions using the service_role client.
-- It is NOT intended to be called directly from the browser.
-- EXECUTE permission is granted only to service_role.
--
-- CONCURRENCY: The function uses an atomic INSERT ... ON CONFLICT ... DO UPDATE
-- pattern within a single CTE statement. This guarantees that concurrent
-- requests cannot both pass a rate limit when doing so would exceed the
-- configured maximum. PostgreSQL's row-level locking on the UNIQUE
-- constraint (identifier, endpoint) serializes concurrent conflicting
-- operations, ensuring exactly one request increments the count.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (identifier, endpoint)
);

-- Revoke any prior direct client access. Only the server-side service_role
-- role should be able to execute this function.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;

-- Only the Vercel serverless function (running as service_role) can call this.
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_requests INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET check_function_args = off
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_result BOOLEAN;
BEGIN
  -- Validate inputs to prevent abuse.
  IF p_identifier IS NULL OR p_identifier = '' THEN
    RAISE EXCEPTION 'identifier is required';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint = '' THEN
    RAISE EXCEPTION 'endpoint is required';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'window_seconds must be positive';
  END IF;
  IF p_max_requests IS NULL OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'max_requests must be positive';
  END IF;

  v_window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Atomically clean expired records and upsert the current request.
  -- The DELETE removes expired window records first.
  -- The INSERT creates a new record (count=1) on first request in a window.
  -- ON CONFLICT increments the count ONLY if it hasn't reached the limit.
  -- If the count has reached the limit, the WHERE clause prevents the
  -- UPDATE, RETURNING returns nothing, and the query returns false.
  -- PostgreSQL serializes concurrent conflicting operations via the
  -- UNIQUE constraint on (identifier, endpoint), preventing the race
  -- condition where two requests both read the same count and both pass.
  WITH cleaned AS (
      DELETE FROM public.rate_limits
      WHERE window_start < v_window_start
  ),
  upsert AS (
      INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
      VALUES (p_identifier, p_endpoint, 1, now())
      ON CONFLICT (identifier, endpoint) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1,
          window_start = now()
      WHERE public.rate_limits.request_count < p_max_requests
      RETURNING public.rate_limits.request_count
  )
  SELECT EXISTS (SELECT 1 FROM upsert) INTO v_result;

  RETURN v_result;
END;
$$;

-- No direct table grants needed: rate_limits is not in 002_table_grants.sql
-- and is only accessible through the SECURITY DEFINER function.
-- Clients cannot SELECT/INSERT/UPDATE/DELETE rate_limits records directly.
