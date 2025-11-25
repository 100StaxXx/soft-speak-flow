import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Lock, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DISCORD_UNLOCK_THRESHOLD } from "@/lib/constants";

interface EpicDiscordSectionProps {
  epic: {
    id: string;
    user_id: string;
    discord_ready: boolean;
    discord_channel_id?: string | null;
    discord_invite_url?: string | null;
  };
  memberCount: number;
}

export const EpicDiscordSection = ({ epic, memberCount }: EpicDiscordSectionProps) => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const isOwner = user?.id === epic.user_id;
  const isUnlocked = memberCount >= DISCORD_UNLOCK_THRESHOLD;

  const handleCreateChannel = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-discord-channel-for-guild',
        { body: { epicId: epic.id } }
      );

      if (error) throw error;

      toast.success("Discord channel created! 🎮", {
        description: "Your guild now has a private Discord channel!",
      });

      // Refresh the page to update state
      window.location.reload();
    } catch (error) {
      console.error('Error creating Discord channel:', error);
      toast.error("Failed to create Discord channel. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Don't show anything if not close to unlock and not unlocked
  if (memberCount < DISCORD_UNLOCK_THRESHOLD - 1 && !isUnlocked) {
    return null;
  }

  // State 1: Close to unlock or just locked (show compact progress)
  if (!isUnlocked) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Lock className="w-3 h-3" />
        <span>Discord chat unlocks at {DISCORD_UNLOCK_THRESHOLD} members ({memberCount}/{DISCORD_UNLOCK_THRESHOLD})</span>
      </div>
    );
  }

  // State 2: Unlocked but not created (owner only)
  if (!epic.discord_channel_id && isOwner) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">Discord Unlocked!</span>
        </div>
        <Button 
          onClick={handleCreateChannel}
          disabled={isCreating}
          size="sm"
          className="h-7 text-xs bg-green-600 hover:bg-green-700"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Create Channel
            </>
          )}
        </Button>
      </div>
    );
  }

  // State 3: Channel created (all members)
  if (epic.discord_channel_id && epic.discord_invite_url) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Discord Chat</span>
        </div>
        <Button 
          onClick={() => window.open(epic.discord_invite_url!, '_blank')}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
        >
          <span>Open Chat</span>
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  // State 4: Unlocked but not created (non-owner) - minimal message
  if (!epic.discord_channel_id && !isOwner) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <MessageSquare className="w-3 h-3" />
        <span>Discord available - Owner can create channel</span>
      </div>
    );
  }

  return null;
};
