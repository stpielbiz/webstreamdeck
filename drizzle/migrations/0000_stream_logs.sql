CREATE TABLE public.stream_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  device text,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stream_logs TO authenticated;
GRANT ALL ON public.stream_logs TO service_role;
ALTER TABLE public.stream_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users save own logs" ON public.stream_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own logs" ON public.stream_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));