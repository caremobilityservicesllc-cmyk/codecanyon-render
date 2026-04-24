-- Create storage bucket for vehicle images
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-images', 'vehicle-images', true);

-- Allow public read access to vehicle images
CREATE POLICY "Anyone can view vehicle images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vehicle-images');

-- Admins can upload vehicle images
CREATE POLICY "Admins can upload vehicle images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update vehicle images
CREATE POLICY "Admins can update vehicle images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'vehicle-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete vehicle images
CREATE POLICY "Admins can delete vehicle images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'vehicle-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);