-- Create vehicles table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  passengers integer NOT NULL DEFAULT 4,
  luggage integer NOT NULL DEFAULT 2,
  image text,
  features text[] DEFAULT '{}',
  price_per_km numeric(10,2) DEFAULT 0,
  base_price numeric(10,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Public read access for active vehicles (for booking flow)
CREATE POLICY "Anyone can view active vehicles"
ON public.vehicles
FOR SELECT
USING (is_active = true);

-- Admins can view all vehicles including inactive
CREATE POLICY "Admins can view all vehicles"
ON public.vehicles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert vehicles
CREATE POLICY "Admins can insert vehicles"
ON public.vehicles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update vehicles
CREATE POLICY "Admins can update vehicles"
ON public.vehicles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete vehicles
CREATE POLICY "Admins can delete vehicles"
ON public.vehicles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing vehicle data
INSERT INTO public.vehicles (id, name, category, passengers, luggage, image, features, sort_order) VALUES
  (gen_random_uuid(), 'First Class', 'Luxury', 3, 2, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=250&fit=crop', ARRAY['Premium Everything', 'Champagne', 'Privacy Partition', 'Entertainment', 'Concierge'], 1),
  (gen_random_uuid(), 'Executive Van', 'Van', 8, 8, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop', ARRAY['Group Seating', 'Climate Control', 'WiFi', 'Luggage Space', 'USB Ports'], 2),
  (gen_random_uuid(), 'Premium SUV', 'SUV', 6, 5, 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&h=250&fit=crop', ARRAY['Spacious Interior', 'Leather Seats', 'Climate Control', 'WiFi', 'Entertainment'], 3),
  (gen_random_uuid(), 'Business Class', 'Business', 4, 3, 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=400&h=250&fit=crop', ARRAY['Premium Leather', 'Climate Control', 'Refreshments', 'WiFi', 'Newspaper'], 4),
  (gen_random_uuid(), 'Comfort Plus', 'Comfort', 4, 3, 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=250&fit=crop', ARRAY['Leather Seats', 'Climate Control', 'USB Charging', 'WiFi'], 5),
  (gen_random_uuid(), 'Economy Sedan', 'Economy', 4, 2, 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=250&fit=crop', ARRAY['Air Conditioning', 'USB Charging', 'WiFi'], 6);