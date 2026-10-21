ALTER TABLE public.account_access ADD COLUMN transfer_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_transfer_sent()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.account_access
     SET expires_at = GREATEST(COALESCE(expires_at, now()), now()) + interval '48 hours',
         transfer_claimed_at = now()
   WHERE user_id = auth.uid() AND transfer_claimed_at IS NULL AND never_expires = false
  RETURNING expires_at INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'Already claimed'; END IF;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.claim_transfer_sent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_transfer_sent() TO authenticated;