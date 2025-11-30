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

export default function SharedEpics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: publicEpics, isLoading } = useQuery({
    queryKey: ['public-epics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epics')
        .select(`
          *,
          epic_habits(
            habit:habits(*)
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

      const { data: originalEpic, error: fetchError } = await supabase
        .from('epics')
        .select(`
          *,
          epic_habits(
            habit:habits(*)
          )
        `)
        .eq('id', epicId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!originalEpic) throw new Error('Epic not found');

      // Create copy for user
      const { data: newEpic, error: epicError } = await supabase
        .from('epics')
        .insert({
          user_id: user.id,
          title: originalEpic.title,
          description: originalEpic.description,
          target_days: originalEpic.target_days,
          status: 'active',
          is_public: false
        })
        .select()
        .single();

      if (epicError) throw epicError;

      // Copy habits
      if (originalEpic.epic_habits && originalEpic.epic_habits.length > 0) {
        for (const epicHabit of originalEpic.epic_habits) {
          const { data: newHabit } = await supabase
            .from('habits')
            .insert({
              user_id: user.id,
              title: epicHabit.habit.title,
              frequency: epicHabit.habit.frequency,
              difficulty: epicHabit.habit.difficulty,
              custom_days: epicHabit.habit.custom_days
            })
            .select()
            .single();

          if (newHabit) {
            await supabase
              .from('epic_habits')
              .insert({
                epic_id: newEpic.id,
                habit_id: newHabit.id
              });
          }
        }
      }

      return newEpic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      toast.success('Epic joined!', {
        description: 'This epic has been added to your journey'
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  return (
    <PageTransition>
      <div className="min-h-screen pb-20 pt-6 px-4">
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
                        Join Epic
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