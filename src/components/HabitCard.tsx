import { useCallback, memo } from "react";
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
import { useAuth } from "@/hooks/useAuth";

interface HabitCardProps {
  id: string;
  title: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  difficulty?: string;
  onComplete: () => void;
  onDelete?: (habitId: string) => void;
}

export const HabitCard = memo(({
  id,
  title,
  currentStreak,
  longestStreak,
  completedToday,
  difficulty = "medium",
  onComplete,
  onDelete,
}: HabitCardProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(id);
    }
  }, [id, onDelete]);
  const handleArchive = useCallback(async () => {
    if (!id) {
      toast.error("Invalid habit ID");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in to archive habits");
      return;
    }

    try {
      // Explicit user_id check for defense-in-depth (RLS also enforces this)
      const { error } = await supabase
        .from('habits')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Failed to archive habit:', error);
        toast.error("Failed to archive habit. Please try again.");
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success("Habit archived. Ready for a new one.");
    } catch (error) {
      console.error('Unexpected error archiving habit:', error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  }, [id, user?.id, queryClient]);

  const getStreakTier = useCallback(() => {
    if (currentStreak === 0) return { color: "text-muted-foreground", message: "Start your streak today", badge: null };
    if (currentStreak < 7) return { color: "text-muted-foreground", message: "Building momentum...", badge: null };
    if (currentStreak < 14) return { color: "text-streak-building", message: "Building momentum", badge: "Building" };
    if (currentStreak < 30) return { color: "text-celestial-blue", message: "Strong consistency", badge: "Strong" };
    if (currentStreak < 60) return { color: "text-streak-elite", message: "Elite level", badge: "Elite" };
    return { color: "text-stardust-gold", message: "Legendary streak", badge: "Legendary" };
  }, [currentStreak]);

  const getDifficultyConfig = useCallback(() => {
    switch (difficulty) {
      case 'easy':
        return { 
          icon: Zap, 
          label: "Easy",
          borderColor: "border-emerald-500/30",
          bgColor: "bg-emerald-500/5",
          textColor: "text-emerald-400",
          flameColor: "text-emerald-400"
        };
      case 'hard':
        return { 
          icon: Mountain, 
          label: "Hard",
          borderColor: "border-rose-500/30",
          bgColor: "bg-rose-500/5",
          textColor: "text-rose-400",
          flameColor: "text-rose-400"
        };
      default: // medium
        return { 
          icon: Flame, 
          label: "Medium",
          borderColor: "border-amber-500/30",
          bgColor: "bg-amber-500/5",
          textColor: "text-amber-400",
          flameColor: "text-amber-400"
        };
    }
  }, [difficulty]);

  const streakTier = getStreakTier();
  const difficultyConfig = getDifficultyConfig();
  const DifficultyIcon = difficultyConfig.icon;

  return (
    <Card 
      className={cn(
        "p-5 md:p-6 bg-gradient-to-br from-card via-card to-secondary/80 transition-all duration-500 relative overflow-hidden group animate-scale-in",
        difficultyConfig.borderColor,
        "hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
      )}
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
              <Badge 
                className={cn(
                  "text-xs border",
                  difficultyConfig.bgColor,
                  difficultyConfig.borderColor,
                  difficultyConfig.textColor
                )}
              >
                <DifficultyIcon className="h-3 w-3 mr-1" />
                {difficultyConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{streakTier.message}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
                  currentStreak > 0 
                    ? cn(difficultyConfig.bgColor, difficultyConfig.borderColor)
                    : "bg-secondary border-border"
                )}>
                  <Flame className={cn(
                    "w-6 h-6 flex-shrink-0",
                    currentStreak > 0 ? difficultyConfig.flameColor : "text-muted-foreground"
                  )} />
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-2xl font-heading font-black leading-none",
                      currentStreak > 0 ? streakTier.color : "text-muted-foreground"
                    )}>{currentStreak}</span>
                    <span className="text-xs text-muted-foreground">day streak</span>
                  </div>
                </div>
                {streakTier.badge && (
                  <Badge 
                    className={cn(
                      "text-xs font-semibold border",
                      streakTier.color
                    )}
                    variant="outline"
                  >
                    {streakTier.badge}
                  </Badge>
                )}
                {longestStreak > 0 && (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-stardust-gold">{longestStreak}</span>
                    <span className="text-xs text-celestial-blue">personal best</span>
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
              
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive/50 hover:text-destructive opacity-50 hover:opacity-100"
                      aria-label="Delete habit permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this habit permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{title}" and all its streak data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete Forever
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
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
