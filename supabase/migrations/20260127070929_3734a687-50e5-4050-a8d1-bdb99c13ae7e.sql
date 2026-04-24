-- Create storage bucket for branding assets (logo, favicon)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated admins to upload branding assets
CREATE POLICY "Allow admins to upload branding assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow public read access to branding assets
CREATE POLICY "Allow public to view branding assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding-assets');

-- Allow admins to update/delete branding assets
CREATE POLICY "Allow admins to update branding assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding-assets' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to delete branding assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding-assets' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);