import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';

interface BookingStatusChange {
  id: string;
  booking_reference: string;
  status: string;
  user_id: string | null;
  contact_email: string | null;
  driver_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  ride_started_at: string | null;
}

const STATUS_MESSAGES: Record<string, { title: string; body: (ref: string) => string }> = {
  confirmed: {
    title: '✅ Booking Confirmed',
    body: (ref) => `Your booking ${ref} has been confirmed. Your driver will be assigned soon.`,
  },
  completed: {
    title: '🎉 Ride Completed',
    body: (ref) => `Your ride ${ref} has been completed. Thank you for traveling with us!`,
  },
  cancelled: {
    title: '❌ Booking Cancelled',
    body: (ref) => `Your booking ${ref} has been cancelled.`,
  },
  pending: {
    title: '⏳ Booking Pending',
    body: (ref) => `Your booking ${ref} is awaiting confirmation.`,
  },
};

export function useBookingStatusNotifications() {
  const { user } = useAuth();
  const { isEnabled, sendLocalNotification } = usePushNotifications();
  const previousStatusesRef = useRef<Map<string, { status: string; driver_id: string | null; ride_started_at: string | null }>>(new Map());
  const normalizedUserEmail = user?.email?.trim().toLowerCase() || '';

  const handleStatusChange = useCallback(async (
    newData: BookingStatusChange,
    previous: { status: string; driver_id: string | null; ride_started_at: string | null } | undefined
  ) => {
    // Driver assigned notification
    if (!previous?.driver_id && newData.driver_id) {
      console.log(`Driver assigned to booking ${newData.booking_reference}`);
      
      if (isEnabled) {
        sendLocalNotification('🚗 Driver Assigned', {
          body: `A driver has been assigned to your booking ${newData.booking_reference}. They will pick you up soon!`,
          tag: `driver-${newData.id}`,
          data: { url: `/track?id=${newData.id}` },
        });
      }
    }

    // Ride started notification
    if (!previous?.ride_started_at && newData.ride_started_at) {
      console.log(`Ride started for booking ${newData.booking_reference}`);
      
      if (isEnabled) {
        sendLocalNotification('🚀 Ride Started', {
          body: `Your ride ${newData.booking_reference} has begun. Enjoy your journey!`,
          tag: `ride-start-${newData.id}`,
          data: { url: `/track?id=${newData.id}` },
        });
      }
    }

    // Status change notification
    if (previous?.status && previous.status !== newData.status) {
      console.log(`Booking ${newData.booking_reference} status changed: ${previous.status} -> ${newData.status}`);
      
      const statusConfig = STATUS_MESSAGES[newData.status];
      if (statusConfig) {
        if (isEnabled) {
          sendLocalNotification(statusConfig.title, {
            body: statusConfig.body(newData.booking_reference),
            tag: `booking-${newData.id}`,
            data: { url: `/track?id=${newData.id}` },
          });

          // Also try to send push notification via edge function
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: user?.id,
                title: statusConfig.title,
                body: statusConfig.body(newData.booking_reference),
                data: { 
                  url: `/track?id=${newData.id}`,
                  bookingId: newData.id,
                  status: newData.status,
                },
              },
            });
          } catch (err) {
            console.log('Push notification fallback to local:', err);
          }
        }
      }
    }
  }, [isEnabled, sendLocalNotification, user?.id]);

  useEffect(() => {
    if (!user) return;

    // Fetch initial booking statuses
    const fetchInitialStatuses = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id, status, driver_id, ride_started_at')
        .or(`user_id.eq.${user.id},contact_email.eq.${normalizedUserEmail}`);
      
      if (data) {
        data.forEach((booking) => {
          previousStatusesRef.current.set(booking.id, {
            status: booking.status,
            driver_id: booking.driver_id,
            ride_started_at: booking.ride_started_at,
          });
        });
      }
    };

    fetchInitialStatuses();

    // Subscribe to booking updates for this user
    const channel = supabase
      .channel(`user-bookings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
        },
        async (payload) => {
          const newData = payload.new as BookingStatusChange;
          const matchesUser = newData.user_id === user.id;
          const matchesEmail = String(newData.contact_email || '').trim().toLowerCase() === normalizedUserEmail;

          if (!matchesUser && !matchesEmail) {
            return;
          }

          const previous = previousStatusesRef.current.get(newData.id);
          
          await handleStatusChange(newData, previous);
          
          // Update the tracked status
          previousStatusesRef.current.set(newData.id, {
            status: newData.status,
            driver_id: newData.driver_id,
            ride_started_at: newData.ride_started_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, normalizedUserEmail, handleStatusChange]);
}
