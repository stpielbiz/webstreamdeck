CREATE TABLE public.franchise_lookups (
  lookup_key text PRIMARY KEY,
  franchise_name text,
  has_story_order boolean NOT NULL DEFAULT false,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.franchise_lookups TO authenticated;
GRANT ALL ON public.franchise_lookups TO service_role;
ALTER TABLE public.franchise_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read franchises" ON public.franchise_lookups FOR SELECT TO authenticated USING (true);