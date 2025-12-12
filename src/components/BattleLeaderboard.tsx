import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getUserDisplayName, getInitials } from "@/utils/getUserDisplayName";
import { getDocument, getDocuments } from "@/lib/firebase/firestore";

export const BattleLeaderboard = () => {
  const { data: rankings, isLoading } = useQuery({
    queryKey: ["battle-leaderboard"],
    queryFn: async () => {
      const data = await getDocuments<{
        id: string;
        user_id: string;
        rank_points: number;
        total_matches: number;
        wins: number;
        total_xp_earned: number;
      }>("battle_rankings", [], "rank_points", "desc", 20);

      const rankingsWithProfiles = await Promise.all(
        data.map(async (ranking) => {
          const profile = await getDocument<{ email?: string; onboarding_data?: any }>(
            "profiles",
            ranking.user_id
          );

          return {
            ...ranking,
            profiles: profile || {},
          } as any;
        })
      );

      return rankingsWithProfiles || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
      </Card>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Rankings Yet</h3>
        <p className="text-sm text-muted-foreground">
          Be the first to compete and climb the leaderboard!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rankings.map((player: any, index: number) => {
        const rank = index + 1;
        const winRate = player.total_matches > 0 
          ? Math.round((player.wins / player.total_matches) * 100) 
          : 0;

        return (
          <Card
            key={player.id}
            className={`p-4 ${
              rank <= 3 ? "border-primary/50 bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="flex-shrink-0 w-12 text-center">
                {rank === 1 && (
                  <Trophy className="h-8 w-8 mx-auto text-yellow-500" />
                )}
                {rank === 2 && (
                  <Medal className="h-8 w-8 mx-auto text-gray-400" />
                )}
                {rank === 3 && (
                  <Medal className="h-8 w-8 mx-auto text-orange-500" />
                )}
                {rank > 3 && (
                  <span className="text-2xl font-bold text-muted-foreground">
                    #{rank}
                  </span>
                )}
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(getUserDisplayName(player.profiles))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold truncate">
                    {getUserDisplayName(player.profiles)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{player.total_matches} matches</span>
                  <span>•</span>
                  <span>{player.wins}W-{player.total_matches - player.wins}L</span>
                  <span>•</span>
                  <span>{winRate}% WR</span>
                </div>
              </div>

              {/* Rating */}
              <div className="text-right">
                <Badge variant="secondary" className="font-bold">
                  {player.rank_points} pts
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {player.total_xp_earned} XP
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
