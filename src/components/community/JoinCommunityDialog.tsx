import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCommunity } from "@/hooks/useCommunity";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { Loader2, UserPlus, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface JoinCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (communityId: string) => void;
}

export const JoinCommunityDialog = ({ open, onOpenChange, onSuccess }: JoinCommunityDialogProps) => {
  const { findByInviteCode } = useCommunity();
  const { joinCommunity, isJoining } = useCommunityMembers();
  const [inviteCode, setInviteCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundCommunity, setFoundCommunity] = useState<{
    id: string;
    name: string;
    description: string | null;
    theme_color: string;
  } | null>(null);

  const handleSearch = async () => {
    if (!inviteCode.trim()) return;

    setIsSearching(true);
    const community = await findByInviteCode(inviteCode.trim());
    setIsSearching(false);

    if (community) {
      setFoundCommunity({
        id: community.id,
        name: community.name,
        description: community.description,
        theme_color: community.theme_color,
      });
    } else {
      toast.error("Community not found", {
        description: "Check the invite code and try again.",
      });
      setFoundCommunity(null);
    }
  };

  const handleJoin = async () => {
    if (!foundCommunity) return;

    try {
      await joinCommunity.mutateAsync(foundCommunity.id);
      onOpenChange(false);
      onSuccess?.(foundCommunity.id);
      // Reset form
      setInviteCode("");
      setFoundCommunity(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setInviteCode("");
    setFoundCommunity(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Join Community
          </DialogTitle>
          <DialogDescription>
            Enter an invite code to join an existing community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!foundCommunity ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-code"
                    placeholder="Enter code (e.g., ABC12345)"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="font-mono uppercase tracking-wider"
                  />
                  <Button
                    type="button"
                    onClick={handleSearch}
                    disabled={!inviteCode.trim() || isSearching}
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Find"
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Ask a community member for their invite code
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div
                className="p-4 rounded-xl border-2"
                style={{ borderColor: foundCommunity.theme_color }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: foundCommunity.theme_color }}
                  >
                    {foundCommunity.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{foundCommunity.name}</h3>
                    {foundCommunity.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {foundCommunity.description}
                      </p>
                    )}
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFoundCommunity(null)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="flex-1"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Community"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
