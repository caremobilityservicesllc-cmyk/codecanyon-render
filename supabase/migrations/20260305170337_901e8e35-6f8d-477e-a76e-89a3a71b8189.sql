
CREATE TABLE public.translation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL,
  translation_key text NOT NULL,
  translation_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language_code, translation_key)
);

ALTER TABLE public.translation_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage translations
CREATE POLICY "Admins can manage translation overrides"
  ON public.translation_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Everyone can read translations
CREATE POLICY "Anyone can read translation overrides"
  ON public.translation_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Update trigger
CREATE TRIGGER update_translation_overrides_updated_at
  BEFORE UPDATE ON public.translation_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
