import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  OAuthProvider,
  User as FirebaseUser,
  UserCredential
} from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { ensureProfile } from "@/utils/authRedirect";

// Re-export firebaseAuth for convenience (some files import from here)
export { firebaseAuth };

export interface AuthUser {
  uid: string;
  id: string; // Alias for uid - backward compatibility
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Convert Firebase User to our AuthUser type
export const convertFirebaseUser = (user: FirebaseUser | null): AuthUser | null => {
  if (!user) return null;
  return {
    uid: user.uid,
    id: user.uid, // Alias for backward compatibility
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
};

// Sign up with email and password
export const signUp = async (email: string, password: string, metadata?: { timezone?: string }) => {
  const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  
  // Create profile document in Firestore
  await ensureProfile(userCredential.user.uid, email, metadata);
  
  return userCredential;
};

// Sign in with email and password
export const signIn = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(firebaseAuth, email, password);
};

// Sign out
export const signOut = async () => {
  return await firebaseSignOut(firebaseAuth);
};

// Reset password
export const resetPassword = async (email: string) => {
  return await sendPasswordResetEmail(firebaseAuth, email);
};

// Sign in with Google (web)
export const signInWithGoogle = async () => {
  try {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
    }

    const provider = new GoogleAuthProvider();
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    // Check if we're on localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Try popup first (works better in most cases)
    try {
      console.log('[Google Auth] Attempting popup sign-in...');
      const userCredential = await signInWithPopup(firebaseAuth, provider);
      
      // Profile will be ensured by handlePostAuthNavigation in Auth.tsx
      // No need to do it here to avoid duplicate work
      
      return userCredential;
    } catch (popupError: any) {
      // If popup fails (e.g., popup blocked), fall back to redirect on localhost
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
        if (isLocalhost) {
          console.log('[Google Auth] Popup blocked/closed, falling back to redirect flow for localhost');
          await signInWithRedirect(firebaseAuth, provider);
          // This will redirect, so we won't reach the code below
          // The redirect will be handled by getRedirectResult in Auth.tsx
          return null as any;
        } else {
          // On production, re-throw the popup error
          throw popupError;
        }
      } else {
        // For other errors, re-throw
        throw popupError;
      }
    }
  } catch (error: any) {
    console.error('[Google Auth] Error in signInWithGoogle:', error);
    // Provide more helpful error messages
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google sign-in. Please contact support.');
    } else if (error.message) {
      throw error;
    } else {
      throw new Error('Failed to sign in with Google. Please try again.');
    }
  }
};

// Sign in with Google (native - using idToken from Capacitor plugin)
export const signInWithGoogleCredential = async (idToken: string, accessToken?: string) => {
  // GoogleAuthProvider.credential() is a static method
  const credential = accessToken 
    ? GoogleAuthProvider.credential(idToken, accessToken)
    : GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(firebaseAuth, credential);
  
  // Profile will be ensured by handlePostAuthNavigation in Auth.tsx
  // No need to do it here to avoid duplicate work
  
  return userCredential;
};

// Sign in with Apple (using credential - works for both web and native)
export const signInWithAppleCredential = async (idToken: string, rawNonce?: string) => {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken,
    rawNonce,
  });
  
  const userCredential = await signInWithCredential(firebaseAuth, credential);
  
  // Profile will be ensured by handlePostAuthNavigation in Auth.tsx
  // No need to do it here to avoid duplicate work
  
  return userCredential;
};

// Profile management is handled in Firestore via ensureProfile (see authRedirect.ts)
// This legacy helper remains for compatibility but should defer to the Firebase-based profile flow

