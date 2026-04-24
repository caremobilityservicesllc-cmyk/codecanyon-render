import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { playNotificationSound } from './useNotificationSound';
import { useLanguage } from '@/contexts/LanguageContext';

interface UseDriverRealTimeNotificationsProps {
  driverId: string | undefined;
  enabled?: boolean;
}

export function useDriverRealTimeNotifications({
  driverId,
  enabled = true,
}: UseDriverRealTimeNotificationsProps) {
  const queryClient = useQueryClient();
  const notifiedBookingsRef = useRef<Set<string>>(new Set());
  const { t } = useLanguage();

  useEffect(() => {
    if (!driverId || !enabled) return;

    const channel = supabase
      .channel(`driver-bookings-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newBooking = payload.new as {
            id: string;
            booking_reference: string;
            pickup_location: string;
            driver_id: string | null;
            status: string;
          };
          const oldBooking = payload.old as {
            driver_id: string | null;
          };

          if (
            newBooking.driver_id === driverId &&
            oldBooking.driver_id !== driverId &&
            !notifiedBookingsRef.current.has(newBooking.id)
          ) {
            notifiedBookingsRef.current.add(newBooking.id);
            
            toast.success(t.driverNotifications.newRideAssigned, {
              description: t.driverNotifications.bookingAt
                .replace('{ref}', newBooking.booking_reference)
                .replace('{location}', newBooking.pickup_location),
              duration: 8000,
              action: {
                label: t.driverNotifications.view,
                onClick: () => {
                  queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
                },
              },
            });

            playNotificationSound();
            queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
          }

          if (newBooking.status !== (payload.old as { status: string }).status) {
            queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['driver-bookings'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newBooking = payload.new as {
            id: string;
            booking_reference: string;
            pickup_location: string;
          };

          if (!notifiedBookingsRef.current.has(newBooking.id)) {
            notifiedBookingsRef.current.add(newBooking.id);
            
            toast.success(t.driverNotifications.newRideAssigned, {
              description: t.driverNotifications.bookingAt
                .replace('{ref}', newBooking.booking_reference)
                .replace('{location}', newBooking.pickup_location),
              duration: 8000,
            });

            playNotificationSound();
            queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, enabled, queryClient, t]);
}
