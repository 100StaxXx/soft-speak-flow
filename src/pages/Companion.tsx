import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { Card } from "@/components/ui/card";
import { useCompanion } from "@/hooks/useCompanion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/PageTransition";
import { Trophy, TrendingUp } from "lucide-react";

export default function Companion() {
  const { companion } = useCompanion();

  const { data: evolutions = [] } = useQuery({
    queryKey: ["companion-evolutions", companion?.id],
    queryFn: async () => {
      if (!companion) return [];
      
      const { data, error } = await supabase
        .from("companion_evolutions")
        .select("*")
        .eq("companion_id", companion.id)
        .order("stage", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!companion,
  });

  const { data: recentXP = [] } = useQuery({
    queryKey: ["recent-xp", companion?.id],
    queryFn: async () => {
      if (!companion) return [];
      
      const { data, error } = await supabase
        .from("xp_events")
        .select("*")
        .eq("companion_id", companion.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!companion,
  });

  if (!companion) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center pb-24">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No companion found</p>
            <p className="text-sm">Complete onboarding to create your companion</p>
          </div>
        </div>
        <BottomNav />
      </PageTransition>
    );
  }

  return (
    <>
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24">
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2">
                Your Companion
              </h1>
              <p className="text-muted-foreground">Watch your companion grow with every achievement</p>
            </div>

            <CompanionDisplay />

            {/* Evolution Gallery */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Evolution Journey
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {evolutions.map((evo) => (
                  <div key={evo.id} className="space-y-2">
                    <div className="relative rounded-lg overflow-hidden border-2 border-border">
                      <img
                        src={evo.image_url}
                        alt={`Stage ${evo.stage}`}
                        className="w-full aspect-square object-cover"
                      />
                      {evo.stage === companion.current_stage && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                          Current
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-center">
                      Stage {evo.stage}
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      {evo.xp_at_evolution} XP
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent XP Activity */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Recent Activity
              </h2>
              <div className="space-y-3">
                {recentXP.map((event) => (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium capitalize">
                        {event.event_type.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-primary font-bold">
                      +{event.xp_earned} XP
                    </div>
                  </div>
                ))}
                {recentXP.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No recent activity
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>
      <BottomNav />
    </>
  );
}