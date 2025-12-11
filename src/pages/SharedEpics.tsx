import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument } from "@/lib/firebase/firestore";
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
    queryFn: async (): Promise<any[]> => {
      // Fetch public active epics
      const epics = await getDocuments(
        'epics',
        [
          ['is_public', '==', true],
          ['status', '==', 'active'],
        ],
        'created_at',
        'desc'
      );

      // For each epic, fetch its habits
      const epicsWithHabits = await Promise.all(
        epics.map(async (epic) => {
          // Fetch epic_habits for this epic
          const epicHabits = await getDocuments(
            'epic_habits',
            [['epic_id', '==', epic.id]]
          );

          // Fetch habit details for each epic_habit
          const habits = await Promise.all(
            epicHabits.map(async (eh) => {
              const habit = await getDocument('habits', eh.habit_id);
              return {
                ...eh,
                habit: habit ? {
                  id: habit.id,
                  title: habit.title,
                  difficulty: habit.difficulty,
                  frequency: habit.frequency,
                  custom_days: habit.custom_days,
                } : null,
              };
            })
          );

          return {
            ...epic,
            epic_habits: habits.filter(h => h.habit !== null),
          };
        })
      );

      return epicsWithHabits;
    }
  });

  const joinEpic = useMutation({
    mutationFn: async (epicId: string) => {
      if (!user?.uid) throw new Error('Not authenticated');

      // Check epic limit (owned + joined)
      const ownedEpics = await getDocuments(
        'epics',
        [
          ['user_id', '==', user.uid],
          ['status', '==', 'active'],
        ]
      );
      
      // Fetch joined epics (where user is a member but not the owner)
      const allMemberships = await getDocuments(
        'epic_members',
        [['user_id', '==', user.uid]]
      );
      
      // Filter to only active epics where user is not the owner
      const joinedEpicIds = await Promise.all(
        allMemberships.map(async (membership) => {
          const epic = await getDocument('epics', membership.epic_id);
          if (epic && epic.status === 'active' && epic.user_id !== user.uid) {
            return membership.epic_id;
          }
          return null;
        })
      );
      const joinedEpics = joinedEpicIds.filter(id => id !== null);

      const totalActiveEpics = ownedEpics.length + joinedEpics.length;
      
      if (totalActiveEpics >= MAX_EPICS) {
        throw new Error(`You can only have ${MAX_EPICS} active epics at a time. Complete or abandon an epic to join a new one.`);
      }

      // Fetch the epic
      const epic = await getDocument('epics', epicId);
      if (!epic || !epic.is_public) throw new Error('Epic not found');

      // Fetch epic habits
      const epicHabits = await getDocuments(
        'epic_habits',
        [['epic_id', '==', epicId]]
      );

      // Fetch habit details
      const habits = await Promise.all(
        epicHabits.map(async (eh) => {
          const habit = await getDocument('habits', eh.habit_id);
          return habit ? {
            id: habit.id,
            title: habit.title,
            difficulty: habit.difficulty,
            frequency: habit.frequency,
            custom_days: habit.custom_days,
          } : null;
        })
      );

      const epicWithHabits = {
        ...epic,
        epic_habits: habits.filter(h => h !== null).map(h => ({ habit: h })),
      };

      // Check if already a member
      const existingMemberships = await getDocuments(
        'epic_members',
        [
          ['epic_id', '==', epicId],
          ['user_id', '==', user.uid],
        ]
      );

      if (existingMemberships.length > 0) {
        throw new Error("You're already part of this guild!");
      }

      // Join the epic as a member (not create a copy!)
      const memberId = `${epicId}_${user.uid}`;
      await setDocument('epic_members', memberId, {
        id: memberId,
        epic_id: epicId,
        user_id: user.uid,
      }, false);

      // Copy habits to user's account and link to the ORIGINAL epic
      if (epicWithHabits.epic_habits && epicWithHabits.epic_habits.length > 0) {
        const { batchWrite } = await import("@/lib/firebase/firestore");
        const operations: Array<{ type: "set"; collection: string; docId: string; data: any }> = [];

        for (const eh of epicWithHabits.epic_habits) {
          const habitId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          operations.push({
            type: "set",
            collection: "habits",
            docId: habitId,
            data: {
              id: habitId,
              user_id: user.uid,
              title: eh.habit.title,
              difficulty: eh.habit.difficulty,
              frequency: eh.habit.frequency || 'daily',
              custom_days: eh.habit.custom_days || null,
            },
          });

          // Link new habit to the ORIGINAL epic (not a copy)
          const linkId = `${epicId}_${habitId}`;
          operations.push({
            type: "set",
            collection: "epic_habits",
            docId: linkId,
            data: {
              id: linkId,
              epic_id: epicId,
              habit_id: habitId,
            },
          });
        }

        await batchWrite(operations);
      }

      return epicWithHabits;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['public-epics'] });
      toast.success('Guild joined! 🎯', {
        description: "You're now part of this guild and can compete on the leaderboard!"
      });
      navigate('/tasks');
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