import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// VAPID public key - this should match the one in your edge function secrets
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export const usePushNotifications = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      // Check if already subscribed
      if (supported && user) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await (registration as any).pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (e) {
          console.log('Error checking subscription:', e);
        }
      }
    };

    checkSupport();
  }, [user]);

  // Register service worker on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('Failed to unregister service workers in development:', error);
        });
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error(t.pushNotifications.notSupported);
      return false;
    }

    if (!user) {
      toast.error(t.pushNotifications.pleaseSignIn);
      return false;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result !== 'granted') {
        toast.error(t.pushNotifications.permissionDenied);
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subscriptionJson = subscription.toJSON();
      
      if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
        throw new Error('Invalid subscription data');
      }

      // Store subscription in database
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscriptionJson.endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      }, {
        onConflict: 'user_id,endpoint'
      });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success(t.pushNotifications.enabled);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast.error(t.pushNotifications.failedToEnable);
      setIsLoading(false);
      return false;
    }
  }, [isSupported, user]);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [permission]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Unsubscribe from push manager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      setIsSubscribed(false);
      toast.success(t.pushNotifications.disabled);
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error(t.pushNotifications.failedToDisable);
    }

    setIsLoading(false);
  }, [user]);

  const testNotification = useCallback(async () => {
    if (!user) return;

    try {
      const pnt = (t as any).pushNotificationTest || {};
      const testTitle = pnt.title || 'Test Notification';
      const testBody = pnt.body || 'Push notifications are working! 🎉';
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: testTitle,
          body: testBody,
          data: { url: '/' }
        }
      });

      if (error) throw error;
      toast.success(t.pushNotifications.testSent);
    } catch (error) {
      console.error('Error sending test notification:', error);
      const pnt = (t as any).pushNotificationTest || {};
      sendLocalNotification(pnt.title || 'Test Notification', {
        body: pnt.body || 'Push notifications are working! 🎉'
      });
    }
  }, [user, sendLocalNotification]);

  return {
    isSupported,
    permission,
    isEnabled: permission === 'granted' && isSubscribed,
    isSubscribed,
    isLoading,
    requestPermission,
    sendLocalNotification,
    unsubscribe,
    testNotification,
  };
};
