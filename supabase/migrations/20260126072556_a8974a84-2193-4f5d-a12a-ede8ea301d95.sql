-- Create driver shifts table for scheduling
CREATE TABLE public.driver_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_driver_shift UNIQUE (driver_id, shift_date, start_time)
);

-- Enable RLS
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all shifts"
  ON public.driver_shifts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can view their own shifts"
  ON public.driver_shifts
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_driver_shifts_date ON public.driver_shifts(shift_date);
CREATE INDEX idx_driver_shifts_driver ON public.driver_shifts(driver_id);
CREATE INDEX idx_driver_shifts_zone ON public.driver_shifts(zone_id);
CREATE INDEX idx_driver_shifts_status ON public.driver_shifts(status);

-- Add trigger for updated_at
CREATE TRIGGER update_driver_shifts_updated_at
  BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();