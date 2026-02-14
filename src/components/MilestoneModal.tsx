import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Flame } from "lucide-react";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { useEffect } from "react";
import { ShareableStreakBadge } from "./ShareableStreakBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MilestoneModalProps {
  open: boolean;
  onClose: () => void;
  streak: number;
  habitTitle: string;
  mentorName?: string;
}

export const MilestoneModal = ({ 
  open, 
  onClose, 
  streak, 
  habitTitle,
  mentorName 
}: MilestoneModalProps) => {
  useEffect(() => {
    if (open) {
      haptics.success(); // Haptic celebration
      // Trigger confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      
      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.3),
            y: Math.random() - 0.2
          },
          colors: ['#8B5CF6', '#EC4899', '#F59E0B']
        });
        
        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.7, 0.9),
            y: Math.random() - 0.2
          },
          colors: ['#8B5CF6', '#EC4899', '#F59E0B']
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [open]);

  const milestoneMessage = () => {
    if (streak === 3) return "First milestone reached!";
    if (streak === 7) return "One week strong!";
    if (streak === 14) return "Two weeks of dedication!";
    if (streak === 30) return "One month champion!";
    if (streak === 100) return "Century milestone unlocked!";
    return "Milestone achieved!";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Habit Milestone Achieved</DialogTitle>
        <DialogDescription className="sr-only">
          You've reached a {streak}-day streak for {habitTitle}. Celebrate your achievement and share your success!
        </DialogDescription>
        <Tabs defaultValue="celebrate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="celebrate">Celebrate</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
          
          <TabsContent value="celebrate" className="space-y-6 py-6">
            <div className="text-center space-y-6">
              {/* Icon */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Trophy className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent animate-pulse" />
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {milestoneMessage()}
                  </h2>
                  <Sparkles className="h-5 w-5 text-accent animate-pulse" />
                </div>
                
                <div className="flex items-center justify-center gap-2 text-4xl font-bold">
                  <Flame className="h-8 w-8 text-orange-500" />
                  <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                    {streak}
                  </span>
                  <span className="text-muted-foreground text-2xl">day streak</span>
                </div>
                
                <p className="text-lg text-foreground font-medium">
                  {habitTitle}
                </p>
                
                {mentorName && (
                  <p className="text-sm text-muted-foreground italic">
                    {mentorName} is proud of you!
                  </p>
                )}
              </div>

              {/* Close Button */}
              <Button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                size="lg"
              >
                Keep Going! 🚀
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="share" className="py-6">
            <ShareableStreakBadge
              streak={streak}
              habitTitle={habitTitle}
              mentorName={mentorName}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
