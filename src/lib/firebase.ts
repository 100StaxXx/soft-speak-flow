import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase configuration - all values must come from environment variables
// Never hardcode production credentials in source code
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate required Firebase config - fail fast if missing
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  const errorMsg = `Missing required Firebase config: ${missingFields.join(', ')}. Please add VITE_FIREBASE_* variables to .env file. See FIREBASE-SETUP.md for details.`;
  console.error('❌', errorMsg);
  console.error('   Missing fields:', missingFields);
  // Throw error to prevent app from running with invalid config
  // ErrorBoundary will catch this and display a helpful message
  throw new Error(errorMsg);
}

// Initialize Firebase with config from environment variables
// Using inline exports for Vite/Rollup static analysis compatibility
export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth: Auth = getAuth(firebaseApp);
export const firebaseDb: Firestore = getFirestore(firebaseApp);

console.log('✅ Firebase initialized successfully');


