import { useState } from "react";
import { haptics } from "@/utils/haptics";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { useXPRewards } from "@/hooks/useXPRewards";
import { ContextualText } from "@/components/ContextualText";
import { EmptyState } from "@/components/EmptyState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { HabitCard } from "@/components/HabitCard";
import { HabitTemplates } from "@/components/HabitTemplates";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { BrandTagline } from "@/components/BrandTagline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, ArrowLeft, Flame, X, Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { MilestoneModal } from "@/components/MilestoneModal";

export default function Habits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityFeed();
  const personality = useMentorPersonality();
  const { awardCustomXP, awardAllHabitsComplete, XP_REWARDS } = useXPRewards();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; streak: number; title: string } | null>(null);

  const { data: habits = [] } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', today);
      return data || [];
    },
    enabled: !!user,
  });

  const addHabitMutation = useMutation({
    mutationFn: async () => {
      if (habits.length >= 5) {
        throw new Error('Maximum 5 habits allowed');
      }
      
      const { error } = await supabase.from('habits').insert({
        user_id: user!.id,
        title: newHabitTitle,
        frequency: selectedDays.length === 7 ? 'daily' : 'custom',
        custom_days: selectedDays.length === 7 ? null : selectedDays,
        difficulty: habitDifficulty,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setNewHabitTitle("");
      setHabitDifficulty("medium");
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setShowAddForm(false);
      setShowTemplates(true);
    },
    onError: (error: any) => {
      toast({ title: 'Could not create habit', description: error.message || 'Please try again.', variant: 'destructive' });
    },
  });

  const handleTemplateSelect = (title: string, frequency: string) => {
    setNewHabitTitle(title);
    setShowTemplates(false);
  };

  const handleCustomHabit = () => {
    setShowTemplates(false);
  };

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      haptics.medium();
      const habit = habits.find(h => h.id === habitId);
      
      const { error } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: user!.id,
        date: new Date().toISOString().split('T')[0],
      });
      
      if (error) throw error;
      
      // Award XP based on habit difficulty
      const difficultyXP = {
        easy: 5,
        medium: 10,
        hard: 20,
      };
      const xpAmount = difficultyXP[habit?.difficulty || 'medium'];
      await awardCustomXP(xpAmount, 'habit_complete');
      
      // Log to activity feed
      if (habit) {
        logActivity({
          type: 'habit_completed',
          data: { 
            habit_id: habitId,
            habit_title: habit.title 
          }
        });
      }
    },
    onSuccess: async (_, habitId) => {
      await queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      
      // Check if all habits are complete
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysCompletions } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user!.id)
        .eq('date', today);
      
      if (todaysCompletions && todaysCompletions.length === habits.length && habits.length > 0) {
        awardAllHabitsComplete();
        toast({
          title: "🎉 All Habits Complete!",
          description: "Bonus XP awarded! Your companion is growing stronger!"
        });
      }
      
      // Check for milestone
      const { data: updatedHabit } = await supabase
        .from('habits')
        .select('current_streak, title')
        .eq('id', habitId)
        .single();
      
      if (updatedHabit && [3, 7, 14, 30, 100].includes(updatedHabit.current_streak)) {
        haptics.success();
        setMilestoneModal({
          open: true,
          streak: updatedHabit.current_streak,
          title: updatedHabit.title
        });
      }
    },
    onError: (error) => {
      haptics.error();
      toast({ 
        title: "Error", 
        description: "Failed to complete habit. Please try again.",
        variant: "destructive"
      });
      console.error('Error completing habit:', error);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6">
          <p className="text-foreground">Please sign in to track habits.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-5 md:space-y-6">
        <div className="flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-heading font-black text-foreground">Habit Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">Build discipline, one day at a time</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">Track up to 5 habits - earn XP daily</p>
          </div>
        </div>

        <BrandTagline />

        <div className="space-y-4">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              id={habit.id}
              title={habit.title}
              currentStreak={habit.current_streak}
              longestStreak={habit.longest_streak}
              completedToday={completions.some(c => c.habit_id === habit.id)}
              difficulty={habit.difficulty}
              onComplete={() => completeHabitMutation.mutate(habit.id)}
            />
          ))}
        </div>

        {habits.length === 0 && !showAddForm && (
          <Card className="p-8 md:p-12 text-center bg-secondary/30 border-dashed">
            <Flame className="w-16 h-16 mx-auto text-primary mb-4 opacity-50" />
            <h3 className="text-xl font-heading font-black text-foreground mb-2">No Habits Yet</h3>
            <p className="text-muted-foreground mb-6">
              <ContextualText type="empty" context="tracking your habits" fallback="Build habits, earn XP, evolve your companion!" />
            </p>
          </Card>
        )}

        {/* Add Habit Button */}
        {habits.length < 5 && !showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="cta"
            className="w-full h-12 md:h-14 text-sm md:text-base font-bold"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Habit ({habits.length}/5)
          </Button>
        )}

        {/* Max Habits Reached */}
        {habits.length === 5 && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary border-primary/30">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Target className="w-6 h-6 text-primary" />
                <h3 className="font-heading font-bold text-foreground">5 habits tracked</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                You're building momentum. Archive a habit to add a new one.
              </p>
            </div>
          </Card>
        )}

        {showAddForm && (
          <Card className="p-4 md:p-6 bg-card/80 backdrop-blur border-primary/20 space-y-5">
            {showTemplates ? (
              <>
                <HabitTemplates 
                  onSelect={handleTemplateSelect}
                  onCustom={handleCustomHabit}
                />
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false);
                    setShowTemplates(true);
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-bold text-foreground">
                    Custom Habit
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowTemplates(true);
                      setNewHabitTitle("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Enter habit name"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  className="bg-background/50"
                  maxLength={100}
                  autoFocus
                />
                <FrequencyPicker 
                  selectedDays={selectedDays}
                  onDaysChange={setSelectedDays}
                />
                <HabitDifficultySelector
                  value={habitDifficulty}
                  onChange={setHabitDifficulty}
                />
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => addHabitMutation.mutate()} 
                    disabled={!newHabitTitle.trim() || selectedDays.length === 0 || addHabitMutation.isPending}
                    className="flex-1"
                  >
                    {addHabitMutation.isPending ? 'Creating...' : 'Add Habit'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      setShowTemplates(true);
                      setNewHabitTitle("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
      
      {/* Milestone Modal */}
      {milestoneModal && (
        <MilestoneModal
          open={milestoneModal.open}
          onClose={() => setMilestoneModal(null)}
          streak={milestoneModal.streak}
          habitTitle={milestoneModal.title}
          mentorName={personality?.name}
        />
      )}
      
      <BottomNav />
    </div>
  );
}
