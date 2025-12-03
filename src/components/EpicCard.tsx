import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Flame, Target, Calendar, Zap, Share2, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { EpicDiscordSection } from "./EpicDiscordSection";
import { GuildStorySection } from "./GuildStorySection";
import { GuildMembersSection } from "./GuildMembersSection";
import { GuildShoutsFeed } from "./GuildShoutsFeed";
import { ConstellationTrail } from "./ConstellationTrail";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
type EpicTheme = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

const themeGradients: Record<EpicTheme, string> = {
  heroic: "from-epic-heroic/20 to-purple-500/20",
  warrior: "from-epic-warrior/20 to-orange-500/20",
  mystic: "from-epic-mystic/20 to-blue-500/20",
  nature: "from-epic-nature/20 to-emerald-500/20",
  solar: "from-epic-solar/20 to-amber-500/20"
};

const themeBorders: Record<EpicTheme, string> = {
  heroic: "border-epic-heroic/20 hover:border-epic-heroic/40",
  warrior: "border-epic-warrior/20 hover:border-epic-warrior/40",
  mystic: "border-epic-mystic/20 hover:border-epic-mystic/40",
  nature: "border-epic-nature/20 hover:border-epic-nature/40",
  solar: "border-epic-solar/20 hover:border-epic-solar/40"
};

interface Epic {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  target_days: number;
  start_date: string;
  end_date: string;
  status: string;
  xp_reward: number;
  progress_percentage: number;
  is_public?: boolean;
  invite_code?: string;
  theme_color?: string;
  discord_channel_id?: string | null;
  discord_invite_url?: string | null;
  discord_ready?: boolean;
  epic_habits?: Array<{
    habit_id: string;
    habits: {
      id: string;
      title: string;
      difficulty: string;
    };
  }>;
}

interface EpicCardProps {
  epic: Epic;
  onComplete?: () => void;
  onAbandon?: () => void;
}

export const EpicCard = ({ epic, onComplete, onAbandon }: EpicCardProps) => {
  const [copied, setCopied] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const daysRemaining = Math.ceil(
    (new Date(epic.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isCompleted = epic.status === "completed";
  const isActive = epic.status === "active";
  const theme = (epic.theme_color || 'heroic') as EpicTheme;
  const themeGradient = themeGradients[theme];
  const themeBorder = themeBorders[theme];

  // Fetch member count for public epics (for Discord feature)
  useEffect(() => {
    if (epic.is_public && epic.id) {
      const fetchMemberCount = async () => {
        const { count } = await supabase
          .from('epic_members')
          .select('*', { count: 'exact', head: true })
          .eq('epic_id', epic.id);
        
        setMemberCount(count || 0);
      };
      
      fetchMemberCount();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel(`epic-members-${epic.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'epic_members',
            filter: `epic_id=eq.${epic.id}`
          },
          () => fetchMemberCount()
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [epic.is_public, epic.id]);

  const handleShareEpic = async () => {
    if (!epic.invite_code) return;
    
    try {
      await navigator.clipboard.writeText(epic.invite_code);
      setCopied(true);
      toast.success("Invite code copied!", {
        description: "Share this code with others to invite them to your guild",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-6 bg-gradient-to-br border-2 transition-all",
        `from-background to-secondary/20 ${themeBorder}`,
        `bg-gradient-to-br ${themeGradient}`
      )}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isCompleted ? (
                <Trophy className="w-6 h-6 text-yellow-400" />
              ) : (
                <Target className="w-6 h-6 text-primary" />
              )}
              <h3 className="text-xl font-bold">{epic.title}</h3>
              {epic.invite_code && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={handleShareEpic}
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            {epic.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {epic.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge
              variant={isCompleted ? "default" : "secondary"}
            >
              {isCompleted ? "Legendary" : isActive ? "Active" : "Abandoned"}
            </Badge>
            {isActive && (
              <button
                onClick={onAbandon}
                className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors"
                title="Abandon epic"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Constellation Trail Progress */}
        <ConstellationTrail 
          progress={epic.progress_percentage} 
          targetDays={epic.target_days}
          className="mb-4"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-sm font-bold">{epic.target_days} days</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-sm font-bold">
                {isCompleted ? "Complete!" : `${daysRemaining}d`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <div>
              <div className="text-xs text-muted-foreground">XP Reward</div>
              <div className="text-sm font-bold">{epic.xp_reward} XP</div>
            </div>
          </div>
        </div>

        {/* Linked Habits */}
        {epic.epic_habits && epic.epic_habits.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Contributing Habits
            </div>
            <div className="flex flex-wrap gap-2">
              {epic.epic_habits.map((eh) => (
                <Badge key={eh.habit_id} variant="outline" className="text-xs">
                  {eh.habits.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Community Features for Shared Epics */}
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <GuildMembersSection epicId={epic.id} />
          <GuildShoutsFeed epicId={epic.id} />
          <GuildStorySection epicId={epic.id} memberCount={memberCount} />
          <EpicDiscordSection 
            epic={{
              id: epic.id,
              user_id: epic.user_id,
              discord_ready: epic.discord_ready || false,
              discord_channel_id: epic.discord_channel_id,
              discord_invite_url: epic.discord_invite_url,
            }} 
            memberCount={memberCount} 
          />
        </div>

        {/* Action Buttons */}
        {isActive && epic.progress_percentage >= 100 && (
          <div className="mt-4">
            <Button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Complete Epic
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
