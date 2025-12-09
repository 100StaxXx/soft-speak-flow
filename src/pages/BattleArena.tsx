import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Sparkles, Trophy, Shield, Swords } from "lucide-react";
import { CosmicCodex, EncounterHistory, MiniGameTester } from "@/components/astral-encounters";
import { useAstralEncounters } from "@/hooks/useAstralEncounters";
import { useCompanion } from "@/hooks/useCompanion";
export default function BattleArena() {
  const {
    encounters = [],
    essences = [],
    codexEntries = [],
    totalStatBoosts,
    isLoading,
  } = useAstralEncounters();
  const { companion } = useCompanion();
  
  const companionStats = companion ? {
    mind: companion.mind ?? 10,
    body: companion.body ?? 10,
    soul: companion.soul ?? 10,
  } : undefined;
  const completedEncounters = encounters.filter(encounter => encounter.completed_at);
  const victories = completedEncounters.filter(encounter => encounter.result !== "fail").length;
  const recentEncounter = completedEncounters[0];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-gradient-to-br from-primary/15 via-background to-accent/10 p-6 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Astral Encounters</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Face astral adversaries, absorb their essences, and strengthen your companion.
          </p>
        </div>

        <div className="p-4 max-w-5xl mx-auto space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wide">Essences</span>
              </div>
              <p className="text-3xl font-bold">{essences.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Power fragments absorbed</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
              <div className="flex items-center gap-2 text-accent-foreground mb-2">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wide">Victories</span>
              </div>
              <p className="text-3xl font-bold">{victories}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Out of {completedEncounters.length} completed encounters
              </p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-foreground/5 to-background border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wide">Last adversary</span>
              </div>
              {recentEncounter ? (
                <>
                  <p className="text-lg font-semibold">{recentEncounter.adversary_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {recentEncounter.adversary_tier} • {recentEncounter.result}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No encounters yet</p>
              )}
            </Card>
          </div>

          <MiniGameTester companionStats={companionStats} />

          <div className="grid gap-6 lg:grid-cols-2">
            <CosmicCodex
              codexEntries={codexEntries}
              essences={essences}
              totalStatBoosts={totalStatBoosts}
              isLoading={isLoading}
            />
            <EncounterHistory encounters={encounters} />
          </div>
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
}
