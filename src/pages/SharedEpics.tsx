import { PageTransition } from "@/components/PageTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";
import { Share2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  ACTIVE_CAMPAIGN_LIMIT_MESSAGE,
  hasReachedActiveCampaignLimit,
  isActiveCampaignLimitHaystack,
} from "@/features/epics/constants";

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
            habit:habits(id, title, difficulty, frequency, custom_days, custom_month_days)
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
      
      if (hasReachedActiveCampaignLimit(totalActiveEpics)) {
        throw new Error(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
      }

      // Fetch the epic with habits
      const { data: epic, error: fetchError } = await supabase
        .from('epics')
        .select(`
          *,
          epic_habits(
            habit:habits(id, title, difficulty, frequency, custom_days, custom_month_days)
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

      if (!epic.invite_code) {
        throw new Error('This epic is missing an invite code');
      }

      const { data: joinResultRows, error: joinError } = await supabase.rpc('join_epic_by_invite_code', {
        p_invite_code: epic.invite_code,
      });

      if (joinError) throw joinError;

      const joinResult = joinResultRows?.[0];
      if (!joinResult?.success) {
        throw new Error(joinResult?.message || 'Failed to join epic');
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
      navigate('/campaigns');
    },
    onError: (error: Error) => {
      toast.error(isActiveCampaignLimitHaystack(error.message.toLowerCase()) ? ACTIVE_CAMPAIGN_LIMIT_MESSAGE : error.message);
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
    </PageTransition>
  );
}
