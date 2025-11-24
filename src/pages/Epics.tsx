import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EpicCard } from "@/components/EpicCard";
import { CreateEpicDialog } from "@/components/CreateEpicDialog";
import { useEpics } from "@/hooks/useEpics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Target, Trophy, Plus, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";

// Discord server invite URL - update this with your actual Discord invite
const DISCORD_GUILD_URL = "https://discord.gg/yourserverinvite";

const Epics = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { user } = useAuth();
  const {
    activeEpics,
    completedEpics,
    isLoading,
    createEpic,
    isCreating,
    updateEpicStatus,
  } = useEpics();

  const handleCreateEpic = (data: {
    title: string;
    description?: string;
    target_days: number;
    habits: Array<{
      title: string;
      difficulty: string;
      frequency: string;
      custom_days: number[];
    }>;
  }) => {
    createEpic(data);
    setCreateDialogOpen(false);
  };

  return (
    <PageTransition>
      <div className="min-h-screen pb-24 pt-6 px-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 mb-3 bg-gradient-to-r from-primary/20 to-purple-500/20 px-4 py-2 rounded-full">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Legendary Quests</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Your Epics
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Embark on legendary journeys. Link your daily habits to conquer epic goals!
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex gap-3"
        >
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 h-14 text-lg"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Epic
          </Button>
          
          <Button
            onClick={() => window.open(DISCORD_GUILD_URL, '_blank')}
            variant="outline"
            className="h-14 px-6 border-2 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10"
            size="lg"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 71 55" fill="currentColor">
              <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
            </svg>
            Join Guild
          </Button>
        </motion.div>

        {/* Epics Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Active ({activeEpics.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Legendary ({completedEpics.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : activeEpics.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-secondary/20 rounded-lg border-2 border-dashed border-primary/20"
              >
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Active Epics</h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  Begin your first legendary quest! Create an epic and link your habits to track progress.
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Epic
                </Button>
              </motion.div>
            ) : (
              activeEpics.map((epic) => (
                <EpicCard
                  key={epic.id}
                  epic={epic}
                  onComplete={() =>
                    updateEpicStatus({ epicId: epic.id, status: "completed" })
                  }
                  onAbandon={() =>
                    updateEpicStatus({ epicId: epic.id, status: "abandoned" })
                  }
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedEpics.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-secondary/20 rounded-lg border-2 border-dashed border-primary/20"
              >
                <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Legendary Epics Yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Complete your first epic to earn this legendary status and massive XP rewards!
                </p>
              </motion.div>
            ) : (
              completedEpics.map((epic) => <EpicCard key={epic.id} epic={epic} />)
            )}
          </TabsContent>
        </Tabs>

        {/* Create Epic Dialog */}
        <CreateEpicDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreateEpic={handleCreateEpic}
          isCreating={isCreating}
        />
      </div>

      <BottomNav />
    </PageTransition>
  );
};

export default Epics;
