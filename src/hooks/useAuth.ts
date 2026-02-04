import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getUserTimezone } from "@/utils/timezone";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Save user's timezone to profile when authenticated
  const saveUserTimezone = async (userId: string) => {
    try {
      const timezone = getUserTimezone();
      await supabase
        .from('profiles')
        .update({ timezone })
        .eq('id', userId);
    } catch (error) {
      console.error('Failed to save timezone:', error);
    }
  };

  useEffect(() => {
    // Get initial session with proper error handling
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Failed to get session:', error);
          // Still set loading to false to prevent infinite loading
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Save timezone when session is available
        if (session?.user) {
          saveUserTimezone(session.user.id);
        }
      })
      .catch((error) => {
        console.error('Unexpected auth error:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Save timezone on sign in or token refresh
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          saveUserTimezone(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return { user, session, loading, signOut };
};
