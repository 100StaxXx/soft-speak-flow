import { useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Star, ChevronDown, Clock, Calendar, Target, Pencil, Zap, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { EditHabitDialog } from "@/components/EditHabitDialog";

interface Habit {
  id: string;
  title: string;
  description?: string | null;
  difficulty: string;
  frequency?: string;
  estimated_minutes?: number | null;
  custom_days?: number[] | null;
  preferred_time?: string | null;
}

const formatFrequency = (freq: string): string => {
  switch (freq) {
    case 'daily': return 'Daily';
    case '5x_week': return '5x per week';
    case '3x_week': return '3x per week';
    case 'custom': return 'Custom';
    default: return freq;
  }
};

// Check if a habit is scheduled for today based on frequency and custom_days
const isScheduledForToday = (habit: Habit): boolean => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // Convert JS day (0=Sunday) to our system (0=Monday)
  const ourDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Daily habits are always scheduled
  if (habit.frequency === 'daily' || !habit.custom_days || habit.custom_days.length === 0) {
    return true;
  }
  
  // Custom frequency - check if today is in custom_days
  return habit.custom_days.includes(ourDayIndex);
};

// Get next scheduled day name for upcoming habits
const getNextScheduledDay = (days: number[]): string => {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
  
  // Find the next day after today
  const nextDay = days.find(d => d > currentDay) ?? days[0];
  return dayNames[nextDay];
};

interface EpicCheckInDrawerProps {
  epicId: string;
  habits: Habit[];
  isActive: boolean;
}

