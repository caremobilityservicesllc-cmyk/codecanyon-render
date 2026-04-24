import { useBookingStatusNotifications } from '@/hooks/useBookingStatusNotifications';

/**
 * Component that subscribes to real-time booking status changes
 * and triggers browser push notifications when status changes.
 * This should be mounted once at the app level.
 */
export function BookingStatusNotifier() {
  useBookingStatusNotifications();
  return null;
}
