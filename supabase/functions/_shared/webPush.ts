/**
 * Web Push Notification Helper
 * Sends push notifications using Web Push protocol
 */

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

/**
 * Send a Web Push notification
 * Uses the web-push standard
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushNotificationPayload,
  vapidKeys: {
    publicKey: string;
    privateKey: string;
    subject: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import web-push dynamically
    const webpush = await import('https://esm.sh/web-push@3.6.7');
    
    webpush.default.setVapidDetails(
      vapidKeys.subject,
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    };

    await webpush.default.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 3600, // 1 hour
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Web Push error:', error);
    
    // Handle specific error codes
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or invalid - should be removed
      return {
        success: false,
        error: 'SUBSCRIPTION_EXPIRED'
      };
    }
    
    if (err.statusCode === 429) {
      // Rate limited
      return {
        success: false,
        error: 'RATE_LIMITED'
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Send notifications to multiple subscriptions
 * Returns results for each subscription
 */
export async function sendToMultipleSubscriptions(
  subscriptions: PushSubscription[],
  payload: PushNotificationPayload,
  vapidKeys: {
    publicKey: string;
    privateKey: string;
    subject: string;
  }
): Promise<Array<{ subscription: PushSubscription; result: { success: boolean; error?: string } }>> {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendWebPush(sub, payload, vapidKeys))
  );

  return subscriptions.map((sub, index) => ({
    subscription: sub,
    result: results[index].status === 'fulfilled' 
      ? results[index].value 
      : { success: false, error: 'Promise rejected' }
  }));
}
