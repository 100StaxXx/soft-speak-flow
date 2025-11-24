import { useState, useCallback, memo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CheckCircle2, Flame, Trash2, Archive, Zap, Mountain } from "lucide-react";
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
  difficulty?: string;
  onComplete: () => void;
}

export const HabitCard = memo(({
  id,
  title,
  currentStreak,
  longestStreak,
  completedToday,
  difficulty = "medium",
  onComplete,
}: HabitCardProps) => {
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);

  const handleArchive = useCallback(async () => {
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);
    
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success("Habit archived. Ready for a new one.");
    }
  }, [id, queryClient]);

  const getStreakMessage = useCallback(() => {
    if (currentStreak === 0) return "Start your streak today";
    if (currentStreak === 1) return "Day 1. Keep going.";
    if (currentStreak < 7) return "Building momentum...";
    if (currentStreak < 21) return "Habit forming...";
    if (currentStreak < 66) return "Almost automatic...";
    return "Discipline locked in.";
  }, [currentStreak]);

  return (
    <Card 
      className="p-5 md:p-6 bg-gradient-to-br from-card via-card to-secondary/80 border-primary/30 hover:border-primary/60 transition-all duration-500 hover:shadow-glow-lg relative overflow-hidden group animate-scale-in"
      role="article"
      aria-label={`Habit: ${title}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-accent/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-all duration-500" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.1),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg md:text-xl font-heading font-black text-foreground break-words">{title}</h3>
              <Badge variant="secondary" className="text-xs">
                {difficulty === 'easy' && <><Zap className="h-3 w-3 mr-1" /> Easy</>}
                {difficulty === 'medium' && <><Flame className="h-3 w-3 mr-1" /> Medium</>}
                {difficulty === 'hard' && <><Mountain className="h-3 w-3 mr-1" /> Hard</>}
              </Badge>
            </div>
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
                "h-12 w-12 rounded-full flex-shrink-0 transition-all duration-300 hover-scale",
                completedToday && "bg-primary/20 text-primary hover:bg-primary/30"
              )}
              aria-label={completedToday ? `${title} completed for today` : `Mark ${title} as complete`}
            >
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
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
                    aria-label="Archive habit"
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
});
