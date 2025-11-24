import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Swords, Trophy, Users } from "lucide-react";
import { BattleMatchmaking } from "@/components/BattleMatchmaking";
import { BattleHistory } from "@/components/BattleHistory";
import { BattleLeaderboard } from "@/components/BattleLeaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BattleArena() {
  const [activeTab, setActiveTab] = useState("matchmaking");

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary/20 via-accent/10 to-background p-6 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Battle Arena</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            3-Player Card Battles • Mind/Body/Soul Combat
          </p>
        </div>

        {/* Main Content */}
        <div className="p-4 max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="matchmaking" className="gap-2">
                <Swords className="h-4 w-4" />
                Battle
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Users className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-2">
                <Trophy className="h-4 w-4" />
                Ranks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matchmaking" className="space-y-6">
              <BattleMatchmaking />
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <BattleHistory />
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <BattleLeaderboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
}
