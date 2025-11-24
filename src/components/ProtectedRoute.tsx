import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
}

export const ProtectedRoute = ({ children, requireMentor = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;

    const checkAuthAndProfile = async () => {
      // Wait for auth to load
      if (authLoading) return;

      // Redirect to auth if not logged in
      if (!user) {
        if (mounted) navigate("/auth");
        return;
      }

      // Only redirect to onboarding if we're sure there's no mentor
      // Wait for profile to load before checking
      if (profileLoading) return;
      
      // Only redirect if profile exists but onboarding is incomplete
      // Don't redirect if onboarding_completed is true (prevents loops)
      if (requireMentor && profile && !profile.selected_mentor_id && !profile.onboarding_completed) {
        if (mounted) navigate("/onboarding");
      }
    };

    checkAuthAndProfile();

    return () => {
      mounted = false;
    };
  }, [user, profile, authLoading, profileLoading, requireMentor, navigate]);

  // Animate progress bar while loading
  useEffect(() => {
    if (authLoading || profileLoading) {
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);
      return () => clearInterval(timer);
    } else {
      setProgress(100);
    }
  }, [authLoading, profileLoading]);

  // Show loading or nothing while checking auth
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-8 space-y-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-foreground">Loading...</p>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </div>
    );
  }

  // Don't render children until auth is confirmed
  if (!user) return null;
  if (requireMentor && profile && !profile.selected_mentor_id && !profile.onboarding_completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-8 space-y-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-foreground">Setting up your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
