# Google Sign-In Fix - Implementation Report

## Date: November 26, 2025

## Summary
Fixed Google sign-in functionality for iOS and Android by implementing native Google authentication support using `@capgo/capacitor-social-login` plugin.

## Problem
The original implementation used Supabase's web OAuth flow (`signInWithOAuth`) for Google sign-in on all platforms. This approach works on web but fails on native iOS/Android platforms because:

1. **Web OAuth requires browser redirects** - Native apps need native authentication flows
2. **Capacitor redirect issues** - The `window.location.origin` resolves to `capacitor://localhost` on mobile
3. **Poor user experience** - Web OAuth on mobile opens browser windows instead of using native Google Sign-In

## Solution Implemented

### 1. Installed Native Google Auth Plugin
- **Plugin**: `@capgo/capacitor-social-login` v7.20.0
- **Why this plugin?**: 
  - Supports Capacitor 7 (current version in project)
  - Provides native Google Sign-In for iOS and Android
  - Also supports Apple and Facebook (future-ready)
  - Actively maintained (published Nov 25, 2025)

### 2. Updated Files

#### `package.json`
Added dependency:
```json
"@capgo/capacitor-social-login": "^7.20.0"
```

#### `capacitor.config.ts`
Configured plugin providers:
```typescript
plugins: {
  SocialLogin: {
    providers: {
      google: true,      // Google Sign-In enabled
      facebook: false,   // Facebook disabled (not bundled)
      apple: true,       // Apple Sign-In enabled
      twitter: false     // Twitter disabled (not bundled)
    }
  }
}
```

#### `src/pages/Auth.tsx`
**Changes made:**

1. **Added import:**
   ```typescript
   import { SocialLogin } from '@capgo/capacitor-social-login';
   ```

2. **Added initialization in useEffect:**
   ```typescript
   if (Capacitor.isNativePlatform()) {
     await SocialLogin.initialize({
       google: {
         webClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
         iOSClientId: process.env.VITE_GOOGLE_IOS_CLIENT_ID || '',
         mode: 'online'
       }
     });
   }
   ```

3. **Updated `handleOAuthSignIn` function:**
   - For **native Google sign-in** (iOS/Android):
     - Uses `SocialLogin.login()` with native Google flow
     - Retrieves `idToken` from Google
     - Signs in to Supabase using `signInWithIdToken()`
   - For **web Google sign-in**:
     - Continues using existing `signInWithOAuth()` flow
   - For **Apple sign-in**:
     - Kept existing native implementation unchanged

## Configuration Required

### Environment Variables
Add these to your `.env` or deployment environment:

```bash
# Google Web Client ID (for web and Android)
# Get from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# Google iOS Client ID (for iOS)
# Get from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

### Google Cloud Console Setup

1. **Create OAuth 2.0 Credentials:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create project (if needed)
   - Enable Google+ API

2. **Create Web Application OAuth Client:**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://your-supabase-project.supabase.co/auth/v1/callback`
     - `https://your-production-domain.com` (if using custom domain)
   - Copy the Client ID → Use as `VITE_GOOGLE_WEB_CLIENT_ID`

3. **Create iOS OAuth Client:**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **iOS**
   - Bundle ID: `com.revolution.app`
   - Copy the Client ID → Use as `VITE_GOOGLE_IOS_CLIENT_ID`

4. **Create Android OAuth Client (if needed):**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Android**
   - Package name: `com.revolution.app`
   - SHA-1 certificate fingerprint: (get from your keystore)

### Supabase Configuration

1. **Enable Google Provider:**
   - Go to: Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add the **Web Client ID** from Google Cloud Console
   - Add the **Client Secret** from Google Cloud Console

2. **Configure Redirect URLs:**
   - Add to allowed redirect URLs:
     - `com.revolution.app://` (for mobile)
     - `https://your-production-domain.com` (for web)

### iOS Configuration

After running `npx cap sync`, update `ios/App/App/Info.plist`:

