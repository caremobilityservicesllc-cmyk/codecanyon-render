import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

export const useVerificationNotifications = () => {
  const { user } = useAuth();
  const { isEnabled, sendLocalNotification: sendNotification } = usePushNotifications();
  const { t } = useLanguage();
  const vn = (t as any).verificationNotifications || {};

  useEffect(() => {
    if (!user || !isEnabled) return;

    // Subscribe to payment_methods changes for verification status
    const verificationChannel = supabase
      .channel('verification-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_methods',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRecord = payload.old as { is_verified?: boolean };
          const newRecord = payload.new as { 
            is_verified?: boolean; 
            payment_type?: string;
            card_last_four?: string;
            bank_name?: string;
            paypal_email?: string;
          };

          // Check if verification status changed
          if (oldRecord.is_verified !== newRecord.is_verified) {
            let methodDescription = vn.paymentMethod || 'Payment method';
            
            if (newRecord.payment_type === 'card' && newRecord.card_last_four) {
              methodDescription = (vn.cardEndingIn || 'Card ending in {last4}').replace('{last4}', newRecord.card_last_four);
            } else if (newRecord.payment_type === 'bank' && newRecord.bank_name) {
              methodDescription = (vn.bankAccount || '{bank} account').replace('{bank}', newRecord.bank_name);
            } else if (newRecord.payment_type === 'paypal' && newRecord.paypal_email) {
              methodDescription = `PayPal (${newRecord.paypal_email})`;
            }

            if (newRecord.is_verified) {
              sendNotification(vn.verified || 'Payment Method Verified ✓', {
                body: (vn.verifiedBody || '{method} has been successfully verified and is ready to use.').replace('{method}', methodDescription),
                tag: 'verification-success',
              });
            } else {
              sendNotification(vn.verificationFailed || 'Verification Failed', {
                body: (vn.verificationFailedBody || '{method} verification was unsuccessful. Please try again.').replace('{method}', methodDescription),
                tag: 'verification-failed',
              });
            }
          }
        }
      )
      .subscribe();

    // Subscribe to notifications table for booking-related push notifications
    const bookingNotificationsChannel = supabase
      .channel('booking-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            type: string;
            channel: string;
          };

          // Only trigger browser notifications for push channel notifications
          if (notification.channel === 'push') {
            let icon = '🚗';
            if (notification.type === 'booking_confirmed') icon = '✅';
            else if (notification.type === 'driver_assigned') icon = '👤';
            else if (notification.type === 'driver_arriving') icon = '🚙';
            else if (notification.type === 'ride_started') icon = '🛣️';
            else if (notification.type === 'ride_completed') icon = '🎉';

            sendNotification(`${icon} ${notification.title}`, {
              body: notification.message,
              tag: `booking-${notification.type}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(verificationChannel);
      supabase.removeChannel(bookingNotificationsChannel);
    };
  }, [user, isEnabled, sendNotification, vn]);
};
