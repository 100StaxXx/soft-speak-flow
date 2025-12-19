import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

interface CommunityInviteSectionProps {
  inviteCode: string;
  communityName: string;
}

export const CommunityInviteSection = ({ inviteCode, communityName }: CommunityInviteSectionProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleShare = async () => {
    const shareText = `Join my community "${communityName}" on the app! Use invite code: ${inviteCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${communityName}`,
          text: shareText,
        });
      } catch (error) {
        // User cancelled or share failed
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-sm">Invite Friends</h4>
      </div>

      <div className="flex gap-2">
        <Input
          value={inviteCode}
          readOnly
          className="font-mono text-center tracking-widest uppercase"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          className="flex-shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={handleShare}
          className="flex-shrink-0"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Share this code with friends to invite them
      </p>
    </Card>
  );
};
