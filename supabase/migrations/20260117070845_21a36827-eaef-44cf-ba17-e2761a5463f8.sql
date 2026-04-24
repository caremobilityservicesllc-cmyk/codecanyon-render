-- ==========================================
-- SAVED LOCATIONS for users
-- ==========================================
CREATE TABLE public.saved_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  is_default_pickup BOOLEAN DEFAULT false,
  is_default_dropoff BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved locations"
ON public.saved_locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved locations"
ON public.saved_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved locations"
ON public.saved_locations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved locations"
ON public.saved_locations FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_locations_updated_at
BEFORE UPDATE ON public.saved_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- FAVORITE VEHICLES for users
-- ==========================================
CREATE TABLE public.favorite_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, vehicle_id)
);

ALTER TABLE public.favorite_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their favorite vehicles"
ON public.favorite_vehicles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorite vehicles"
ON public.favorite_vehicles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorite vehicles"
ON public.favorite_vehicles FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- DRIVERS table
-- ==========================================
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  license_number TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  current_location_lat DECIMAL(10, 8),
  current_location_lng DECIMAL(11, 8),
  average_rating DECIMAL(3, 2) DEFAULT 5.00,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage drivers"
ON public.drivers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active drivers"
ON public.drivers FOR SELECT
USING (is_active = true);

CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- DRIVER RATINGS
-- ==========================================
CREATE TABLE public.driver_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings"
ON public.driver_ratings FOR SELECT
USING (true);

CREATE POLICY "Users can rate their completed bookings"
ON public.driver_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage ratings"
ON public.driver_ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- Add driver_id and tracking fields to bookings
-- ==========================================
ALTER TABLE public.bookings
ADD COLUMN driver_id UUID REFERENCES public.drivers(id),
ADD COLUMN estimated_arrival TIME,
ADD COLUMN driver_location_lat DECIMAL(10, 8),
ADD COLUMN driver_location_lng DECIMAL(11, 8),
ADD COLUMN ride_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN ride_completed_at TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- RECURRING BOOKINGS
-- ==========================================
CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'weekdays', 'custom');

CREATE TABLE public.recurring_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_booking_id UUID,
  frequency recurring_frequency NOT NULL,
  custom_days TEXT[],
  start_date DATE NOT NULL,
  end_date DATE,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  pickup_time TIME NOT NULL,
  vehicle_id UUID NOT NULL,
  passengers INTEGER DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their recurring bookings"
ON public.recurring_bookings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create recurring bookings"
ON public.recurring_bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their recurring bookings"
ON public.recurring_bookings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their recurring bookings"
ON public.recurring_bookings FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all recurring bookings"
ON public.recurring_bookings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_recurring_bookings_updated_at
BEFORE UPDATE ON public.recurring_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- NOTIFICATIONS table
-- ==========================================
CREATE TYPE notification_type AS ENUM ('booking_confirmed', 'driver_assigned', 'driver_arriving', 'ride_started', 'ride_completed', 'ride_cancelled', 'reminder', 'promo');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'push');

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  booking_id UUID,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- NOTIFICATION PREFERENCES
-- ==========================================
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_booking_confirmations BOOLEAN DEFAULT true,
  email_ride_updates BOOLEAN DEFAULT true,
  email_promotions BOOLEAN DEFAULT false,
  sms_ride_updates BOOLEAN DEFAULT true,
  sms_driver_arriving BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- RIDE SHARING (share rides with others)
-- ==========================================
CREATE TABLE public.ride_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  cost_split_percentage DECIMAL(5, 2) DEFAULT 50.00,
  is_accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ride_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares they created or received"
ON public.ride_shares FOR SELECT
USING (auth.uid() = shared_by_user_id OR auth.uid() = shared_with_user_id);

CREATE POLICY "Users can create ride shares"
ON public.ride_shares FOR INSERT
WITH CHECK (auth.uid() = shared_by_user_id);

CREATE POLICY "Recipients can update ride shares"
ON public.ride_shares FOR UPDATE
USING (auth.uid() = shared_with_user_id);

CREATE POLICY "Creators can delete ride shares"
ON public.ride_shares FOR DELETE
USING (auth.uid() = shared_by_user_id);

-- ==========================================
-- Enable realtime for tracking
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;