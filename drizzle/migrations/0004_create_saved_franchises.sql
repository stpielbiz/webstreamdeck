CREATE TABLE public.saved_franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  franchise_key TEXT NOT NULL,
  franchise_name TEXT NOT NULL,
  has_story_order BOOLEAN NOT NULL DEFAULT false,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_franchises_user_key_unique UNIQUE (user_id, franchise_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_franchises TO authenticated;
GRANT ALL ON public.saved_franchises TO service_role;

ALTER TABLE public.saved_franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_franchises_select_own"
ON public.saved_franchises
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "saved_franchises_insert_own"
ON public.saved_franchises
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_franchises_update_own"
ON public.saved_franchises
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_franchises_delete_own"
ON public.saved_franchises
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX saved_franchises_user_created_idx
ON public.saved_franchises (user_id, created_at DESC);