export const EpicCheckInDrawer = ({ epicId, habits, isActive }: EpicCheckInDrawerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [earlyBirdExpanded, setEarlyBirdExpanded] = useState(false);
  
  // Split habits into today's and upcoming
  const { todayHabits, upcomingHabits } = useMemo(() => {
    const todayList: Habit[] = [];
    const upcomingList: Habit[] = [];
    
    habits.forEach(habit => {
      if (isScheduledForToday(habit)) {
        todayList.push(habit);
      } else {
        upcomingList.push(habit);
      }
    });
    
    return { todayHabits: todayList, upcomingHabits: upcomingList };
  }, [habits]);

  const handleUpdateHabit = async (habitId: string, updates: {
    title: string;
    description: string | null;
    frequency: string;
    estimated_minutes: number | null;
    difficulty: string;
    preferred_time: string | null;
  }) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId)
      .eq('user_id', user.id);
    
    if (error) {
      toast.error('Failed to update habit');
      throw error;
    }
    
    toast.success('Habit updated!');
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['epics'] });
  };

  if (!isActive || habits.length === 0) return null;

  return (
    <Drawer 
      open={open} 
      onOpenChange={setOpen}
      shouldScaleBackground={false}
      handleOnly={true}
    >
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full relative overflow-hidden group",
            "bg-gradient-to-r from-primary/10 to-accent/10",
            "border-primary/30 hover:border-primary/60",
            "transition-all duration-300"
          )}
        >
          {/* Glowing effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity" />
          
          {/* Icon */}
          <BookOpen className="w-4 h-4 mr-2 text-primary" />
          
          <span className="relative z-10 font-medium">
            View Rituals
          </span>
          
          <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
            {todayHabits.length} today
          </span>
          
          <Star className="w-4 h-4 ml-2 text-accent" />
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="bg-background border-t border-primary/20">
        <div className="mx-auto w-full max-w-lg p-6">
          <DrawerHeader className="px-0 pb-4">
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <Star className="w-5 h-5 text-stardust-gold fill-stardust-gold/30" />
              Today's Cosmiq Habits
            </DrawerTitle>
          </DrawerHeader>
          
          <div
            className="space-y-3 overflow-y-auto overscroll-contain max-h-[60vh] -mx-2 px-2"
            data-vaul-no-drag
          >
            {/* Today's Habits */}
            {todayHabits.map((habit) => {
              const isExpanded = expandedHabit === habit.id;
              const hasDetails = habit.description || habit.frequency || habit.estimated_minutes || habit.preferred_time;
              
              return (
                <Collapsible
                  key={habit.id}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedHabit(open ? habit.id : null)}
                >
                  <div
                    className={cn(
                      "rounded-xl transition-colors overflow-hidden",
                      "bg-secondary/30 border border-border/50"
                    )}
                  >
                    {/* Main habit row */}
                    <div
                      className="flex items-center gap-3 p-4 min-h-[60px]"
                      style={{ 
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {/* Simple bullet indicator instead of checkbox */}
                      <div className="h-6 w-6 rounded-full border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary/50" />
                      </div>
                      <span className="flex-1 text-sm font-medium">
                        {habit.title}
                      </span>
                      {habit.preferred_time && (
                        <span className="text-xs text-celestial-blue/80 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {habit.preferred_time.slice(0, 5)}
                        </span>
                      )}
                      {hasDetails && (
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "h-10 w-10 -mr-2 flex items-center justify-center rounded-lg",
                              "active:bg-primary/20 transition-colors",
                              "touch-manipulation",
                              "relative z-10"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <ChevronDown 
                              className={cn(
                                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )} 
                            />
                          </button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                    
                    {/* Expandable details section */}
                    <CollapsibleContent>
                      <div 
                        className="px-4 pb-4 pt-0 space-y-2 border-t border-border/30"
                        data-vaul-no-drag
                      >
                        {habit.description && (
                          <p className="text-sm text-celestial-blue/80 pt-3">
                            {habit.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {habit.frequency && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5 text-celestial-blue" />
                              <span>{formatFrequency(habit.frequency)}</span>
                            </div>
                          )}
                          {habit.estimated_minutes && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5 text-celestial-blue" />
                              <span>~{habit.estimated_minutes} min</span>
                            </div>
                          )}
                          {habit.difficulty && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Target className="w-3.5 h-3.5 text-celestial-blue" />
                              <span className="capitalize">{habit.difficulty}</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 ml-auto text-xs text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingHabit(habit);
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {/* Early Bird Mode - Upcoming Habits */}
            {upcomingHabits.length > 0 && (
              <Collapsible 
                open={earlyBirdExpanded} 
                onOpenChange={setEarlyBirdExpanded}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-200">
                        Early Bird Mode
                      </span>
                      <span className="text-xs text-amber-500/70">
                        Preview upcoming
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {upcomingHabits.length} upcoming
                      </span>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-amber-500 transition-transform",
                        earlyBirdExpanded && "rotate-180"
                      )} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="mt-3 space-y-2 pl-2 border-l-2 border-amber-500/20">
                    <p className="text-xs text-amber-500/80 italic px-2 pb-2">
                      These habits are scheduled for later this week
                    </p>
                    
                    {upcomingHabits.map((habit) => {
                      const isExpanded = expandedHabit === habit.id;
                      const hasDetails = habit.description || habit.frequency || habit.estimated_minutes;
                      
                      return (
                        <Collapsible
                          key={habit.id}
                          open={isExpanded}
                          onOpenChange={(open) => setExpandedHabit(open ? habit.id : null)}
                        >
                          <div
                            className={cn(
                              "rounded-xl transition-colors overflow-hidden",
                              "bg-amber-500/5 border border-amber-500/20"
                            )}
                          >
                            {/* Main habit row */}
                            <div
                              className="flex items-center gap-3 p-4 min-h-[60px]"
                              style={{ 
                                touchAction: 'manipulation',
                                WebkitTapHighlightColor: 'transparent',
                              }}
                            >
                              {/* Simple bullet indicator */}
                              <div className="h-6 w-6 rounded-full border-2 border-amber-500/30 flex items-center justify-center flex-shrink-0">
                                <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                              </div>
                              <span className="flex-1 text-sm font-medium">
                                {habit.title}
                              </span>
                              {/* Day badge showing when scheduled */}
                              {habit.custom_days && habit.custom_days.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  {getNextScheduledDay(habit.custom_days)}
                                </span>
                              )}
                              {hasDetails && (
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "h-10 w-10 -mr-2 flex items-center justify-center rounded-lg",
                                      "active:bg-amber-500/20 transition-colors",
                                      "touch-manipulation",
                                      "relative z-10"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <ChevronDown 
                                      className={cn(
                                        "h-5 w-5 text-amber-500/70 transition-transform duration-200",
                                        isExpanded && "rotate-180"
                                      )} 
                                    />
                                  </button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                            
                            {/* Expandable details section */}
                            <CollapsibleContent>
                              <div 
                                className="px-4 pb-4 pt-0 space-y-2 border-t border-amber-500/20"
                                data-vaul-no-drag
                              >
                                {habit.description && (
                                  <p className="text-sm text-amber-500/70 pt-3">
                                    {habit.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                  {habit.frequency && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                      <span>{formatFrequency(habit.frequency)}</span>
                                    </div>
                                  )}
                                  {habit.estimated_minutes && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                                      <span>~{habit.estimated_minutes} min</span>
                                    </div>
                                  )}
                                  {habit.difficulty && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Target className="w-3.5 h-3.5 text-amber-500" />
                                      <span className="capitalize">{habit.difficulty}</span>
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 ml-auto text-xs text-amber-500/70 hover:text-amber-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingHabit(habit);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
          
          {/* Guidance note */}
          <p className="text-center text-xs text-muted-foreground pt-4 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Mark rituals complete in Today's Agenda
          </p>
          
          {todayHabits.length === 0 && upcomingHabits.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No habits scheduled for today. Check the Early Bird section to preview upcoming habits!
            </p>
          )}
        </div>
        
        <EditHabitDialog
          habit={editingHabit}
          open={!!editingHabit}
          onOpenChange={(open) => !open && setEditingHabit(null)}
          onSave={handleUpdateHabit}
        />
      </DrawerContent>
    </Drawer>
  );
};
