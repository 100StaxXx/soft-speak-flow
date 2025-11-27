# 🔔 Native iOS Push Notifications Setup Guide

**Status:** ✅ Code Implemented - APNs Configuration Required

---

## 📋 Overview

Native iOS push notifications have been implemented in your app using the `@capacitor/push-notifications` plugin. This guide will help you complete the setup with Apple Push Notification service (APNs).

---

## ✅ What's Already Done

### 1. Plugin Installed
```bash
✅ @capacitor/push-notifications@latest installed
```

### 2. Code Implementation
- ✅ `src/utils/pushNotifications.ts` - Updated to support both web and native push
- ✅ Platform detection (web vs iOS/Android)
- ✅ Native push token registration
- ✅ Push notification listeners
- ✅ Database storage for tokens

### 3. Configuration
- ✅ `capacitor.config.ts` - PushNotifications plugin configured
- ✅ Database migration - `platform` column added to `push_subscriptions`

### 4. Features
- ✅ Permission request handling
- ✅ Token registration with APNs
- ✅ Notification display (handled by iOS)
- ✅ Notification tap handling
- ✅ Deep linking support

---

## 🔧 What You Need To Do

### Step 1: Create APNs Auth Key (10 minutes)

1. **Go to Apple Developer Portal**
   - Visit: https://developer.apple.com/account/resources/authkeys/list
   - Sign in with your Apple Developer account

2. **Create New Key**
   - Click the **"+"** button to create a new key
   - Name: `R-Evolution Push Notifications` (or any name)
   - Enable: **Apple Push Notifications service (APNs)**
   - Click **Continue**

3. **Download Key**
   - Click **Register** to create the key
   - **Download the .p8 file** (e.g., `AuthKey_ABC123XYZ.p8`)
   - ⚠️ **IMPORTANT:** You can only download this ONCE! Keep it safe!
   - Note the **Key ID** (shown on screen, e.g., `ABC123XYZ`)
   - Note your **Team ID** (found in top-right of Apple Developer portal)

4. **Keep These Values Safe**
   ```
   Key ID: ABC123XYZ
   Team ID: XYZ123ABC
   File: AuthKey_ABC123XYZ.p8 (contents)
   Bundle ID: com.revolution.app
   ```

---

### Step 2: Configure Xcode Project (5 minutes)

1. **Open iOS Project**
   ```bash
   npx cap open ios
   ```

2. **Select App Target**
   - In Xcode, click "App" in left sidebar
   - Select "App" under TARGETS

3. **Go to Signing & Capabilities**
   - Click "Signing & Capabilities" tab
   - Click **"+ Capability"** button

4. **Add Push Notifications**
   - Search for "Push Notifications"
   - Double-click to add
   - Should show: ✅ **Push Notifications** capability added

5. **Enable Background Modes** (Optional, for background notifications)
   - Click **"+ Capability"** again
   - Search for "Background Modes"
   - Enable: **Remote notifications**

6. **Verify Entitlements**
   - You should see a file: `App/App.entitlements`
   - It should contain:
   ```xml
   <key>aps-environment</key>
   <string>development</string>
   ```

---

### Step 3: Update Backend to Send Native Push (30-60 minutes)

You'll need to update your Supabase Edge Functions to send push notifications via APNs for iOS devices.

#### Option A: Use a Third-Party Service (Recommended)

**Firebase Cloud Messaging (FCM)** supports both iOS and Android with a single API:

1. **Set up Firebase project**
   - Go to https://console.firebase.google.com
   - Create a project or use existing
   - Add iOS app with Bundle ID: `com.revolution.app`

2. **Upload APNs Key to Firebase**
   - In Firebase Console: Project Settings → Cloud Messaging
   - Under "Apple app configuration"
   - Upload your .p8 file
   - Enter Key ID and Team ID

3. **Update Edge Functions**
   - Install FCM Admin SDK in edge functions
   - Use FCM to send to both iOS and Android tokens
   - Single API for all platforms

