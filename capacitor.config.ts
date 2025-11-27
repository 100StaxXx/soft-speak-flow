import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.revolution.app',
  appName: 'R-Evolution',
  webDir: 'dist',
  // ⚠️ PRODUCTION BUILD: server config commented out
  // Only use during LOCAL development - DO NOT uncomment for iOS/Android builds!
  // server: {
  //   url: 'https://1b75b247-809a-454c-82ea-ceca9d5f620c.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    SocialLogin: {
      providers: {
        google: true,      // Google Sign-In enabled
        facebook: false,   // Facebook disabled (not bundled)
        apple: true,       // Apple Sign-In enabled
        twitter: false     // Twitter disabled (not bundled)
      }
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
