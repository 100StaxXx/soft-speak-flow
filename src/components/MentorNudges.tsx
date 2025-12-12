import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getMentorNudges, dismissNudge } from "@/lib/firebase/mentorNudges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, Target, Calendar } from "lucide-react";
import { useState } from "react";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

export const MentorNudges = () => {
  const { user } = useAuth();
  const personality = useMentorPersonality();
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([]);

  const { data: nudges = [] } = useQuery({
    queryKey: ['mentor-nudges', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      return await getMentorNudges(user.uid, 3);
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute
  });

  const handleDismissNudge = async (nudgeId: string) => {
    setDismissedNudges(prev => [...prev, nudgeId]);
    await dismissNudge(nudgeId);
  };

  const activeNudges = nudges.filter(n => !dismissedNudges.includes(n.id));

  if (!activeNudges.length || !personality) return null;

  const nudgeIcons: Record<string, any> = {
    habit_reminder: Target,
    check_in: Calendar,
    encouragement: AlertCircle,
    challenge: AlertCircle,
  };

  return (
    <div className="space-y-3">
      {activeNudges.map((nudge) => {
        const Icon = nudgeIcons[nudge.nudge_type] || AlertCircle;
        
        return (
          <Card key={nudge.id} className="p-4 bg-primary/5 border-primary/20 animate-fade-in">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {personality.name} says:
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mt-1"
                    onClick={() => handleDismissNudge(nudge.id)}
                    aria-label="Dismiss nudge"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground italic">
                  "{nudge.message}"
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
