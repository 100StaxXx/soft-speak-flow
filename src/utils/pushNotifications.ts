/**
 * Push Notification Service
 * Handles both Web Push (browsers) and Native Push (iOS/Android via Capacitor)
 * Web Push Notification Service (DEPRECATED FOR iOS)
 * NOTE: This file is deprecated for native iOS. Use nativePushNotifications.ts instead.
 * Only kept for potential future web-only deployment.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from "@/integrations/supabase/client";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Warn if VAPID key is not configured for web
if (!VAPID_PUBLIC_KEY && typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  console.warn('VITE_VAPID_PUBLIC_KEY not configured. Web push notifications will be disabled.');
}

// Disable on native platforms
if (Capacitor.isNativePlatform()) {
  console.log('Web push disabled on native platform. Use nativePushNotifications.ts');
}

// Track if native push listeners are already registered
let nativePushListenersRegistered = false;

// Store current user ID for native push token registration
// This is updated whenever a user subscribes to push
let currentNativePushUserId: string | null = null;

/**
 * Convert base64 string to Uint8Array (for VAPID key)
 * Only used for Web Push API, not native push
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // This function is only called in web context, but add safety check
  if (typeof window === 'undefined' || !window.atob) {
    throw new Error('atob not available - this should only be called in browser context');
  }
  
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported (web only, not native)
 */
export function isPushSupported(): boolean {
  // Native platforms always support push
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  // Web browsers need service worker and PushManager
  return 'serviceWorker' in navigator && 'PushManager' in window;
  return !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }
  
  // Native platform
  if (Capacitor.isNativePlatform()) {
    const result = await PushNotifications.requestPermissions();
    // Map native permission to web NotificationPermission type
    return result.receive === 'granted' ? 'granted' : 'denied';
  }
  
  // Web platform
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe to push notifications
 * Returns PushSubscription for web, or a mock subscription object for native
 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  try {
    // Request permission first
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return null;
    }

    // Native platform (iOS/Android)
    if (Capacitor.isNativePlatform()) {
      await subscribeToNativePush(userId);
      // Return a mock subscription object so components know subscription succeeded
      // The actual token will be received asynchronously via the listener
      return {} as PushSubscription;
    }

    // Web platform
    return await subscribeToWebPush(userId);
  } catch (error) {
    console.error('Error subscribing to push:', error);
    throw error;
  }
}

/**
 * Subscribe to native push notifications (iOS/Android)
 */
async function subscribeToNativePush(userId: string): Promise<void> {
  // Update current user ID for token registration
  currentNativePushUserId = userId;
  
  // Register push notifications
  await PushNotifications.register();
  
  // Set up listeners (only once per app lifecycle)
  if (!nativePushListenersRegistered) {
    setupNativePushListeners();
    nativePushListenersRegistered = true;
  }
  
  console.log('Native push notifications registered for user:', userId);
}

/**
 * Subscribe to web push notifications (browsers)
 */
async function subscribeToWebPush(userId: string): Promise<PushSubscription | null> {
  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('Cannot subscribe to push notifications: VAPID key not configured');
      return null;
    }
    
    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
    });
  }

  if (subscription) {
    // Save subscription to database
    await savePushSubscription(userId, subscription);
  }

  return subscription;
}

/**
 * Set up native push notification listeners
 * These are set up once per app lifecycle and use the current user ID
 */
function setupNativePushListeners(): void {
  // Called when push registration succeeds
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('Native push token received:', token.value);
    
    // Use the current user ID (set during subscribeToPush call)
    if (currentNativePushUserId) {
      await saveNativePushToken(currentNativePushUserId, token.value);
    } else {
      console.warn('No user ID available for saving native push token');
    }
  });

  // Called when push registration fails
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Native push registration error:', error);
  });

  // Called when a push notification is received
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push notification received:', notification);
    // Notification is automatically shown by the OS
  });

  // Called when a push notification is tapped
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('Push notification action performed:', action);
    // Handle notification tap (e.g., navigate to specific screen)
    const data = action.notification.data;
    if (data && data.url) {
      window.location.href = data.url;
    }
  });
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    // Native platform
    if (Capacitor.isNativePlatform()) {
      // Note: Native push can't be "unregistered" per se, but we can remove from database
      await deleteNativePushToken(userId);
      // Clear the stored user ID if it matches
      if (currentNativePushUserId === userId) {
        currentNativePushUserId = null;
      }
      console.log('Native push token removed from database');
      return;
    }

    // Web platform
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await deletePushSubscription(userId, subscription.endpoint);
      }
    }
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    throw error;
  }
}

/**
 * Save web push subscription to database
 */
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
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Save native push token to database (iOS/Android)
 */
async function saveNativePushToken(userId: string, token: string): Promise<void> {
  const platform = Capacitor.getPlatform(); // 'ios' or 'android'
  
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: token, // Store FCM/APNs token in endpoint field
      p256dh: '', // Not used for native push
      auth: '', // Not used for native push
      user_agent: navigator.userAgent,
      platform: platform
    }, {
      onConflict: 'user_id,endpoint'
    });

  if (error) {
    console.error('Error saving native push token:', error);
    throw error;
  }
}

/**
 * Delete native push token from database
 */
async function deleteNativePushToken(userId: string): Promise<void> {
  const platform = Capacitor.getPlatform();
  
  const result = await (supabase as any)
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform);

  if (result.error) {
    console.error('Error deleting native push token:', result.error);
    throw result.error;
  }
}

/**
 * Delete push subscription from database
 */
async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Error deleting push subscription:', error);
    throw error;
  }
}

/**
 * Check if user has active push subscription
 */
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
    console.error('Error checking push subscription:', error);
    return false;
  }
}
