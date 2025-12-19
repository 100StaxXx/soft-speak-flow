import { CommunityWithMembership } from "@/hooks/useCommunity";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommunityCardProps {
  community: CommunityWithMembership;
  isSelected?: boolean;
  onClick?: () => void;
  memberCount?: number;
}

export const CommunityCard = ({ community, isSelected, onClick, memberCount }: CommunityCardProps) => {
  const getRoleIcon = () => {
    switch (community.role) {
      case 'owner':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <Shield className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getRoleLabel = () => {
    switch (community.role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      default:
        return 'Member';
    }
  };

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-glow"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: community.theme_color }}
        >
          {community.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{community.name}</h3>
            {community.is_public ? (
              <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          
          {community.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {community.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs gap-1">
              {getRoleIcon()}
              {getRoleLabel()}
            </Badge>
            
            {memberCount !== undefined && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

// Simple card for public communities (discover tab)
interface PublicCommunityCardProps {
  community: {
    id: string;
    name: string;
    description: string | null;
    theme_color: string;
    is_public: boolean;
  };
  onClick?: () => void;
}

export const PublicCommunityCard = ({ community, onClick }: PublicCommunityCardProps) => {
  return (
    <Card
      className="p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: community.theme_color }}
        >
          {community.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{community.name}</h3>
          {community.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {community.description}
            </p>
          )}
        </div>

        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
};
