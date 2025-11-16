import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
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
  const [challenge, setChallenge] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  useEffect(() => {
    loadChallenge();
    loadActiveChallenge();
  }, [id, user]);

  const loadChallenge = async () => {
    if (!id) return;

    const { data: challengeData } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", id)
      .single();

    const { data: tasksData } = await supabase
      .from("challenge_tasks")
      .select("*")
      .eq("challenge_id", id)
      .order("day_number");

    setChallenge(challengeData);
    setTasks(tasksData || []);
    setIsLoading(false);
  };

  const loadActiveChallenge = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    setActiveChallenge(data);
  };

  const handleStartChallenge = async () => {
    if (!user || !challenge) return;

    if (activeChallenge && activeChallenge.challenge_id !== challenge.id) {
      setShowReplaceDialog(true);
      return;
    }

    await startChallenge();
  };

  const startChallenge = async () => {
    if (!user || !challenge) return;
    
    setIsStarting(true);

    try {
      // End current active challenge if exists
      if (activeChallenge) {
        await supabase
          .from("user_challenges")
          .update({ status: "ended" })
          .eq("id", activeChallenge.id);
      }

      // Create new user challenge
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + challenge.total_days);

      const { error } = await supabase
        .from("user_challenges")
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          start_date: today,
          end_date: endDate.toISOString().split('T')[0],
          current_day: 1,
          status: "active"
        });

      if (error) throw error;

      toast.success("Challenge started!");
      navigate("/challenges");
    } catch (error: any) {
      console.error("Error starting challenge:", error);
      toast.error("Failed to start challenge");
    } finally {
      setIsStarting(false);
      setShowReplaceDialog(false);
    }
  };

  if (isLoading || !challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/challenges")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-heading">{challenge.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="capitalize">
            {challenge.category}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{challenge.total_days} Days</span>
          </div>
        </div>

        <Card className="p-6">
          <p className="text-foreground/90 leading-relaxed">{challenge.description}</p>
        </Card>

        <div>
          <h2 className="text-xl font-heading mb-4">Daily Tasks Preview</h2>
          <div className="space-y-3">
            {tasks.slice(0, 3).map((task) => (
              <Card key={task.id} className="p-4">
                <h3 className="font-medium mb-1">Day {task.day_number}: {task.task_title}</h3>
                <p className="text-sm text-muted-foreground">{task.task_description}</p>
              </Card>
            ))}
            {tasks.length > 3 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                + {tasks.length - 3} more days...
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={handleStartChallenge}
          disabled={isStarting}
          className="w-full"
          size="lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            "Begin Challenge"
          )}
        </Button>
      </div>

      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Replace Active Challenge?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Starting this challenge will replace your current active challenge. Your progress on the current challenge will be saved but marked as ended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startChallenge}>
              Start New Challenge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}