```xml
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID_HERE.apps.googleusercontent.com</string>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

### Android Configuration

After running `npx cap sync`, the plugin automatically handles Android configuration. Ensure you have:

1. **strings.xml** (created by plugin):
   - Located: `android/app/src/main/res/values/strings.xml`
   - Contains your web client ID

2. **SHA-1 Fingerprint** registered in Google Cloud Console

## Testing Checklist

### Web
- [ ] Click "Continue with Google"
- [ ] Browser redirects to Google sign-in page
- [ ] After successful sign-in, redirects back to app
- [ ] User is authenticated in Supabase

### iOS (requires TestFlight or Xcode)
- [ ] Click "Continue with Google"
- [ ] Native Google Sign-In sheet appears
- [ ] Select Google account
- [ ] User is authenticated in Supabase
- [ ] No browser windows open

### Android (requires APK or Android Studio)
- [ ] Click "Continue with Google"
- [ ] Native Google Sign-In sheet appears
- [ ] Select Google account
- [ ] User is authenticated in Supabase
- [ ] No browser windows open

## Build Commands

### Development (Web)
```bash
npm run dev
```

### Production Build (Web)
```bash
npm run build
```

### iOS Build
```bash
npm run build
npx cap sync ios
npx cap open ios
# Then build in Xcode
```

### Android Build
```bash
npm run build
npx cap sync android
npx cap open android
# Then build in Android Studio
```

## Benefits of This Implementation

1. **Native Experience** - Uses platform-native Google Sign-In UI
2. **Better Security** - No browser redirects, tokens handled securely
3. **Faster** - No page reloads or redirects on mobile
4. **Reliable** - Works offline for credential manager
5. **Consistent UX** - Same Google Sign-In experience as other native apps

## Backwards Compatibility

- ✅ **Web sign-in** - No changes, continues to work as before
- ✅ **Email/password** - No changes, continues to work as before
- ✅ **Apple sign-in** - No changes, continues to work as before
- ✅ **Existing sessions** - No impact on logged-in users

## Known Limitations

1. **Configuration Required** - Needs Google Cloud Console setup before working
2. **Environment Variables** - Must be set in build environment
3. **Build Required** - Changes require rebuilding iOS/Android apps
4. **First-time Setup** - Requires running `npx cap sync` after installation

## Migration Notes

If you previously used `@codetrix-studio/capacitor-google-auth`:
- Remove that package: `npm uninstall @codetrix-studio/capacitor-google-auth`
- Follow configuration steps above
- The API is similar but not identical

## Troubleshooting

### "Failed to initialize SocialLogin"
- Check that environment variables are set
- Verify Google Cloud Console credentials
- Ensure `npx cap sync` was run

### "No ID token received"
- Verify Google OAuth client is properly configured
- Check that iOS Client ID matches iOS bundle ID
- Ensure Supabase Google provider is enabled

### "Invalid redirect URI"
- Add `com.revolution.app://` to Supabase allowed redirect URLs
- Verify Supabase project URL in redirect configuration

### "Sign-in opens browser instead of native UI"
- Check that you're running on a native platform (not web)
- Verify plugin initialization completed successfully
- Ensure `npx cap sync` was run after installation

## Additional Resources

- [@capgo/capacitor-social-login Documentation](https://capgo.app/docs/plugins/social-login/getting-started/)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Capacitor iOS Configuration](https://capacitorjs.com/docs/ios/configuration)
- [Capacitor Android Configuration](https://capacitorjs.com/docs/android/configuration)

## Status

✅ **Implementation Complete**
- Plugin installed and configured
- Auth.tsx updated for native Google Sign-In
- Capacitor config updated
- No TypeScript or linting errors

⚠️ **Requires Configuration**
- Environment variables must be set
- Google Cloud Console setup needed
- Supabase provider configuration required
- Native app rebuild required for testing

## Next Steps

1. **Set up Google Cloud Console** credentials
2. **Configure Supabase** Google provider
3. **Add environment variables** to build configuration
4. **Run `npx cap sync`** to update native projects
5. **Build and test** on iOS/Android devices
6. **Deploy** updated apps to TestFlight/Play Store

---

**Note:** Web Google sign-in will continue to work with the existing OAuth flow. Native apps require the configuration steps above to enable Google Sign-In functionality.
