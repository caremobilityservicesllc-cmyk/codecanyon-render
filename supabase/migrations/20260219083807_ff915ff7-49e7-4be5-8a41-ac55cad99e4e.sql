
-- Create a table for managing page content
CREATE TABLE public.page_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  meta_description text DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

-- Anyone can view published pages
CREATE POLICY "Anyone can view published pages"
ON public.page_content FOR SELECT
USING (is_published = true);

-- Admins can manage all pages
CREATE POLICY "Admins can manage all pages"
ON public.page_content FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_page_content_updated_at
BEFORE UPDATE ON public.page_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pages
INSERT INTO public.page_content (page_slug, title, content) VALUES
('terms-of-service', 'Terms of Service', ''),
('privacy-policy', 'Privacy Policy', ''),
('contact', 'Contact Us', '');
