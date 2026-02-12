import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Star,
  Flame,
  Trophy,
  Heart,
  Zap,
  BookOpen,
  Users
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";
import { motion, useReducedMotion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";

const Preview = () => {
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

  const demoQuests = [
    { text: "Morning meditation", xp: 30, completed: true },
    { text: "Read for 20 minutes", xp: 25, completed: true },
    { text: "Exercise for 30 minutes", xp: 40, completed: false },
    { text: "Journal your thoughts", xp: 20, completed: false },
  ];

  const demoMentors = [
    { name: "Atlas", specialty: "Discipline & Focus", color: "#3B82F6" },
    { name: "Luna", specialty: "Mindfulness & Peace", color: "#A855F7" },
    { name: "Phoenix", specialty: "Motivation & Energy", color: "#F97316" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen bg-background pb-24 pt-safe relative z-10">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/55 px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Preview Mode</span>
          </div>
          <Button size="sm" onClick={() => navigate("/auth")}>
            Sign Up
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Demo Companion Card */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
        >
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/20 to-transparent flex items-center justify-center border border-primary/20">
                    <Heart className={`h-10 w-10 text-primary ${prefersReducedMotion ? "" : "animate-pulse"}`} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                    Lv. 1
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg text-foreground">Your Companion</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Demo</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Complete quests to help your companion evolve!
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">XP Progress</span>
                      <span className="text-primary font-medium">150 / 500</span>
                    </div>
                    <Progress value={30} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Demo Quests */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.04, duration: prefersReducedMotion ? 0 : 0.24 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Today's Quests
            </h2>
            <span className="text-sm text-muted-foreground">2/4 Complete</span>
          </div>
          <div className="space-y-2">
            {demoQuests.map((quest, index) => (
              <motion.div
                key={quest.text}
                initial={prefersReducedMotion ? false : { x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.08 + index * 0.03, duration: prefersReducedMotion ? 0 : 0.2 }}
              >
                <Card className={quest.completed ? "bg-primary/5 border-primary/20" : "bg-card"}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                      quest.completed 
                        ? "bg-primary text-primary-foreground" 
                        : "border-2 border-muted-foreground/30"
                    }`}>
                      {quest.completed && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <span className={`flex-1 ${quest.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {quest.text}
                    </span>
                    <span className="text-sm font-medium text-primary">+{quest.xp} XP</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Demo Mentors */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: prefersReducedMotion ? 0 : 0.24 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              AI Mentors
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {demoMentors.map((mentor, index) => (
              <motion.div
                key={mentor.name}
                initial={prefersReducedMotion ? false : { scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.1 + index * 0.03, duration: prefersReducedMotion ? 0 : 0.2 }}
              >
                <Card className="text-center p-4 hover:border-primary/50 transition-colors cursor-pointer">
                  <div 
                    className="h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: `${mentor.color}20` }}
                  >
                    <Users className="h-6 w-6" style={{ color: mentor.color }} />
                  </div>
                  <h4 className="font-medium text-sm">{mentor.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{mentor.specialty}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features Preview */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.12, duration: prefersReducedMotion ? 0 : 0.24 }}
        >
          <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                What You'll Get
              </h3>
              <div className="space-y-3">
                {[
                  { icon: BookOpen, text: "Daily personalized morning briefings" },
                  { icon: Trophy, text: "Epic quests and achievement system" },
                  { icon: Heart, text: "Companion that evolves with your progress" },
                  { icon: Star, text: "AI mentors with unique personalities" },
                ].map((feature, index) => (
                  <div key={feature.text} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Fixed CTA at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-bottom bg-background/90 backdrop-blur-xl border-t border-border/55">
        <div className="max-w-lg mx-auto">
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold gap-2 shadow-lg shadow-primary/25"
            onClick={() => navigate("/auth")}
          >
            Start Your Journey
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      </div>
    </PageTransition>
  );
};

export default Preview;
