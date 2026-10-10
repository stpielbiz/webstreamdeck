ALTER TABLE public.user_settings
ADD COLUMN screen_size TEXT NOT NULL DEFAULT 'large';

ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_screen_size_valid
CHECK (screen_size IN ('large', 'medium', 'small'));

COMMENT ON COLUMN public.user_settings.screen_size IS 'Fire TV display size preference: large, medium, or small.';