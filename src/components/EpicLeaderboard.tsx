import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface LeaderboardMember {
  user_id: string;
  total_contribution: number;
  joined_at: string;
  profiles?: {
    email?: string;
  };
  companion?: {
    current_image_url?: string;
    current_stage: number;
    spirit_animal: string;
  };
}

interface EpicLeaderboardProps {
  epicId: string;
}

export const EpicLeaderboard = ({ epicId }: EpicLeaderboardProps) => {
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('epic-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'epic_members',
          filter: `epic_id=eq.${epicId}`
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [epicId]);

  const fetchLeaderboard = async () => {
    try {
      const { data: membersData, error } = await supabase
        .from("epic_members")
        .select("user_id, total_contribution, joined_at")
        .eq("epic_id", epicId)
        .order("total_contribution", { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles and companions separately
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        
        // Fetch profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        
        // Fetch companions
        const { data: companions } = await supabase
          .from("user_companion")
          .select("user_id, current_image_url, current_stage, spirit_animal")
          .in("user_id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const companionMap = new Map(companions?.map(c => [c.user_id, c]) || []);
        
        const enrichedMembers = membersData.map(member => ({
          ...member,
          profiles: profileMap.get(member.user_id),
          companion: companionMap.get(member.user_id)
        }));
        
        setMembers(enrichedMembers);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <Flame className="w-4 h-4 text-primary" />;
  };

  const getInitials = (email?: string) => {
    if (!email) return "?";
    return email.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return null;
  }

  // Hide leaderboard if only 1 or 0 members (just the creator or empty)
  if (members.length <= 1) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Leaderboard</h3>
        <Badge variant="secondary" className="ml-auto">
          {members.length} {members.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      <div className="space-y-2">
        {members.map((member, index) => (
          <motion.div
            key={member.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              index === 0
                ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
                : "bg-secondary/50"
            }`}
          >
            <div className="flex items-center justify-center w-8">
              {index < 3 ? (
                getRankIcon(index)
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  #{index + 1}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                {member.companion?.current_image_url ? (
                  <AvatarImage 
                    src={member.companion.current_image_url} 
                    alt={member.companion.spirit_animal || "Companion"}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {getInitials(member.profiles?.email)}
                </AvatarFallback>
              </Avatar>

              {member.companion && (
                <div className="text-xs">
                  <p className="font-medium text-muted-foreground">
                    Stage {member.companion.current_stage}
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {member.profiles?.email?.split("@")[0] || "Anonymous"}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.total_contribution} contributions
              </p>
            </div>

            {index === 0 && (
              <Badge variant="default" className="bg-yellow-500">
                Leader
              </Badge>
            )}
          </motion.div>
        ))}
      </div>
    </Card>
  );
};
