-- Create driver_payouts table to track payout history
CREATE TABLE public.driver_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method TEXT DEFAULT 'bank_transfer',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

-- Policies for drivers to view their own payouts
CREATE POLICY "Drivers can view their own payouts"
ON public.driver_payouts
FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE user_id = auth.uid()
));

-- Admins can manage all payouts
CREATE POLICY "Admins can manage all payouts"
ON public.driver_payouts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_driver_payouts_updated_at
BEFORE UPDATE ON public.driver_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_driver_payouts_driver_id ON public.driver_payouts(driver_id);
CREATE INDEX idx_driver_payouts_status ON public.driver_payouts(status);