#### Option B: Send Directly to APNs (Advanced)

If you want to send directly to APNs without FCM:

1. **Store APNs credentials in Supabase secrets**
   ```bash
   # In Supabase Dashboard → Project Settings → Edge Functions → Secrets
   APNS_KEY_ID=ABC123XYZ
   APNS_TEAM_ID=XYZ123ABC
   APNS_KEY_FILE=[contents of .p8 file]
   APNS_BUNDLE_ID=com.revolution.app
   ```

2. **Create APNs sending function**
   - Use `node-apn` or HTTP/2 API
   - Send push to APNs servers
   - Handle responses and token expiration

**Example Edge Function for APNs:**

```typescript
// supabase/functions/send-native-push/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  // Get push tokens for a user
  const { userId, title, body } = await req.json();
  
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, platform')
    .eq('user_id', userId);

  // Send to each platform
  for (const sub of subscriptions) {
    if (sub.platform === 'ios') {
      await sendToAPNs(sub.endpoint, { title, body });
    } else if (sub.platform === 'android') {
      await sendToFCM(sub.endpoint, { title, body });
    } else if (sub.platform === 'web') {
      await sendWebPush(sub, { title, body });
    }
  }

  return new Response(JSON.stringify({ success: true }));
});
```

---

### Step 4: Test on Physical Device (15 minutes)

**⚠️ Push notifications ONLY work on physical iOS devices, NOT simulators!**

