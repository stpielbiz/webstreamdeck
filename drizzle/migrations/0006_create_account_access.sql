CREATE TABLE public.account_access (
  user_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ,
  never_expires BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_access_expiry_mode CHECK (
    (never_expires = TRUE AND expires_at IS NULL)
    OR (never_expires = FALSE AND expires_at IS NOT NULL)
  )
);

GRANT SELECT ON public.account_access TO authenticated;
GRANT ALL ON public.account_access TO service_role;

ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_access_select_own"
ON public.account_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_account_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_access (user_id, expires_at, never_expires)
  VALUES (NEW.id, NEW.created_at + interval '1 day', FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_account_access_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_account_access();

INSERT INTO public.account_access (user_id, expires_at, never_expires)
SELECT u.id, u.created_at + interval '1 day', FALSE
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.account_access a
SET expires_at = NULL,
    never_expires = TRUE,
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles r
  WHERE r.user_id = a.user_id
    AND r.role = 'admin'::public.app_role
);

CREATE TRIGGER account_access_touch_updated_at
BEFORE UPDATE ON public.account_access
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();