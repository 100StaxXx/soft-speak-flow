import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getEpicMembers } from "@/lib/firebase/epics";
import { getProfile } from "@/lib/firebase/profiles";
import { getCompanionsByUserIds } from "@/lib/firebase/userCompanion";
import { useGuildRivalry } from "@/hooks/useGuildRivalry";
import { useGuildShouts } from "@/hooks/useGuildShouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendShoutDrawer } from "./SendShoutDrawer";
import { GuildMembersInfoTooltip } from "./GuildMembersInfoTooltip";
import { FactionBadge } from "./FactionBadge";
import { Trophy, Medal, Flame, Swords, Megaphone, Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShoutType } from "@/data/shoutMessages";
import { getUserDisplayName, getInitials } from "@/utils/getUserDisplayName";

interface LeaderboardMember {
  user_id: string;
  total_contribution: number;
  joined_at: string;
  profile?: {
    email: string | null;
    onboarding_data?: unknown;
    faction?: string | null;
  };
  companion?: {
    current_image_url: string | null;
    spirit_animal: string | null;
  };
}

interface GuildMembersSectionProps {
  epicId: string;
}

export const GuildMembersSection = ({ epicId }: GuildMembersSectionProps) => {
  const { user } = useAuth();
  const { rivalry, setRival, isSettingRival } = useGuildRivalry(epicId);
  const { sendShout, isSending } = useGuildShouts(epicId);
  
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shoutDrawerOpen, setShoutDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeaderboardMember | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      setIsLoading(true);
      
      try {
        const membersData = await getEpicMembers(epicId);

        // Extract all user IDs for batch queries (avoid N+1 problem)
        const userIds = membersData.map(m => m.user_id).filter(Boolean) as string[];

        // Batch fetch profiles and companions in parallel
        const [companionsMap] = await Promise.all([
          getCompanionsByUserIds(userIds),
        ]);

        // Fetch profiles individually (Firestore doesn't support batch get for multiple documents easily)
        const profilesMap = new Map();
        for (const userId of userIds) {
          try {
            const profile = await getProfile(userId);
            if (profile) {
              profilesMap.set(userId, {
                email: profile.email,
                onboarding_data: profile.onboarding_data,
                faction: profile.faction,
              });
            }
          } catch (error) {
            console.error(`Failed to fetch profile for ${userId}:`, error);
          }
        }

        // Enrich members with profile and companion data
        const enrichedMembers: LeaderboardMember[] = membersData.map(member => ({
          user_id: member.user_id,
          total_contribution: member.total_contribution ?? 0,
          joined_at: member.joined_at || new Date().toISOString(),
          profile: profilesMap.get(member.user_id),
          companion: companionsMap.get(member.user_id) ? {
            current_image_url: companionsMap.get(member.user_id)?.current_image_url || null,
            spirit_animal: companionsMap.get(member.user_id)?.spirit_animal || null,
          } : undefined,
        }));

        setMembers(enrichedMembers);
      } catch (error) {
        console.error("Error fetching guild members:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();

    // Note: Real-time subscriptions would need to be implemented with Firestore onSnapshot
    // For now, we'll just fetch on mount and when epicId changes
    // TODO: Add Firestore real-time listener if needed
  }, [epicId]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Flame className="h-4 w-4 text-orange-400" />;
  };

  const getDisplayName = (member: LeaderboardMember) => {
    return getUserDisplayName(member.profile);
  };

  const handleOpenShoutDrawer = (member: LeaderboardMember) => {
    setSelectedMember(member);
    setShoutDrawerOpen(true);
  };

  const handleSendShout = (shoutType: ShoutType, messageKey: string) => {
    if (!selectedMember) return;
    sendShout.mutate({
      recipientId: selectedMember.user_id,
      shoutType,
      messageKey,
    });
  };

  const handleSetRival = (memberId: string) => {
    setRival.mutate(memberId);
  };

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

  if (members.length <= 1) {
    return (
      <Card className="cosmic-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Guild Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Invite others to join your guild and compete together!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="cosmic-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Guild Leaderboard
              <GuildMembersInfoTooltip />
            </div>
            <Badge variant="outline" className="text-xs">
              {members.length} members
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member, index) => {
            const isCurrentUser = member.user_id === user?.uid;
            const isRival = rivalry?.rival_id === member.user_id;
            const displayName = getDisplayName(member);

            return (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  index === 0 && "bg-yellow-500/10 border border-yellow-500/20",
                  isRival && "bg-red-500/10 border border-red-500/30 ring-1 ring-red-500/50",
                  isCurrentUser && !isRival && "bg-primary/10 border border-primary/20"
                )}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {getRankIcon(index)}
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10 border-2 border-background">
                  <AvatarImage src={member.companion?.current_image_url || undefined} />
                  <AvatarFallback className="text-xs bg-muted">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{displayName}</span>
                    {member.profile?.faction && (
                      <FactionBadge faction={member.profile.faction} variant="icon-only" className="h-6 w-6" />
                    )}
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                    {isRival && (
                      <Badge variant="destructive" className="text-xs">
                        <Swords className="h-3 w-3 mr-1" />
                        Rival
                      </Badge>
                    )}
                    {index === 0 && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {member.total_contribution} contributions
                  </p>
                </div>

                {/* Actions */}
                {!isCurrentUser && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenShoutDrawer(member)}
                    >
                      <Megaphone className="h-4 w-4" />
                    </Button>
                    {!isRival && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleSetRival(member.user_id)}
                        disabled={isSettingRival}
                      >
                        <Swords className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Send Shout Drawer */}
      {selectedMember && (
        <SendShoutDrawer
          open={shoutDrawerOpen}
          onOpenChange={setShoutDrawerOpen}
          recipient={{
            id: selectedMember.user_id,
            name: getDisplayName(selectedMember),
            avatarUrl: selectedMember.companion?.current_image_url || undefined,
          }}
          onSendShout={handleSendShout}
          isSending={isSending}
        />
      )}
    </>
  );
};
