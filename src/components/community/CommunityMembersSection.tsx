import { useCommunityMembers, CommunityMember } from "@/hooks/useCommunityMembers";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Shield, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface CommunityMembersSectionProps {
  communityId: string;
  maxHeight?: string;
}

export const CommunityMembersSection = ({ communityId, maxHeight = "300px" }: CommunityMembersSectionProps) => {
  const { leaderboard, isLoading, currentUserMember } = useCommunityMembers(communityId);

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <p>No members yet</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Leaderboard</h3>
          <Badge variant="secondary" className="ml-auto">
            {leaderboard.length} members
          </Badge>
        </div>
      </div>

      <ScrollArea style={{ maxHeight }}>
        <div className="divide-y">
          {leaderboard.map((member, index) => (
            <MemberRow
              key={member.id}
              member={member}
              rank={index + 1}
              isCurrentUser={member.user_id === currentUserMember?.user_id}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

interface MemberRowProps {
  member: CommunityMember;
  rank: number;
  isCurrentUser: boolean;
}

const MemberRow = ({ member, rank, isCurrentUser }: MemberRowProps) => {
  const getRankDisplay = () => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-sm font-medium text-muted-foreground w-6 text-center">{rank}</span>;
  };

  const getRoleIcon = () => {
    switch (member.role) {
      case 'owner':
        return <Crown className="h-3 w-3 text-amber-500" />;
      case 'admin':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const displayName = getUserDisplayName(member.profile);
  const companionImage = member.companion?.current_image_url;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 transition-colors",
        isCurrentUser && "bg-primary/5"
      )}
    >
      {/* Rank */}
      <div className="w-8 flex justify-center">{getRankDisplay()}</div>

      {/* Avatar */}
      <Avatar className="h-10 w-10">
        <AvatarImage src={companionImage || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium truncate", isCurrentUser && "text-primary")}>
            {displayName}
            {isCurrentUser && " (you)"}
          </span>
          {getRoleIcon()}
        </div>
        {member.companion && (
          <p className="text-xs text-muted-foreground capitalize">
            {member.companion.spirit_animal} • Stage {member.companion.current_stage}
          </p>
        )}
      </div>

      {/* Contribution */}
      <div className="text-right">
        <p className="font-semibold text-sm">{member.total_contribution.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">XP</p>
      </div>
    </div>
  );
};
