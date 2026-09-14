CREATE TABLE public.title_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lookup_key TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('movie','series')),
  resolved_title TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('tmdb','ai','none')),
  confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (lookup_key, item_kind)
);

CREATE INDEX title_metadata_lookup_idx ON public.title_metadata (item_kind, lookup_key);

GRANT SELECT ON public.title_metadata TO authenticated;
GRANT ALL ON public.title_metadata TO service_role;

ALTER TABLE public.title_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read title metadata"
ON public.title_metadata FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_title_metadata_updated_at
BEFORE UPDATE ON public.title_metadata
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();