-- Create zones table for geographic pricing areas
CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routes table for fixed-price routes
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  origin_zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  destination_zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  estimated_distance_km NUMERIC,
  estimated_duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing rules table for dynamic pricing
CREATE TYPE public.pricing_rule_type AS ENUM ('time', 'distance', 'zone', 'vehicle');
CREATE TYPE public.day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rule_type pricing_rule_type NOT NULL,
  -- Time-based fields
  start_time TIME,
  end_time TIME,
  days_of_week day_of_week[],
  -- Distance-based fields
  min_distance_km NUMERIC,
  max_distance_km NUMERIC,
  -- Zone-based fields
  zone_id UUID REFERENCES public.zones(id) ON DELETE CASCADE,
  -- Vehicle-based fields
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_category TEXT,
  -- Pricing adjustment
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  flat_fee NUMERIC NOT NULL DEFAULT 0,
  -- Priority (higher = applied first)
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Policies for zones
CREATE POLICY "Anyone can view active zones" ON public.zones FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all zones" ON public.zones FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert zones" ON public.zones FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update zones" ON public.zones FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete zones" ON public.zones FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Policies for routes
CREATE POLICY "Anyone can view active routes" ON public.routes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all routes" ON public.routes FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert routes" ON public.routes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update routes" ON public.routes FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete routes" ON public.routes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Policies for pricing_rules
CREATE POLICY "Anyone can view active pricing rules" ON public.pricing_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all pricing rules" ON public.pricing_rules FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert pricing rules" ON public.pricing_rules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update pricing rules" ON public.pricing_rules FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete pricing rules" ON public.pricing_rules FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();