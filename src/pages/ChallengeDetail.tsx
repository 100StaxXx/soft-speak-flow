import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [challenge, setChallenge] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadChallenge();
      checkActiveChallenge();
    }
  }, [user, id]);

  const loadChallenge = async () => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setChallenge(data);

      const { data: tasksData, error: tasksError } = await supabase
        .from('challenge_tasks')
        .select('*')
        .eq('challenge_id', id)
        .order('day_number');

      if (tasksError) throw tasksError;
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkActiveChallenge = async () => {
    try {
      const { data } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      setHasActiveChallenge(!!data);
    } catch (error) {
      console.error('Error checking active challenge:', error);
    }
  };

  const handleBeginChallenge = async () => {
    if (!user || !challenge) return;

    try {
      // If they have an active challenge, mark it as completed
      if (hasActiveChallenge) {
        await supabase
          .from('user_challenges')
          .update({ status: 'completed' })
          .eq('user_id', user.id)
          .eq('status', 'active');
      }

      // Create new user challenge
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + challenge.total_days);

      const { error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          start_date: today,
          end_date: endDate.toISOString().split('T')[0],
          current_day: 1,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Challenge started!",
        description: `Let's begin Day 1 of ${challenge.total_days}`,
      });

      navigate('/challenges');
    } catch (error: any) {
      console.error('Error starting challenge:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const initiateBegin = () => {
    if (hasActiveChallenge) {
      setShowReplaceDialog(true);
    } else {
      handleBeginChallenge();
    }
  };

  if (isLoading || !challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/challenges')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-heading text-foreground">{challenge.title}</h1>
        </div>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-primary" />
            <Badge variant="secondary" className="capitalize">
              {challenge.category}
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{challenge.total_days} Days</span>
            </div>
          </div>

          <p className="text-foreground leading-relaxed">{challenge.description}</p>

          <div className="space-y-3">
            <h3 className="font-heading text-lg text-foreground">Daily Tasks Preview</h3>
            {tasks.slice(0, 3).map((task) => (
              <div key={task.id} className="border-l-2 border-primary pl-4 py-2">
                <div className="text-sm text-muted-foreground">Day {task.day_number}</div>
                <div className="font-medium text-foreground">{task.task_title}</div>
              </div>
            ))}
            {tasks.length > 3 && (
              <div className="text-sm text-muted-foreground italic">
                + {tasks.length - 3} more days...
              </div>
            )}
          </div>

          <Button onClick={initiateBegin} className="w-full" size="lg">
            Begin Challenge
          </Button>
        </Card>
      </div>

      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Active Challenge?</AlertDialogTitle>
            <AlertDialogDescription>
              Starting this will mark your current active challenge as completed. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBeginChallenge}>
              Yes, Start New Challenge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}