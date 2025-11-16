import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
}

export const ProtectedRoute = ({ children, requireMentor = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to load
    if (authLoading || profileLoading) return;

    // Redirect to auth if not logged in
    if (!user) {
      navigate("/auth");
      return;
    }

    // Redirect to onboarding if mentor required but not selected
    if (requireMentor && profile && !profile.selected_mentor_id) {
      navigate("/onboarding");
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
        <div className="text-center space-y-4">
          <p className="text-foreground">We couldn't find your profile. Please sign in again.</p>
          <button
            onClick={async () => { await signOut(); navigate("/auth"); }}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
