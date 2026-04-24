-- Add RLS policy for drivers to update their own shifts (for check-in/out)
CREATE POLICY "Drivers can update their own shifts"
  ON public.driver_shifts
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Add check_in_at and check_out_at columns for tracking
ALTER TABLE public.driver_shifts
ADD COLUMN check_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN check_out_at TIMESTAMP WITH TIME ZONE;