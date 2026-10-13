CREATE TABLE public.recent_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  title text NOT NULL,
  logo_url text,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, playlist_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_channels TO authenticated;
GRANT ALL ON public.recent_channels TO service_role;
ALTER TABLE public.recent_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY recent_channels_own ON public.recent_channels FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recent_channels_lookup ON public.recent_channels (user_id, playlist_id, watched_at DESC);