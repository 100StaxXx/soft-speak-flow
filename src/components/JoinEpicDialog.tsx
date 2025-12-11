import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getEpicByInviteCode, joinEpic, getUserEpics, getEpicHabits } from "@/lib/firebase/epics";
import { getDocuments, setDocument } from "@/lib/firebase/firestore";

interface JoinEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JoinEpicDialog = ({ open, onOpenChange }: JoinEpicDialogProps) => {
  const { user } = useAuth();
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

    if (!user) {
      toast.error("Please sign in to join guilds");
      return;
    }

    setIsLoading(true);
    
    try {
      // Clean up the code (remove prefix if present)
      const code = inviteCode.trim().toUpperCase().replace('EPIC-', '');
      const fullCode = `EPIC-${code}`;

      // Look up the epic by invite code
      const epic = await getEpicByInviteCode(fullCode);
      if (!epic) {
        toast.error("Epic not found. Check the code and try again.");
        setIsLoading(false);
        return;
      }

      // Get epic habits
      const epicHabits = await getEpicHabits(epic.id);
      
      // Get habit details for each epic habit
      const habitIds = epicHabits.map(eh => eh.habit_id).filter(Boolean) as string[];
      const habits = [];
      for (const habitId of habitIds) {
        const habit = await getDocuments<{ id: string; title: string; difficulty: string; frequency?: string; custom_days?: number[] | null }>(
          "habits",
          [["id", "==", habitId]],
          undefined,
          undefined,
          1
        );
        if (habit[0]) habits.push(habit[0]);
      }

      // Check epic limit (owned + joined)
      const { owned, joined } = await getUserEpics(user.uid);
      const totalActiveEpics = owned.length + joined.length;
      
      if (totalActiveEpics >= MAX_EPICS) {
        setEpicLimitReached(true);
        toast.error(`You can only have ${MAX_EPICS} active epics at a time`);
        setIsLoading(false);
        return;
      }

      // Check if already a member
      const existingMembers = await getDocuments(
        "epic_members",
        [
          ["epic_id", "==", epic.id],
          ["user_id", "==", user.uid]
        ],
        undefined,
        undefined,
        1
      );

      if (existingMembers.length > 0) {
        toast.error("You're already in this guild!");
        setIsLoading(false);
        return;
      }

      // Join the epic
      await joinEpic(epic.id, user.uid);

      // Copy habits to user's account (preserve all habit properties)
      if (habits.length > 0) {
        const habitsToCreate = habits.map(habit => ({
          user_id: user.uid,
          title: habit.title,
          difficulty: habit.difficulty,
          frequency: habit.frequency || 'daily',
          custom_days: habit.custom_days || null,
          is_active: true,
        }));

        const newHabits = [];
        for (const habitData of habitsToCreate) {
          const habitId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await setDocument("habits", habitId, habitData, false);
          newHabits.push({ id: habitId });
        }

        // Link new habits back to the epic
        for (const habit of newHabits) {
          const linkId = `${epic.id}_${habit.id}`;
          await setDocument("epic_habits", linkId, {
            epic_id: epic.id,
            habit_id: habit.id,
          }, false);
        }
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
};
