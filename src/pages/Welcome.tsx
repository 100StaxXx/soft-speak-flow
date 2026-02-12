import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, LogIn, Play, Star, Zap, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";
import { motion, useReducedMotion } from "framer-motion";
import { PageLoader } from "@/components/PageLoader";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { welcomeBackground } from "@/assets/backgrounds";

const Welcome = () => {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // If user is already logged in, redirect them appropriately
  useEffect(() => {
    if (!loading && user) {
      getAuthRedirectPath(user.id).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [user, loading, navigate]);

  const features = [
    { icon: Star, text: "Personal Mentors", delay: 0.1 },
    { icon: Zap, text: "Daily Quests & XP", delay: 0.2 },
    { icon: Heart, text: "Evolving Companion", delay: 0.3 },
  ];

  if (loading) {
    return <PageLoader message="Preparing your journey..." />;
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <StaticBackgroundImage background={welcomeBackground} />
      
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/50" />
      
      {/* Hero Section with iOS safe areas */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-safe-top pb-safe-bottom text-center">
        {/* Animated Logo/Brand */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
          className="mb-8"
        >
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="h-12 w-12 text-primary-foreground" />
            </div>
            <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl -z-10 animate-pulse" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.06, duration: prefersReducedMotion ? 0 : 0.24 }}
          className="text-4xl font-semibold tracking-tight mb-4 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent"
        >
          Cosmiq Quest
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: prefersReducedMotion ? 0 : 0.24 }}
          className="text-lg text-muted-foreground mb-8 px-2 md:max-w-md"
        >
          Transform your daily habits into an epic adventure with mentors and a companion that grows with you
        </motion.p>

        {/* Feature Pills */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.1, duration: prefersReducedMotion ? 0 : 0.24 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.text}
              initial={prefersReducedMotion ? false : { scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : feature.delay + 0.1, duration: prefersReducedMotion ? 0 : 0.2 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm"
            >
              <feature.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.12, duration: prefersReducedMotion ? 0 : 0.24 }}
          className="flex flex-col gap-4 w-full px-4 md:max-w-sm"
        >
          <Button
            size="lg"
            onClick={() => navigate("/preview")}
            className="w-full h-14 text-lg font-semibold gap-2 shadow-lg shadow-primary/25"
          >
            <Play className="h-5 w-5" />
            Explore Preview
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/auth")}
            className="w-full h-14 text-lg font-semibold gap-2"
          >
            <LogIn className="h-5 w-5" />
            Sign In
          </Button>
        </motion.div>
      </div>

      {/* Footer with iOS safe area */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: prefersReducedMotion ? 0 : 0.16, duration: prefersReducedMotion ? 0 : 0.2 }}
        className="relative z-10 pb-safe-bottom text-center"
      >
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <button
            onClick={() => navigate("/terms")}
            className="underline hover:text-foreground transition-colors"
          >
          Terms
          </button>{" "}
          and{" "}
          <button
            onClick={() => navigate("/privacy")}
            className="underline hover:text-foreground transition-colors"
          >
            Privacy Policy
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Welcome;
