import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuildActivity } from "@/hooks/useGuildActivity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  BookOpen, 
  Megaphone, 
  MapPin, 
  UserPlus, 
  Flame, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  type LucideIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface GuildActivityFeedProps {
  epicId: string;
}

const ACTIVITY_CONFIG: Record<string, { 
  icon: LucideIcon; 
  color: string; 
  format: (data: Record<string, any>) => string;
}> = {
  story_chapter: {
    icon: BookOpen,
    color: "text-purple-400",
    format: (data) => `New chapter unlocked: "${data.title || 'Untitled'}"`,
  },
  shout_highlight: {
    icon: Megaphone,
    color: "text-orange-400",
    format: (data) => `${data.sender || 'Someone'} sent a ${data.type || 'shout'} to ${data.recipient || 'someone'}`,
  },
  postcard_earned: {
    icon: MapPin,
    color: "text-cyan-400",
    format: (data) => `${data.user || 'A companion'} sent a postcard from ${data.location || 'somewhere magical'}`,
  },
  member_joined: {
    icon: UserPlus,
    color: "text-green-400",
    format: (data) => `${data.user || 'Someone'} joined the guild!`,
  },
  streak_milestone: {
    icon: Flame,
    color: "text-amber-400",
    format: (data) => `${data.user || 'Someone'} hit a ${data.days || '?'}-day streak!`,
  },
  companion_evolved: {
    icon: Sparkles,
    color: "text-pink-400",
    format: (data) => `${data.user || 'Someone'}'s companion evolved to Stage ${data.stage || '?'}!`,
  },
};

export const GuildActivityFeed = ({ epicId }: GuildActivityFeedProps) => {
  const { activities, isLoading } = useGuildActivity(epicId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return null;
  }

  if (!activities || activities.length === 0) {
    return null;
  }

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-2">
        <Button
          variant="ghost"
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Guild Activity
            <span className="text-xs text-muted-foreground font-normal">
              ({activities.length})
            </span>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <ScrollArea className="h-[200px] pr-2">
                <div className="space-y-2">
                  {activities.map((activity, index) => {
                    const config = ACTIVITY_CONFIG[activity.activity_type] || {
                      icon: Activity,
                      color: "text-muted-foreground",
                      format: () => "Something happened",
                    };
                    const Icon = config.icon;

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/20"
                      >
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-relaxed">
                            {config.format(activity.activity_data)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
