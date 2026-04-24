-- Create table to track map API usage
CREATE TABLE public.map_api_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'mapbox')),
  api_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider, api_type, recorded_at)
);

-- Enable RLS
ALTER TABLE public.map_api_usage ENABLE ROW LEVEL SECURITY;

-- Admins can manage all usage records
CREATE POLICY "Admins can manage map API usage"
  ON public.map_api_usage
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view usage statistics
CREATE POLICY "Anyone can view map API usage"
  ON public.map_api_usage
  FOR SELECT
  USING (true);

-- Create function to increment usage counter (upsert pattern)
CREATE OR REPLACE FUNCTION public.increment_map_api_usage(
  p_provider TEXT,
  p_api_type TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.map_api_usage (provider, api_type, request_count, recorded_at)
  VALUES (p_provider, p_api_type, p_count, CURRENT_DATE)
  ON CONFLICT (provider, api_type, recorded_at)
  DO UPDATE SET request_count = map_api_usage.request_count + p_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_map_api_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_map_api_usage TO anon;