ALTER TABLE public.page_content ADD COLUMN footer_section text NOT NULL DEFAULT 'quick_links';
COMMENT ON COLUMN public.page_content.footer_section IS 'Footer section: legal, quick_links, or none';