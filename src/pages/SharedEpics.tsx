import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Share2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const MAX_EPICS = 2;

export default function SharedEpics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: publicEpics, isLoading } = useQuery({
    queryKey: ['public-epics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epics')
        .select(`
          *,
          epic_habits(
            habit:habits(id, title, difficulty, frequency, custom_days)
          )
        `)
        .eq('is_public', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const joinEpic = useMutation({
    mutationFn: async (epicId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check epic limit (owned + joined)
      const { data: ownedEpics } = await supabase
        .from('epics')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      const { data: joinedEpics } = await supabase
        .from('epic_members')
        .select('epic_id, epics!inner(user_id, status)')
        .eq('user_id', user.id)
        .neq('epics.user_id', user.id)
        .eq('epics.status', 'active');

      const totalActiveEpics = (ownedEpics?.length || 0) + (joinedEpics?.length || 0);
      
      if (totalActiveEpics >= MAX_EPICS) {
        throw new Error(`You can only have ${MAX_EPICS} active epics at a time. Complete or abandon an epic to join a new one.`);
      }

      // Fetch the epic with habits
      const { data: epic, error: fetchError } = await supabase
        .from('epics')
        .select(`
          *,
          epic_habits(
            habit:habits(id, title, difficulty, frequency, custom_days)
          )
        `)
        .eq('id', epicId)
        .eq('is_public', true)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!epic) throw new Error('Epic not found');

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('epic_members')
        .select('id')
        .eq('epic_id', epicId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error("You're already part of this guild!");
      }

      // Join the epic as a member (not create a copy!)
      const { error: memberError } = await supabase
        .from('epic_members')
        .insert({
          epic_id: epicId,
          user_id: user.id,
        });

      if (memberError) throw memberError;

      // Copy habits to user's account and link to the ORIGINAL epic
      if (epic.epic_habits && epic.epic_habits.length > 0) {
        const habitsToCreate = epic.epic_habits.map((eh: { habit: { title: string; difficulty: string; frequency?: string; custom_days?: number[] | null } }) => ({
          user_id: user.id,
          title: eh.habit.title,
          difficulty: eh.habit.difficulty,
          frequency: eh.habit.frequency || 'daily',
          custom_days: eh.habit.custom_days || null,
        }));

        const { data: newHabits, error: habitsError } = await supabase
          .from('habits')
          .insert(habitsToCreate)
          .select();

        if (habitsError) throw habitsError;

        // Link new habits to the ORIGINAL epic (not a copy)
        if (newHabits && newHabits.length > 0) {
          const habitLinks = newHabits.map((habit: { id: string }) => ({
            epic_id: epicId,
            habit_id: habit.id,
          }));

          const { error: linkError } = await supabase
            .from('epic_habits')
            .insert(habitLinks);

          if (linkError) throw linkError;
        }
      }

      return epic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['public-epics'] });
      toast.success('Guild joined! 🎯', {
        description: "You're now part of this guild and can compete on the leaderboard!"
      });
      navigate('/journeys');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  return (
    <PageTransition>
      <div className="min-h-screen pb-nav-safe pt-safe px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Share2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Community Epics</h1>
              <p className="text-muted-foreground">Join shared goals from the community</p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">Loading community epics...</div>
          ) : !publicEpics || publicEpics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No public epics yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {publicEpics.map((epic) => (
                <Card key={epic.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{epic.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {epic.description}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {epic.target_days} days
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {epic.epic_habits?.length || 0} habits included
                      </div>
                      <Button
                        onClick={() => joinEpic.mutate(epic.id)}
                        disabled={joinEpic.isPending}
                        size="sm"
                      >
                        {joinEpic.isPending ? 'Joining...' : 'Join Guild'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
}