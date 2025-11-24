import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
    
    // Extract code from full URL if pasted
    let code = inviteCode.trim();
    if (code.includes("/join/")) {
      code = code.split("/join/")[1];
    }

    // Navigate to join page
    navigate(`/join/${code}`);
    onOpenChange(false);
    setIsLoading(false);
    setInviteCode("");
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
