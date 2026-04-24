-- Create table for saved payment methods
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_last_four TEXT NOT NULL,
  card_brand TEXT NOT NULL,
  card_expiry_month INTEGER NOT NULL,
  card_expiry_year INTEGER NOT NULL,
  cardholder_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for user's default card
CREATE UNIQUE INDEX payment_methods_user_default_idx ON public.payment_methods (user_id) WHERE is_default = true;

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment methods
CREATE POLICY "Users can view their payment methods"
ON public.payment_methods
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own payment methods
CREATE POLICY "Users can add payment methods"
ON public.payment_methods
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment methods
CREATE POLICY "Users can update their payment methods"
ON public.payment_methods
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own payment methods
CREATE POLICY "Users can delete their payment methods"
ON public.payment_methods
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();