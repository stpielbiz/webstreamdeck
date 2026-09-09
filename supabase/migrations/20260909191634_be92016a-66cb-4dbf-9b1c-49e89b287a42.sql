CREATE TYPE public.playlist_kind AS ENUM ('xtream', 'm3u');
CREATE TYPE public.item_kind AS ENUM ('live', 'movie', 'series', 'episode');

CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind public.playlist_kind NOT NULL,
  server_url TEXT,
  username TEXT,
  password TEXT,
  m3u_url TEXT,
  epg_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX playlists_user_idx ON public.playlists(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists_own" ON public.playlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  item_kind public.item_kind NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, playlist_id, item_kind, item_id)
);
CREATE INDEX favorites_user_playlist_idx ON public.favorites(user_id, playlist_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  item_kind public.item_kind NOT NULL,
  item_id TEXT NOT NULL,
  series_id TEXT,
  season INTEGER,
  episode INTEGER,
  title TEXT NOT NULL,
  poster_url TEXT,
  position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, playlist_id, item_kind, item_id)
);
CREATE INDEX watch_progress_recent_idx ON public.watch_progress(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_progress TO authenticated;
GRANT ALL ON public.watch_progress TO service_role;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch_progress_own" ON public.watch_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER playlists_touch BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER watch_progress_touch BEFORE UPDATE ON public.watch_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();