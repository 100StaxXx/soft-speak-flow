import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HabitCard } from "@/components/HabitCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export default function Habits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitFrequency, setNewHabitFrequency] = useState("daily");

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
      if (habits.length >= 2) {
        throw new Error('Maximum 2 habits allowed');
      }
      
      const { error } = await supabase.from('habits').insert({
        user_id: user!.id,
        title: newHabitTitle,
        frequency: newHabitFrequency,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setNewHabitTitle("");
      setShowAddForm(false);
      toast({ title: "Habit added", description: "Lock in and stay consistent." });
    },
  });

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: user!.id,
        date: new Date().toISOString().split('T')[0],
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast({ title: "Habit completed", description: "Keep the streak alive." });
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
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Habit Tracker</h1>
        </div>

        <div className="space-y-4">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              id={habit.id}
              title={habit.title}
              currentStreak={habit.current_streak}
              longestStreak={habit.longest_streak}
              completedToday={completions.some(c => c.habit_id === habit.id)}
              onComplete={() => completeHabitMutation.mutate(habit.id)}
            />
          ))}
        </div>

        {habits.length < 2 && !showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Habit
          </Button>
        )}

        {showAddForm && (
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-heading">New Habit</h3>
            <Input
              placeholder="e.g., Morning workout"
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
            />
            <Select value={newHabitFrequency} onValueChange={setNewHabitFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="5x_week">5x per week</SelectItem>
                <SelectItem value="3x_week">3x per week</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                onClick={() => addHabitMutation.mutate()}
                disabled={!newHabitTitle.trim()}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setNewHabitTitle("");
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
