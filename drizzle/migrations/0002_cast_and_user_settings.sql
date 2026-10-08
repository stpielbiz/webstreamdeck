ALTER TABLE public.title_metadata ADD COLUMN IF NOT EXISTS cast_names text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.title_metadata ADD COLUMN IF NOT EXISTS cast_checked boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS title_metadata_cast_idx ON public.title_metadata USING gin (cast_names);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  sync_playlists boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_settings_select ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_settings_insert ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_settings_update ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);