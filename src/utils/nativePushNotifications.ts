/**
 * Native Push Notification Service for iOS
 * Uses Capacitor Push Notifications Plugin
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Check if native push notifications are supported
 */
export function isNativePushSupported(): boolean {
  try {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const isSupported = isNative && platform === 'ios';
    
    // Log for debugging in Xcode console
    console.log('[NativePush] Platform check:', { isNative, platform, isSupported });
    logger.info('[NativePush] Platform check:', { isNative, platform, isSupported });
    
    return isSupported;
  } catch (error) {
    console.log('[NativePush] Platform check error:', error);
    logger.info('Native push not available:', error);
    return false;
  }
}

/**
 * Get current permission status
 */
export async function getPermissionStatus(): Promise<string> {
  if (!isNativePushSupported()) {
    return 'not_supported';
  }
  
  try {
    const status = await PushNotifications.checkPermissions();
    console.log('[NativePush] Permission status:', status.receive);
    return status.receive;
  } catch (error) {
    console.log('[NativePush] Error checking permissions:', error);
    return 'unknown';
  }
}

/**
 * Initialize native push notifications
 */
export async function initializeNativePush(userId: string): Promise<void> {
  console.log('[NativePush] ========== INIT START ==========');
  console.log('[NativePush] User ID:', userId);
  
  if (!isNativePushSupported()) {
    console.log('[NativePush] Not supported on this platform, aborting');
    logger.info('Native push not supported on this platform');
    return;
  }

  try {
    console.log('[NativePush] Step 1: Requesting permissions...');
    
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    console.log('[NativePush] Permission result:', permission);
    console.log('[NativePush] Permission receive status:', permission.receive);
    
    if (permission.receive !== 'granted') {
      console.log('[NativePush] Permission DENIED - user did not grant access');
      logger.log('Push notification permission denied');
      throw new Error('Push notification permission denied. Please enable in Settings.');
    }

    console.log('[NativePush] Step 2: Permission granted, registering with APNs...');

    // Register with Apple Push Notification service
    await PushNotifications.register();
    
    console.log('[NativePush] Step 3: Registration initiated, setting up listeners...');

    // Listen for registration success
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[NativePush] ✅ REGISTRATION SUCCESS');
      console.log('[NativePush] Device token received');
      logger.log('Push registration success');
      
      // Save device token to database
      try {
        await saveDeviceToken(userId, token.value);
        console.log('[NativePush] Token saved to database successfully');
      } catch (saveError) {
        console.log('[NativePush] ❌ Failed to save token:', saveError);
      }
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error) => {
      console.log('[NativePush] ❌ REGISTRATION ERROR');
      console.log('[NativePush] Error details:', JSON.stringify(error));
      logger.error('Push registration error:', error);
    });

    // Listen for push notifications received
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[NativePush] Notification received:', notification);
      logger.log('Push notification received:', notification);
      // Notification is displayed automatically by iOS
    });

    // Listen for push notification actions
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[NativePush] Notification action performed:', notification);
      logger.log('Push notification action performed:', notification);
      // Handle notification tap - navigate to appropriate screen
      const data = notification.notification.data;
      if (data?.url) {
        window.dispatchEvent(new CustomEvent('native-push-navigation', { detail: data.url }));
      }
    });

    console.log('[NativePush] ========== INIT COMPLETE ==========');

  } catch (error) {
    console.log('[NativePush] ❌ INIT FAILED');
    console.log('[NativePush] Error:', error);
    logger.error('Error initializing native push:', error);
    throw error;
  }
}

/**
 * Save device token to database
 */
async function saveDeviceToken(userId: string, deviceToken: string): Promise<void> {
  console.log('[NativePush] Saving token to database...');
  console.log('[NativePush] User:', userId);
  console.log('[NativePush] Token (first 20 chars):', deviceToken.substring(0, 20) + '...');
  
  try {
    const { error } = await supabase
      .from('push_device_tokens')
      .upsert({
        user_id: userId,
        device_token: deviceToken,
        platform: 'ios',
        user_agent: navigator.userAgent
      }, {
        onConflict: 'user_id,device_token'
      });

    if (error) {
      console.log('[NativePush] Database error:', error);
      logger.error('Error saving device token:', error);
      throw error;
    }

    console.log('[NativePush] ✅ Device token saved successfully');
    logger.log('Device token saved successfully');
  } catch (error) {
    console.log('[NativePush] ❌ Error saving device token:', error);
    logger.error('Error saving device token:', error);
    throw error;
  }
}

/**
 * Unregister from push notifications
 */
export async function unregisterNativePush(userId: string): Promise<void> {
  console.log('[NativePush] Unregistering...');
  
  if (!isNativePushSupported()) {
    return;
  }

  try {
    // Remove all listeners
    await PushNotifications.removeAllListeners();
    
    // Get current device token before unregistering
    const deliveredNotifications = await PushNotifications.getDeliveredNotifications();
    console.log('[NativePush] Delivered notifications:', deliveredNotifications);

    // Delete device token from database
    const { error } = await supabase
      .from('push_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'ios');

    if (error) {
      console.log('[NativePush] Error deleting token:', error);
      logger.error('Error deleting device token:', error);
    } else {
      console.log('[NativePush] Token deleted from database');
    }

  } catch (error) {
    console.log('[NativePush] Unregister error:', error);
    logger.error('Error unregistering from push:', error);
    throw error;
  }
}

/**
 * Check if user has active native push subscription
 */
export async function hasActiveNativePushSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('push_device_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'ios')
      .limit(1);

    if (error) throw error;
    const hasSubscription = (data?.length || 0) > 0;
    console.log('[NativePush] Has active subscription:', hasSubscription);
    return hasSubscription;
  } catch (error) {
    console.log('[NativePush] Error checking subscription:', error);
    logger.error('Error checking native push subscription:', error);
    return false;
  }
}

/**
 * Debug function to manually test registration
 */
export async function debugTestRegistration(userId: string): Promise<{
  platform: string;
  isNative: boolean;
  isSupported: boolean;
  permissionStatus: string;
  error?: string;
}> {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const isSupported = isNativePushSupported();
  
  let permissionStatus = 'unknown';
  let error: string | undefined;
  
  try {
    if (isSupported) {
      const status = await PushNotifications.checkPermissions();
      permissionStatus = status.receive;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  
  const result = {
    platform,
    isNative,
    isSupported,
    permissionStatus,
    error
  };
  
  console.log('[NativePush] Debug info:', result);
  return result;
}
