import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed, Token } from '@capacitor/push-notifications';
import { logger } from '@/utils/logger';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_KEY as string;

let hasInitializedNativeListeners = false;
let currentNativePushUserId: string | null = null;

/**
 * Subscribe the current user to push notifications
 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | void> {
  try {
    if (Capacitor.isNativePlatform()) {
      currentNativePushUserId = userId;
      setupNativePushListeners();
      await PushNotifications.requestPermissions();
      await PushNotifications.register();
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      throw new Error('Push notifications not supported in this browser');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Push notification permission denied');
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    if (!VAPID_PUBLIC_KEY) {
      throw new Error('Missing VITE_WEB_PUSH_KEY environment variable');
    }

    if (existingSubscription) {
      await savePushSubscription(userId, existingSubscription);
      return existingSubscription;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
    });

    await savePushSubscription(userId, subscription);
    return subscription;
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function setupNativePushListeners(): void {
  if (hasInitializedNativeListeners) return;
  hasInitializedNativeListeners = true;

  PushNotifications.addListener('registration', async (token: Token) => {
    logger.log('Native push token received');
    if (currentNativePushUserId) {
      await saveNativePushToken(currentNativePushUserId, token.value);
    } else {
      logger.warn('No user ID available for saving native push token');
    }
  });

  PushNotifications.addListener('registrationError', (error: { error: string }) => {
    logger.error('Native push registration error:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    logger.log('Push notification received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    logger.log('Push notification action performed:', action);
    const data = action.notification.data;
    if (data?.url) {
      window.dispatchEvent(new CustomEvent('native-push-navigation', { detail: data.url }));
    }
  });
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await deleteNativePushToken(userId);
      if (currentNativePushUserId === userId) {
        currentNativePushUserId = null;
      }
      logger.log('Native push token removed from database');
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await deletePushSubscription(userId, subscription.endpoint);
      }
    }
  } catch (error) {
    logger.error('Error unsubscribing from push:', error);
    throw error;
  }
}

async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const subJSON = subscription.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subJSON.keys?.p256dh || '',
      auth: subJSON.keys?.auth || '',
      user_agent: navigator.userAgent,
      platform: 'web'
    }, {
      onConflict: 'user_id,endpoint'
    });

  if (error) {
    logger.error('Error saving push subscription:', error);
    throw error;
  }
}

async function saveNativePushToken(userId: string, token: string): Promise<void> {
  const platform = Capacitor.getPlatform();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: token,
      p256dh: '',
      auth: '',
      user_agent: navigator.userAgent,
      platform
    }, {
      onConflict: 'user_id,endpoint'
    });

  if (error) {
    logger.error('Error saving native push token:', error);
    throw error;
  }
}

async function deleteNativePushToken(userId: string): Promise<void> {
  const platform = Capacitor.getPlatform();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .match({ user_id: userId, platform });

  if (error) {
    logger.error('Error deleting native push token:', error);
    throw error;
  }
}

async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    logger.error('Error deleting push subscription:', error);
    throw error;
  }
}

export async function hasActivePushSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  } catch (error) {
    logger.error('Error checking push subscription:', error);
    return false;
  }
}
