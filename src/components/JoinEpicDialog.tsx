import { memo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface JoinEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JoinEpicDialog = memo(function JoinEpicDialog({ open, onOpenChange }: JoinEpicDialogProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [epicLimitReached, setEpicLimitReached] = useState(false);
  const queryClient = useQueryClient();
  const MAX_EPICS = 3;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setEpicLimitReached(false);
      setInviteCode("");
    }
  }, [open]);

  const extractInviteCode = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const epicCodeMatch = trimmed.match(/EPIC-[A-Z0-9-]+/i);
    if (epicCodeMatch?.[0]) {
      return epicCodeMatch[0].toUpperCase();
    }

    return `EPIC-${trimmed.toUpperCase().replace(/^EPIC-/, "")}`;
  };

  const handleJoinEpic = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setIsLoading(true);
    
    try {
      const normalizedInviteCode = extractInviteCode(inviteCode);
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: Array<{
        success: boolean;
        code: string;
        message: string;
        epic_id: string | null;
        epic_title: string | null;
        copied_habit_count: number;
      }> | null; error: { message?: string } | null }>)('join_epic_by_invite_code', {
        p_invite_code: normalizedInviteCode,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result) {
        throw new Error('Failed to join guild');
      }

      if (!result.success) {
        if (result.code === 'epic_limit_reached') {
          setEpicLimitReached(true);
        }

        toast.error(result.message || 'Failed to join guild');
        return;
      }

      toast.success(`Joined "${result.epic_title}" guild! 🎯`);
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
