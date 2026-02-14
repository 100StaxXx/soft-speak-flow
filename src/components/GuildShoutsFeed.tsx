import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuildShouts } from "@/hooks/useGuildShouts";
import { useAuth } from "@/hooks/useAuth";
import { useMutedUsers } from "@/hooks/useMutedUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Megaphone, Bell, MoreHorizontal, VolumeX, Volume2 } from "lucide-react";
import { ShoutsFeedInfoTooltip } from "./ShoutsFeedInfoTooltip";
import { getShoutByKey, SHOUT_TYPE_CONFIG } from "@/data/shoutMessages";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface GuildShoutsFeedProps {
  epicId: string;
}

export const GuildShoutsFeed = ({ epicId }: GuildShoutsFeedProps) => {
  const { user } = useAuth();
  const { shouts, unreadCount, markAsRead, isLoading } = useGuildShouts(epicId);
  const { isUserMuted, muteUser, unmuteUser } = useMutedUsers(epicId);

  // Mark visible shouts as read
  useEffect(() => {
    if (unreadCount > 0 && shouts) {
      const unreadIds = shouts
        .filter(s => s.recipient_id === user?.id && !s.is_read)
        .map(s => s.id);
      
      if (unreadIds.length > 0) {
        // Delay marking as read so user sees them first
        const timer = setTimeout(() => {
          markAsRead.mutate(unreadIds);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
    // Note: markAsRead.mutate is a stable reference from useMutation, safe to include
  }, [shouts, unreadCount, user?.id, markAsRead]);

  if (isLoading) {
    return (
      <Card className="cosmic-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!shouts || shouts.length === 0) {
    return (
      <Card className="cosmic-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Guild Shouts
            <ShoutsFeedInfoTooltip />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No shouts yet! Send encouragement to your guild members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Guild Shouts
            <ShoutsFeedInfoTooltip />
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              {unreadCount} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] pr-4">
          <AnimatePresence mode="popLayout">
              {shouts.slice(0, 20).map((shout, index) => {
              const message = getShoutByKey(shout.message_key);
              const typeConfig = SHOUT_TYPE_CONFIG[shout.shout_type];
              const isForMe = shout.recipient_id === user?.id;
              const isFromMe = shout.sender_id === user?.id;
              const senderName = getUserDisplayName(shout.sender);
              const recipientName = getUserDisplayName(shout.recipient);
              const isSenderMuted = !isFromMe && isUserMuted(shout.sender_id);

              return (
                <motion.div
                  key={shout.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "mb-3 p-3 rounded-lg border transition-colors",
                    isForMe && !shout.is_read 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-muted/30 border-border/50",
                    isSenderMuted && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{message?.emoji || typeConfig?.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {isFromMe ? "You" : senderName}
                          {isSenderMuted && <VolumeX className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="font-medium text-sm">
                          {isForMe ? "You" : recipientName}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", typeConfig?.color)}
                        >
                          {typeConfig?.label}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{message?.text || "Sent a shout!"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(shout.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {/* Mute/Unmute dropdown for shouts from others */}
                    {!isFromMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isSenderMuted ? (
                            <DropdownMenuItem 
                              onClick={() => unmuteUser.mutate({ mutedUserId: shout.sender_id, epicId })}
                            >
                              <Volume2 className="h-4 w-4 mr-2" />
                              Unmute {senderName}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => muteUser.mutate({ mutedUserId: shout.sender_id, epicId })}
                            >
                              <VolumeX className="h-4 w-4 mr-2" />
                              Mute {senderName}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
