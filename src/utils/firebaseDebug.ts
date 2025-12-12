/**
 * Firebase debugging utility
 * Helps diagnose Firebase initialization and auth issues
 */

import { firebaseAuth, firebaseApp } from '@/lib/firebase';

export function logFirebaseStatus() {
  console.group('🔍 Firebase Status Check');
  
  try {
    console.log('✅ firebaseApp exists:', !!firebaseApp);
    console.log('✅ firebaseAuth exists:', !!firebaseAuth);
    
    if (firebaseAuth) {
      const currentUser = firebaseAuth.currentUser;
      console.log('👤 Current user:', currentUser ? currentUser.email : 'null');
      console.log('📋 Auth state ready:', firebaseAuth.app.name);
    }
    
    // Check environment variables
    const envVars = {
      apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: !!import.meta.env.VITE_FIREBASE_APP_ID,
    };
    console.log('🔑 Env vars present:', envVars);
    
    // Check if any are undefined
    const undefinedVars = Object.entries(envVars).filter(([_, exists]) => !exists);
    if (undefinedVars.length > 0) {
      console.error('❌ Missing env vars:', undefinedVars.map(([key]) => key));
    }
    
  } catch (error) {
    console.error('❌ Error checking Firebase status:', error);
  }
  
  console.groupEnd();
}
