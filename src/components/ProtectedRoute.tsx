import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
}

export const ProtectedRoute = ({ children, requireMentor = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to load
    if (authLoading || profileLoading) return;

    // ALWAYS redirect to auth if not logged in - even for requireMentor=false routes
    if (!user) {
      navigate("/auth");
      return;
    }

    // Redirect to onboarding if mentor required and profile missing or not selected
    if (requireMentor && (!profile || !profile.selected_mentor_id)) {
      // Double-check server state to avoid stale client redirect
      (async () => {
        try {
          if (!user) return;
          const { data } = await supabase
            .from('profiles')
            .select('selected_mentor_id')
            .eq('id', user.id)
            .maybeSingle();

          if (!data?.selected_mentor_id) {
            navigate("/onboarding");
          }
        } catch {
          navigate("/onboarding");
        }
      })();
    }
  }, [user, profile, authLoading, profileLoading, requireMentor, navigate]);

  // Show loading or nothing while checking auth
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render children until auth is confirmed
  if (!user) return null;
  if (requireMentor && (!profile || !profile.selected_mentor_id)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Setting up your profile...</div>
      </div>
    );
  }

  return <>{children}</>;
};
