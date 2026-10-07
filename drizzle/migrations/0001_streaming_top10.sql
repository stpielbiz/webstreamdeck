CREATE TABLE public.streaming_top10 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  kind text NOT NULL,
  rank integer NOT NULL,
  title text NOT NULL,
  year integer,
  poster_url text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streaming_top10 TO authenticated;
GRANT ALL ON public.streaming_top10 TO service_role;
ALTER TABLE public.streaming_top10 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read top 10" ON public.streaming_top10 FOR SELECT TO authenticated USING (true);
CREATE INDEX streaming_top10_lookup ON public.streaming_top10 (service, kind, rank);