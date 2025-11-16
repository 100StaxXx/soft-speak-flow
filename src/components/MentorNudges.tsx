import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
    queryKey: ['mentor-nudges', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('mentor_nudges')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('delivered_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute
  });

  const dismissNudge = async (nudgeId: string) => {
    setDismissedNudges(prev => [...prev, nudgeId]);
    
    await supabase
      .from('mentor_nudges')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId);
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
                    onClick={() => dismissNudge(nudge.id)}
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
