/**
 * Native Push Notification Service for iOS
 * Uses Capacitor Push Notifications Plugin
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/utils/logger';
import { saveNativePushToken, deleteNativePushToken, hasActivePushSubscription } from '@/lib/firebase/pushSubscriptions';

/**
 * Check if native push notifications are supported
 */
export function isNativePushSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch (error) {
    logger.info('Native push not available:', error);
    return false;
  }
}

/**
 * Initialize native push notifications
 */
export async function initializeNativePush(userId: string): Promise<void> {
  if (!isNativePushSupported()) {
    logger.info('Native push not supported on this platform');
    return;
  }

  try {
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive !== 'granted') {
      logger.log('Push notification permission denied');
      return;
    }

    // Register with Apple Push Notification service
    await PushNotifications.register();

    // Listen for registration success
    await PushNotifications.addListener('registration', async (token) => {
      logger.log('Push registration success, token:', token.value);
      
      // Save device token to database
      await saveDeviceToken(userId, token.value);
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error) => {
      logger.error('Push registration error:', error);
    });

    // Listen for push notifications received
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.log('Push notification received:', notification);
      // Notification is displayed automatically by iOS
    });

    // Listen for push notification actions
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      logger.log('Push notification action performed:', notification);
      // Handle notification tap - navigate to appropriate screen
      const data = notification.notification.data;
      if (data?.url) {
        window.dispatchEvent(new CustomEvent('native-push-navigation', { detail: data.url }));
      }
    });

  } catch (error) {
    logger.error('Error initializing native push:', error);
    throw error;
  }
}

/**
 * Save device token to database
 */
async function saveDeviceToken(userId: string, deviceToken: string): Promise<void> {
  try {
    await saveNativePushToken(userId, deviceToken, 'ios');
    logger.log('Device token saved successfully');
  } catch (error) {
    logger.error('Error saving device token:', error);
    throw error;
  }
}

/**
 * Unregister from push notifications
 */
export async function unregisterNativePush(userId: string): Promise<void> {
  if (!isNativePushSupported()) {
    return;
  }

  try {
    // Remove all listeners
    await PushNotifications.removeAllListeners();
    
    // Get current device token before unregistering
    const deliveredNotifications = await PushNotifications.getDeliveredNotifications();
    logger.log('Delivered notifications:', deliveredNotifications);

    // Delete device token from database
    try {
      await deleteNativePushToken(userId, 'ios');
    } catch (error) {
      logger.error('Error deleting device token:', error);
    }

  } catch (error) {
    logger.error('Error unregistering from push:', error);
    throw error;
  }
}

/**
 * Check if user has active native push subscription
 */
export async function hasActiveNativePushSubscription(userId: string): Promise<boolean> {
  try {
    return await hasActivePushSubscription(userId, 'ios');
  } catch (error) {
    logger.error('Error checking native push subscription:', error);
    return false;
  }
}
