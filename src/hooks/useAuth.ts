import { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { convertFirebaseUser, AuthUser } from "@/lib/firebase/auth";

// Firebase session type, shaped like the old Supabase Session for compatibility
export interface Session {
  user: AuthUser;
  access_token?: string;
  expires_at?: number;
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isInitialCheck = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let listenerSetup = false;
    const startTime = Date.now();
    
    // Check if Firebase auth is initialized
    if (!firebaseAuth) {
      console.error('[useAuth] ❌ Firebase auth not initialized - check Firebase config');
      setLoading(false);
      return;
    }
    
    // Check for persisted user immediately (no network wait)
    const persistedUser = firebaseAuth.currentUser;
    if (persistedUser) {
      console.log('[useAuth] Found persisted user immediately:', persistedUser.email);
      const authUser = convertFirebaseUser(persistedUser);
      if (authUser) {
        setUser(authUser);
        setSession({ user: authUser });
        setLoading(false);
        isInitialCheck = false;
        // Still set up listener for future auth changes, but don't block on it
      }
    }
    
    // Set up Firebase auth state listener - this should fire immediately
    console.log('[useAuth] ✅ Firebase auth available, registering onAuthStateChanged listener...');
    listenerSetup = true;
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser: FirebaseUser | null) => {
        // Clear timeout since we got a response
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Only log on initial check to reduce console noise
        if (isInitialCheck) {
          const elapsed = Date.now() - startTime;
          console.log(`[useAuth] 🔥 Auth state resolved after ${elapsed}ms:`, firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
        }
        
        const authUser = convertFirebaseUser(firebaseUser);
        
        if (authUser) {
          setUser(authUser);
          // For initial check, get token quickly; for subsequent changes, can take longer
          const token = isInitialCheck 
            ? await firebaseUser.getIdToken(false).catch(() => undefined) // Don't force refresh on initial load
            : await firebaseUser.getIdToken().catch(() => undefined);
          
          setSession({
            user: authUser,
            access_token: token,
          });
        } else {
          setUser(null);
          setSession(null);
        }
        
        setLoading(false);
        isInitialCheck = false;
      },
      (error) => {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        console.error('[useAuth] Firebase auth state error:', error);
        setUser(null);
        setSession(null);
        setLoading(false);
        isInitialCheck = false;
      }
    );
    
    // Safety timeout: Only warn if listener was set up but didn't fire within 5 seconds
    // This is a fallback for edge cases where onAuthStateChanged doesn't fire
    timeoutId = setTimeout(() => {
      if (isInitialCheck && listenerSetup) {
        console.warn(`[useAuth] ⚠️ Auth state check timeout after 5s - proceeding without user (listener may not have fired)`);
        setLoading(false);
        isInitialCheck = false;
      }
    }, 5000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return { user, session, loading, signOut };
};
