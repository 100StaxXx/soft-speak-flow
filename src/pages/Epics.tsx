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
import { Target, Trophy, Plus, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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

  // Fetch user's habits for linking
  const { data: habits = [] } = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("habits")
        .select("id, title, difficulty")
        .eq("user_id", user.id)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!user,
  });

  const handleCreateEpic = (data: {
    title: string;
    description?: string;
    target_days: number;
    habit_ids: string[];
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

        {/* Create Epic Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 h-14 text-lg"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Epic
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
          availableHabits={habits}
          isCreating={isCreating}
        />
      </div>

      <BottomNav />
    </PageTransition>
  );
};

export default Epics;
