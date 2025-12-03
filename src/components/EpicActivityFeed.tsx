import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Flame, UserPlus, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { getUserDisplayName, getInitials } from "@/utils/getUserDisplayName";

interface ActivityItem {
  id: string;
  user_id: string;
  activity_type: string;
  activity_data: Record<string, unknown>;
  created_at: string;
  profiles?: {
    email?: string;
    onboarding_data?: unknown;
  };
}

interface EpicActivityFeedProps {
  epicId: string;
}

export const EpicActivityFeed = ({ epicId }: EpicActivityFeedProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("epic_activity_feed")
        .select("*")
        .eq("epic_id", epicId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Fetch user emails separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, onboarding_data")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const enrichedActivities = data.map(activity => ({
          ...activity,
          activity_data: typeof activity.activity_data === 'object' && activity.activity_data !== null 
            ? activity.activity_data as Record<string, unknown>
            : {},
          profiles: profileMap.get(activity.user_id)
        }));
        
        setActivities(enrichedActivities);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('epic-activity-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'epic_activity_feed',
          filter: `epic_id=eq.${epicId}`
        },
        () => {
          // Add new activity to top of feed
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epicId]); // fetchActivities is stable and depends on epicId indirectly

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "habit_completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "milestone_reached":
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case "joined_epic":
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case "streak_milestone":
        return <Flame className="w-4 h-4 text-orange-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-primary" />;
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    const userName = getUserDisplayName(activity.profiles);
    
    switch (activity.activity_type) {
      case "habit_completed":
        return `${userName} completed "${activity.activity_data.habit_title}"`;
      case "milestone_reached":
        return `${userName} reached ${activity.activity_data.milestone}% progress!`;
      case "joined_epic":
        return `${userName} joined the epic`;
      case "streak_milestone":
        return `${userName} hit a ${activity.activity_data.days}-day streak! 🔥`;
      default:
        return `${userName} made progress`;
    }
  };

  const getActivityInitials = (profile?: { email?: string; onboarding_data?: unknown }) => {
    const name = getUserDisplayName(profile);
    return getInitials(name);
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Recent Activity</h3>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Flame className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity yet. Start completing habits!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Recent Activity</h3>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {getActivityInitials(activity.profiles)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  {getActivityIcon(activity.activity_type)}
                  <p className="text-sm flex-1">
                    {getActivityText(activity)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
};
