import { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { convertFirebaseUser, AuthUser } from "@/lib/firebase/auth";

// Firebase session type (compatible with Supabase Session type for migration)
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
    
    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser: FirebaseUser | null) => {
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
        console.error('Firebase auth state error:', error);
        setUser(null);
        setSession(null);
        setLoading(false);
        isInitialCheck = false;
      }
    );

    return () => unsubscribe();
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
