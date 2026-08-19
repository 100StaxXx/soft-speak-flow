import type { CapacitorConfig } from '@capacitor/cli';

const isCosmiqBuild = process.env.VITE_PRODUCT_MODE?.trim().toLowerCase() === 'cosmiq';

const config: CapacitorConfig = {
  appId: isCosmiqBuild ? 'com.darrylgraham.revolution' : 'com.darrylgraham.graceward',
  appName: isCosmiqBuild ? 'Cosmiq' : 'Graceward',
  webDir: 'dist',
  loggingBehavior: 'none',
  // ⚠️ PRODUCTION BUILD: server config commented out
  // Only use during LOCAL development - DO NOT uncomment for iOS/Android builds!
  // server: {
  //   url: isCosmiqBuild ? 'https://app.cosmiq.quest' : 'https://graceward.app',
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
