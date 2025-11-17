import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle2, Flame, Trash2, Archive } from "lucide-react";
import { EnhancedShareButton } from "./EnhancedShareButton";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface HabitCardProps {
  id: string;
  title: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  onComplete: () => void;
}

export const HabitCard = ({
  id,
  title,
  currentStreak,
  longestStreak,
  completedToday,
  onComplete,
}: HabitCardProps) => {
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);

  const handleArchive = async () => {
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);
    
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success("Habit archived. Ready for a new one.");
    }
  };

  const getStreakMessage = () => {
    if (currentStreak === 0) return "Start your streak today";
    if (currentStreak === 1) return "Day 1. Keep going.";
    if (currentStreak < 7) return "Building momentum...";
    if (currentStreak < 21) return "Habit forming...";
    if (currentStreak < 66) return "Almost automatic...";
    return "Discipline locked in.";
  };

  return (
    <Card className="p-5 md:p-6 bg-gradient-to-br from-card to-secondary border-primary/20 hover:border-primary/40 transition-all hover:shadow-glow relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-heading font-black text-foreground mb-1 break-words">{title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{getStreakMessage()}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
                  currentStreak > 0 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-secondary border-border"
                )}>
                  <Flame className={cn(
                    "w-6 h-6 flex-shrink-0",
                    currentStreak > 0 ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-2xl font-heading font-black leading-none",
                      currentStreak > 0 ? "text-primary" : "text-muted-foreground"
                    )}>{currentStreak}</span>
                    <span className="text-xs text-muted-foreground">day streak</span>
                  </div>
                </div>
                {longestStreak > 0 && (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{longestStreak}</span>
                    <span className="text-xs text-muted-foreground">personal best</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={onComplete}
              disabled={completedToday}
              size="icon"
              variant={completedToday ? "secondary" : "default"}
              className={cn(
                "h-12 w-12 rounded-full flex-shrink-0 transition-all",
                completedToday && "bg-primary/20 text-primary hover:bg-primary/30"
              )}
            >
              <CheckCircle2 className="w-6 h-6" />
            </Button>
            
            <div className="flex gap-1">
              <EnhancedShareButton
                title={`${currentStreak} Day Streak!`}
                text={`I've maintained a ${currentStreak}-day streak on "${title}"! 🔥 Building better habits every day.`}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100"
              />
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive this habit?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will archive "{title}" and free up a slot for a new habit. Your streak data will be preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
        
        {completedToday && (
          <div className="p-3 md:p-4 bg-primary/10 rounded-lg border border-primary/20 animate-velocity-fade-in">
            <p className="text-xs md:text-sm text-primary font-bold">
              ✓ Completed today. Consistency is power.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
