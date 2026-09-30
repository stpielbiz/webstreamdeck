CREATE TABLE public.device_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  device_label text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_codes_code_idx ON public.device_codes (code);
CREATE INDEX device_codes_user_idx ON public.device_codes (user_id);

GRANT SELECT, UPDATE ON public.device_codes TO authenticated;
GRANT ALL ON public.device_codes TO service_role;

ALTER TABLE public.device_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_codes_select_own ON public.device_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY device_codes_update_own ON public.device_codes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER device_codes_touch_updated_at
  BEFORE UPDATE ON public.device_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();