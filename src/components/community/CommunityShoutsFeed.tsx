import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGuildShouts, GuildShout } from "@/hooks/useGuildShouts";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useAuth } from "@/hooks/useAuth";
import { SHOUT_TYPE_CONFIG, getShoutsByType, getShoutByKey, ShoutType } from "@/data/shoutMessages";
import { getUserDisplayName } from "@/utils/getUserDisplayName";
import { Megaphone, Loader2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface CommunityShoutsFeedProps {
  communityId: string;
}

export const CommunityShoutsFeed = ({ communityId }: CommunityShoutsFeedProps) => {
  const { user } = useAuth();
  const { shouts, myShouts, unreadCount, sendShout, markAsRead, isLoading, isSending } = useGuildShouts({ communityId });
  const { members } = useCommunityMembers(communityId);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);

  // Mark shouts as read when viewing
  const handleMarkRead = () => {
    const unreadIds = myShouts.filter(s => !s.is_read).map(s => s.id);
    if (unreadIds.length > 0) {
      markAsRead.mutate(unreadIds);
    }
  };

  const otherMembers = members?.filter(m => m.user_id !== user?.id) || [];

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Shouts</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => setShowSendDialog(true)}
            disabled={otherMembers.length === 0}
          >
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        </div>

        {!shouts || shouts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No shouts yet</p>
            <p className="text-xs">Be the first to encourage someone!</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]" onPointerEnter={handleMarkRead}>
            <div className="divide-y">
              {shouts.slice(0, 10).map((shout) => (
                <ShoutItem key={shout.id} shout={shout} currentUserId={user?.id} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Send Shout Dialog */}
      <SendShoutDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        members={otherMembers}
        selectedRecipient={selectedRecipient}
        setSelectedRecipient={setSelectedRecipient}
      onSend={async (recipientId, shoutType, messageKey) => {
        await sendShout.mutateAsync({ recipientId, shoutType: shoutType as ShoutType, messageKey });
          setShowSendDialog(false);
          setSelectedRecipient(null);
        }}
        isSending={isSending}
      />
    </>
  );
};

interface ShoutItemProps {
  shout: GuildShout;
  currentUserId?: string;
}

const ShoutItem = ({ shout, currentUserId }: ShoutItemProps) => {
  const message = getShoutByKey(shout.message_key);
  const senderName = getUserDisplayName(shout.sender);
  const recipientName = getUserDisplayName(shout.recipient);
  const isForMe = shout.recipient_id === currentUserId;
  const isFromMe = shout.sender_id === currentUserId;

  return (
    <div
      className={cn(
        "p-3 transition-colors",
        isForMe && !shout.is_read && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl">{message?.emoji || '📢'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{isFromMe ? 'You' : senderName}</span>
            {' → '}
            <span className="font-medium">{isForMe ? 'you' : recipientName}</span>
          </p>
          <p className="text-sm text-muted-foreground">{message?.text}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(shout.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
};

interface SendShoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Array<{
    user_id: string;
    profile?: { email: string | null };
    companion?: { current_image_url: string | null; spirit_animal: string };
  }>;
  selectedRecipient: string | null;
  setSelectedRecipient: (id: string | null) => void;
  onSend: (recipientId: string, shoutType: string, messageKey: string) => Promise<void>;
  isSending: boolean;
}

const SendShoutDialog = ({
  open,
  onOpenChange,
  members,
  selectedRecipient,
  setSelectedRecipient,
  onSend,
  isSending,
}: SendShoutDialogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<ShoutType | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const handleSend = async () => {
    if (!selectedRecipient || !selectedCategory || !selectedMessage) return;
    await onSend(selectedRecipient, selectedCategory, selectedMessage);
    setSelectedCategory(null);
    setSelectedMessage(null);
  };

  const messages = selectedCategory ? getShoutsByType(selectedCategory) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Send a Shout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Recipient */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Who do you want to shout at?</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const name = member.profile?.email?.split('@')[0] || 'Anonymous';
                const isSelected = selectedRecipient === member.user_id;
                
                return (
                  <Button
                    key={member.user_id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRecipient(member.user_id)}
                    className="gap-2"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.companion?.current_image_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Category */}
          {selectedRecipient && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What kind of shout?</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SHOUT_TYPE_CONFIG) as ShoutType[]).map((type) => {
                  const config = SHOUT_TYPE_CONFIG[type];
                  return (
                    <Button
                      key={type}
                      variant={selectedCategory === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(type);
                        setSelectedMessage(null);
                      }}
                    >
                      {config.emoji} {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Select Message */}
          {selectedCategory && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pick your message:</p>
              <ScrollArea className="max-h-[150px]">
                <div className="space-y-1">
                  {messages.map((msg) => (
                    <Button
                      key={msg.key}
                      variant={selectedMessage === msg.key ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => setSelectedMessage(msg.key)}
                    >
                      {msg.emoji} {msg.text}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Send Button */}
          {selectedMessage && (
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Shout
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
