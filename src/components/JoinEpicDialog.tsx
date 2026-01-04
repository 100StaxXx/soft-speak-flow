import { memo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getHabitLimitForTier } from "@/config/habitLimits";

interface JoinEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JoinEpicDialog = memo(function JoinEpicDialog({ open, onOpenChange }: JoinEpicDialogProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [epicLimitReached, setEpicLimitReached] = useState(false);
  const queryClient = useQueryClient();
  const MAX_EPICS = 2;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setEpicLimitReached(false);
      setInviteCode("");
    }
  }, [open]);

  const handleJoinEpic = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setIsLoading(true);
    
    try {
      // Clean up the code (remove prefix if present)
      const code = inviteCode.trim().toUpperCase().replace('EPIC-', '');
      const fullCode = `EPIC-${code}`;

      // Look up the epic by invite code (include frequency, custom_days, and story_type for difficulty)
      const { data: epic, error: epicError } = await supabase
        .from('epics')
        .select('*, epic_story_types(slug), epic_habits(habit_id, habits(id, title, difficulty, frequency, custom_days))')
        .eq('invite_code', fullCode)
        .eq('is_public', true)
        .maybeSingle();

      if (epicError) throw epicError;
      if (!epic) {
        toast.error("Epic not found. Check the code and try again.");
        setIsLoading(false);
        return;
      }

      // Check if user is logged in
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Please sign in to join guilds");
        setIsLoading(false);
        return;
      }

      // Check epic limit (owned + joined)
      const { data: ownedEpics } = await supabase
        .from('epics')
        .select('id')
        .eq('user_id', user.user.id)
        .eq('status', 'active');
      
      const { data: joinedEpics } = await supabase
        .from('epic_members')
        .select('epic_id, epics!inner(user_id, status)')
        .eq('user_id', user.user.id)
        .neq('epics.user_id', user.user.id)
        .eq('epics.status', 'active');

      const totalActiveEpics = (ownedEpics?.length || 0) + (joinedEpics?.length || 0);
      
      if (totalActiveEpics >= MAX_EPICS) {
        setEpicLimitReached(true);
        toast.error(`You can only have ${MAX_EPICS} active epics at a time`);
        setIsLoading(false);
        return;
      }

      const { data: existingMember } = await supabase
        .from('epic_members')
        .select('id')
        .eq('epic_id', epic.id)
        .eq('user_id', user.user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error("You're already in this guild!");
        setIsLoading(false);
        return;
      }

      // Join the epic
      const { error: memberError } = await supabase
        .from('epic_members')
        .insert({
          epic_id: epic.id,
          user_id: user.user.id,
        });

      if (memberError) throw memberError;

      // Copy habits to user's account (respect tier-based limit)
      if (epic.epic_habits && epic.epic_habits.length > 0) {
        // Determine difficulty tier from epic (default to beginner if not set)
        // For joined epics, we infer tier from target_days as a heuristic
        let tier: string = 'beginner';
        if (epic.target_days >= 45) tier = 'advanced';
        else if (epic.target_days >= 21) tier = 'intermediate';
        
        const habitLimit = getHabitLimitForTier(tier);
        const limitedHabits = epic.epic_habits.slice(0, habitLimit);
        
        const habitsToCreate = limitedHabits.map((eh: { habits: { title: string; difficulty: string; frequency?: string; custom_days?: number[] | null } }) => ({
          user_id: user.user.id,
          title: eh.habits.title,
          difficulty: eh.habits.difficulty,
          frequency: eh.habits.frequency || 'daily',
          custom_days: eh.habits.custom_days || null,
        }));

        const { data: newHabits, error: habitsError } = await supabase
          .from('habits')
          .insert(habitsToCreate)
          .select();

        if (habitsError) throw habitsError;

        // Link new habits back to the epic
        const habitLinks = newHabits?.map((habit: { id: string }) => ({
          epic_id: epic.id,
          habit_id: habit.id,
        })) || [];

        const { error: linkError } = await supabase
          .from('epic_habits')
          .insert(habitLinks);

        if (linkError) throw linkError;
      }

      toast.success(`Joined "${epic.title}" guild! 🎯`);
      onOpenChange(false);
      setInviteCode("");
      
      // Refresh epics and habits queries
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    } catch (error) {
      console.error('Error joining epic:', error);
      toast.error("Failed to join guild. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join an Epic</DialogTitle>
          <DialogDescription>
            Enter an invite code to join a shared epic with others
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              placeholder="EPIC-WELLNESS-5K2X"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleJoinEpic();
                }
              }}
            />
            <p className="text-sm text-muted-foreground">
              You can paste the full link or just the code
            </p>
          </div>
          {epicLimitReached ? (
            <p className="text-sm text-amber-500 text-center py-2">
              You can only have {MAX_EPICS} active epics at a time. Complete or abandon an epic to join a new one.
            </p>
          ) : (
            <Button 
              onClick={handleJoinEpic} 
              disabled={isLoading || !inviteCode.trim()}
              className="w-full"
            >
              {isLoading ? "Loading..." : "Join Epic"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
