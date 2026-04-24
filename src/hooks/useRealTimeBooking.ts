import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BookingTrackingInfo {
  driver_location_lat: number | null;
  driver_location_lng: number | null;
  estimated_arrival: string | null;
  status: string;
  ride_started_at: string | null;
  ride_completed_at: string | null;
}

export function useRealTimeBooking(bookingId: string | null) {
  const [trackingInfo, setTrackingInfo] = useState<BookingTrackingInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    // Initial fetch
    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('driver_location_lat, driver_location_lng, estimated_arrival, status, ride_started_at, ride_completed_at')
        .eq('id', bookingId)
        .single();
      
      if (!error && data) {
        setTrackingInfo({
          driver_location_lat: data.driver_location_lat ? Number(data.driver_location_lat) : null,
          driver_location_lng: data.driver_location_lng ? Number(data.driver_location_lng) : null,
          estimated_arrival: data.estimated_arrival,
          status: data.status,
          ride_started_at: data.ride_started_at,
          ride_completed_at: data.ride_completed_at,
        });
      }
    };

    fetchBooking();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const data = payload.new as any;
          setTrackingInfo({
            driver_location_lat: data.driver_location_lat ? Number(data.driver_location_lat) : null,
            driver_location_lng: data.driver_location_lng ? Number(data.driver_location_lng) : null,
            estimated_arrival: data.estimated_arrival,
            status: data.status,
            ride_started_at: data.ride_started_at,
            ride_completed_at: data.ride_completed_at,
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  return { trackingInfo, isConnected };
}
