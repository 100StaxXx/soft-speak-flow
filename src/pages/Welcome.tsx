import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, LogIn, Play, Star, Zap, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";
import { motion, useScroll, useTransform } from "framer-motion";
import { PageLoader } from "@/components/PageLoader";
import { getRandomBackground } from "@/assets/backgrounds";
const Welcome = () => {
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
    { icon: Star, text: "AI-Powered Mentors", delay: 0.1 },
    { icon: Zap, text: "Daily Quests & XP", delay: 0.2 },
    { icon: Heart, text: "Evolving Companion", delay: 0.3 },
  ];

  const backgroundImage = useMemo(() => getRandomBackground(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use scroll without target to avoid hydration error when ref isn't mounted yet
  const { scrollYProgress } = useScroll();
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  if (loading) {
    return <PageLoader message="Preparing your journey..." />;
  }

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Parallax Background */}
      <motion.div 
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          y: backgroundY,
          scale: 1.1,
        }}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/70" />
      {/* Hero Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {/* Animated Logo/Brand */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
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
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent"
        >
          Cosmiq Quest
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg text-muted-foreground mb-8 max-w-sm"
        >
          Transform your daily habits into an epic adventure with AI mentors and a companion that grows with you
        </motion.p>

        {/* Feature Pills */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.text}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: feature.delay + 0.4, duration: 0.3 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm"
            >
              <feature.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col gap-4 w-full max-w-xs"
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

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="relative z-10 pb-8 text-center"
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
