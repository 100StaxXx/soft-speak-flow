import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, CheckCircle, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: userChallenge, refetch: refetchUserChallenge } = useQuery({
    queryKey: ['userChallenge', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenge:challenges(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: currentTask } = useQuery({
    queryKey: ['currentTask', userChallenge?.challenge_id, userChallenge?.current_day],
    queryFn: async () => {
      if (!userChallenge) return null;
      const { data } = await supabase
        .from('challenge_tasks')
        .select('*')
        .eq('challenge_id', userChallenge.challenge_id)
        .eq('day_number', userChallenge.current_day)
        .maybeSingle();
      return data;
    },
    enabled: !!userChallenge,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleCompleteDay = async () => {
    if (!userChallenge || !user) return;

    const challenge = userChallenge.challenge as any;
    const nextDay = userChallenge.current_day + 1;

    if (nextDay > challenge.total_days) {
      // Complete challenge
      await supabase
        .from('user_challenges')
        .update({ status: 'completed' })
        .eq('id', userChallenge.id);

      toast.success("🎉 Challenge completed! Amazing work!");
      refetchUserChallenge();
    } else {
      // Move to next day
      await supabase
        .from('user_challenges')
        .update({ current_day: nextDay })
        .eq('id', userChallenge.id);

      toast.success(`Day ${userChallenge.current_day} complete! Moving to Day ${nextDay}`);
      refetchUserChallenge();
    }
  };

  const featuredChallenges = challenges.slice(0, 6);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading">Challenges</h1>
        </div>

        {/* Current Active Challenge */}
        {userChallenge && userChallenge.status === 'active' && (
          <section>
            <h2 className="text-2xl font-heading mb-4">Your Current Challenge</h2>
            <Card className="p-6 space-y-4 border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-heading">{(userChallenge.challenge as any).title}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Day {userChallenge.current_day} of {(userChallenge.challenge as any).total_days}</span>
                  </div>
                </div>
                <Badge className="capitalize">{(userChallenge.challenge as any).category}</Badge>
              </div>

              {currentTask && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">{currentTask.task_title}</h4>
                  <p className="text-muted-foreground">{currentTask.task_description}</p>
                </div>
              )}

              <Button onClick={handleCompleteDay} className="w-full">
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Day {userChallenge.current_day}
              </Button>
            </Card>
          </section>
        )}

        {/* Featured Challenges */}
        <section>
          <h2 className="text-2xl font-heading mb-4">Featured Challenges</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featuredChallenges.length === 0 ? (
              <Card className="p-12 text-center col-span-2">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No challenges available yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Check back soon for new challenges.</p>
              </Card>
            ) : (
              featuredChallenges.map((challenge) => (
                <Card 
                  key={challenge.id} 
                  className="p-6 hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/challenge/${challenge.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-heading">{challenge.title}</h3>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {challenge.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {challenge.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{challenge.total_days} Days</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Browse All */}
        {challenges.length > 6 && (
          <section>
            <h2 className="text-2xl font-heading mb-4">More Challenges</h2>
            <div className="space-y-3">
              {challenges.slice(6).map((challenge) => (
                <Card 
                  key={challenge.id}
                  className="p-4 hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/challenge/${challenge.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{challenge.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {challenge.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {challenge.category}
                      </Badge>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {challenge.total_days} days
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
