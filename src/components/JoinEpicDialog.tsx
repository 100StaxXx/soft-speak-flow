import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface JoinEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JoinEpicDialog = ({ open, onOpenChange }: JoinEpicDialogProps) => {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

      // Look up the epic by invite code
      const { data: epic, error: epicError } = await supabase
        .from('epics')
        .select('*, epic_habits(habit_id, habits(*))')
        .eq('invite_code', fullCode)
        .eq('is_public', true)
        .maybeSingle();

      if (epicError) throw epicError;
      if (!epic) {
        toast.error("Epic not found. Check the code and try again.");
        setIsLoading(false);
        return;
      }

      // Check if already a member
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Please sign in to join guilds");
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

      // Check if this brings the epic to 3+ members (Discord unlock threshold)
      const { count: totalMembers } = await supabase
        .from('epic_members')
        .select('*', { count: 'exact', head: true })
        .eq('epic_id', epic.id);

      // If we just hit the threshold, mark as discord_ready
      if (totalMembers && totalMembers >= 3) {
        const { data: currentEpic } = await supabase
          .from('epics')
          .select('discord_ready')
          .eq('id', epic.id)
          .single();
        
        if (currentEpic && !currentEpic.discord_ready) {
          await supabase
            .from('epics')
            .update({ discord_ready: true })
            .eq('id', epic.id);
          
          console.log('Epic reached 3 members - Discord channel unlocked!');
        }
      }

      // Copy habits to user's account
      if (epic.epic_habits && epic.epic_habits.length > 0) {
        const habitsToCreate = epic.epic_habits.map((eh: { habits: { title: string; difficulty: string; frequency: string; custom_days?: number[] } }) => ({
          user_id: user.user.id,
          title: eh.habits.title,
          difficulty: eh.habits.difficulty,
          frequency: eh.habits.frequency,
          custom_days: eh.habits.custom_days,
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
      
      // Refresh epics list
      navigate('/epics');
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
          <Button 
            onClick={handleJoinEpic} 
            disabled={isLoading || !inviteCode.trim()}
            className="w-full"
          >
            {isLoading ? "Loading..." : "Join Epic"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