1. **Build & Run on Device**
   ```bash
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
   - In Xcode: Select your physical iPhone
   - Click ▶️ Run

2. **Enable Notifications**
   - Open app on device
   - Go to Profile → Push Notifications
   - Enable notifications
   - iOS will show permission dialog
   - Tap **Allow**

3. **Check Token Registration**
   - In Xcode Console, you should see:
     ```
     Native push token: [long token string]
     ```
   - Check Supabase database:
     ```sql
     SELECT * FROM push_subscriptions WHERE platform = 'ios';
     ```
   - Should see your device token

4. **Send Test Notification**
   - Use your backend function to send a push
   - Or use a tool like [Pusher](https://github.com/noodlewerk/NWPusher)
   - Notification should appear on device

---

## 📊 Database Schema

The `push_subscriptions` table now supports multiple platforms:

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  endpoint TEXT NOT NULL,        -- Web Push endpoint OR APNs/FCM token
  p256dh TEXT,                   -- Web Push only
  auth TEXT,                     -- Web Push only
  user_agent TEXT,
  platform TEXT DEFAULT 'web',   -- 'web', 'ios', or 'android'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Platform values:**
- `'web'` - Web Push API (browsers)
- `'ios'` - APNs token (iPhone/iPad)
- `'android'` - FCM token (Android devices)

---

## 🔍 How It Works

### Registration Flow

1. **User enables notifications in app**
   - App calls `subscribeToPush(userId)`

2. **Platform detection**
   - On iOS: Uses `@capacitor/push-notifications`
   - On web: Uses Web Push API

3. **iOS registration**
   - Requests permission via Capacitor
   - Registers with APNs
   - Receives device token from Apple
   - Saves token to database with `platform = 'ios'`

4. **Backend sends notification**
   - Queries database for user's subscriptions
   - Sends via appropriate service based on platform
   - iOS: Send to APNs with device token
   - Web: Send via Web Push with VAPID

### Notification Delivery

1. **Backend sends to APNs**
   ```
   Your Backend → APNs Servers → User's iPhone
   ```

2. **iOS displays notification**
   - Even if app is closed
   - Shows in notification center
   - Badge, sound, alert (configured in `capacitor.config.ts`)

3. **User taps notification**
   - App opens (launches if closed)
   - `pushNotificationActionPerformed` event fires
   - Can navigate to specific screen using `data.url`

---

## 🚀 Production Checklist

### Before TestFlight Upload

- [ ] APNs Auth Key created and downloaded
- [ ] Push Notifications capability added in Xcode
- [ ] Database migration applied (platform column)
- [ ] Code synced: `npx cap sync ios`
- [ ] Tested on physical device
- [ ] Backend configured to send to APNs
- [ ] Production APNs environment configured

### For App Store Release

- [ ] Change APNs environment from `development` to `production`
  - In `App.entitlements`: `<string>production</string>`
- [ ] Test with production APNs certificates
- [ ] Implement token refresh logic (tokens can expire)
- [ ] Handle notification permissions gracefully
- [ ] Privacy policy mentions push notifications

---

## 🐛 Troubleshooting

### "No permission to register for push"
**Solution:** Check that Push Notifications capability is added in Xcode

### "Token not received"
**Solutions:**
- Ensure you're testing on physical device (not simulator)
- Check internet connection
- Check Apple Developer account is active
- Verify Bundle ID matches

### "Failed to send notification"
**Solutions:**
- Verify APNs credentials (Key ID, Team ID, .p8 file)
- Check device token is valid
- Ensure using correct environment (development vs production)
- Check APNs server status: https://developer.apple.com/system-status/

### "Notification not showing on device"
**Solutions:**
- Check device notification settings (Settings → R-Evolution → Notifications)
- Ensure app has permission
- Check notification payload is valid
- Try restarting device

### "Token expired or invalid"
**Solutions:**
- Tokens can expire or become invalid if user uninstalls/reinstalls
- Implement token refresh logic
- Handle APNs error responses (410 Gone = token invalid)

---

## 📚 Additional Resources

**Apple Documentation:**
- [Registering Your App with APNs](https://developer.apple.com/documentation/usernotifications/registering_your_app_with_apns)
- [Sending Notification Requests to APNs](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
- [Handling Notifications](https://developer.apple.com/documentation/usernotifications/handling_notifications_and_notification-related_actions)

**Capacitor Documentation:**
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [iOS Setup](https://capacitorjs.com/docs/ios)

**Testing Tools:**
- [Pusher for macOS](https://github.com/noodlewerk/NWPusher) - Test APNs without backend
- [APNs Tool](https://github.com/onmyway133/PushNotifications) - Another testing tool

---

## 💡 Recommendations

### Use Firebase Cloud Messaging (FCM)

**Why:**
- Single API for iOS and Android
- Handles APNs certificate management
- Better error handling and reporting
- Free tier is generous
- Well-documented
- Easier to implement

**Alternative:**
- Send directly to APNs (more control, but more complex)

### Implement Notification Categories

Add action buttons to notifications:

```typescript
// In capacitor.config.ts
PushNotifications: {
  presentationOptions: ['badge', 'sound', 'alert'],
  categories: [
    {
      identifier: 'task_complete',
      actions: [
        { identifier: 'complete', title: 'Mark Complete' },
        { identifier: 'snooze', title: 'Snooze' }
      ]
    }
  ]
}
```

### Handle Deep Linking

Navigate users to specific screens when tapping notifications:

```typescript
// In pushNotifications.ts listener
if (data.screen === 'companion') {
  window.location.href = '/companion';
} else if (data.task_id) {
  window.location.href = `/tasks/${data.task_id}`;
}
```

---

## ✅ Summary

**Current Status:**
- ✅ Plugin installed
- ✅ Code implemented
- ✅ Database ready
- ⚠️ APNs configuration needed (you must do this)
- ⚠️ Backend sending logic needed (you must implement this)

**Time to Complete:**
- APNs setup: 10-15 minutes
- Xcode configuration: 5 minutes  
- Backend updates: 30-60 minutes
- Testing: 15 minutes
- **Total: ~1-2 hours**

**Next Step:**
Follow **Step 1** above to create your APNs Auth Key in Apple Developer Portal.

---

**Questions?** Refer to the troubleshooting section or Apple's documentation.

Good luck! 🚀
