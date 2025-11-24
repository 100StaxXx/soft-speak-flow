import { Card } from "@/components/ui/card";
import { Trophy, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export const BattleHistory = () => {
  const { user } = useAuth();

  const { data: matches, isLoading } = useQuery({
    queryKey: ["battle-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("battle_participants")
        .select(`
          *,
          battle_matches (
            id,
            status,
            completed_at
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading battle history...</p>
      </Card>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Battles Yet</h3>
        <p className="text-sm text-muted-foreground">
          Your battle history will appear here after your first match
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match: any) => {
        const placement = match.placement;
        const xpEarned = match.xp_earned || 0;
        const completedAt = match.battle_matches?.completed_at;

        return (
          <Card key={match.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    placement === 1
                      ? "bg-yellow-500/20 text-yellow-500"
                      : placement === 2
                      ? "bg-gray-400/20 text-gray-400"
                      : "bg-orange-500/20 text-orange-500"
                  }`}
                >
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {placement === 1 ? "Victory!" : placement === 2 ? "2nd Place" : "3rd Place"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      +{xpEarned} XP
                    </Badge>
                  </div>
                  {completedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
