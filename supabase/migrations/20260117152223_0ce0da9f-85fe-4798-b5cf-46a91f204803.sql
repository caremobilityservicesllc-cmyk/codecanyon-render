-- Create function to update driver average rating
CREATE OR REPLACE FUNCTION public.update_driver_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.drivers
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.driver_ratings
      WHERE driver_id = NEW.driver_id
    ),
    total_rides = (
      SELECT COUNT(*)
      FROM public.driver_ratings
      WHERE driver_id = NEW.driver_id
    )
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update average rating after new rating is inserted
CREATE TRIGGER update_driver_rating_after_insert
AFTER INSERT ON public.driver_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_driver_average_rating();