import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.darrylgraham.graceward',
  appName: 'Graceward',
  webDir: 'dist',
  loggingBehavior: 'none',
  // ⚠️ PRODUCTION BUILD: server config commented out
  // Only use during LOCAL development - DO NOT uncomment for iOS/Android builds!
  // server: {
  //   url: 'https://app.cosmiq.quest?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#eef0e6',
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
      presentationOptions: ['badge', 'sound']
    }
  }
};

export default config;
