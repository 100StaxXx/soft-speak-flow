import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EpicCard } from "@/components/EpicCard";
import { CreateEpicDialog } from "@/components/CreateEpicDialog";
import { Pathfinder } from "@/components/Pathfinder";
import { useEpics } from "@/hooks/useEpics";
import { Target, Trophy, Plus, Sparkles, Users, ChevronRight, Wand2 } from "lucide-react";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import { motion } from "framer-motion";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { StarPathsBrowser } from "@/components/StarPathsBrowser";
import { EpicTemplate } from "@/hooks/useEpicTemplates";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { EpicsPageSkeleton } from "@/components/skeletons/EpicsPageSkeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Epics = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [smartWizardOpen, setSmartWizardOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EpicTemplate | null>(null);
  const {
    activeEpics,
    completedEpics,
    isLoading,
    createEpic,
    isCreating,
    updateEpicStatus,
  } = useEpics();

  const MAX_EPICS = 2;
  const hasReachedLimit = activeEpics.length >= MAX_EPICS;

  const handleCreateEpic = (data: {
    title: string;
    description?: string;
    target_days: number;
    story_type_slug?: StoryTypeSlug;
    habits: Array<{
      title: string;
      difficulty: string;
      frequency: string;
      custom_days: number[];
    }>;
  }) => {
    createEpic(data);
    setCreateDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handleSelectTemplate = (template: EpicTemplate) => {
    setSelectedTemplate(template);
    setTemplatesDialogOpen(false);
    setCreateDialogOpen(true);
  };

  if (isLoading) {
    return (
      <PageTransition>
        <StarfieldBackground />
        <EpicsPageSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center relative"
        >
          <PageInfoButton 
            onClick={() => setShowPageInfo(true)} 
            className="absolute right-0 top-0"
          />
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
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <Button
            onClick={() => setJoinDialogOpen(true)}
            variant="outline"
            className="h-12"
          >
            <Users className="w-4 h-4 mr-2" />
            Join Guild
          </Button>
          <Button
            onClick={() => setTemplatesDialogOpen(true)}
            variant="outline"
            className="h-12"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Star Paths
          </Button>
        </motion.div>

        {/* Create Epic Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-6 space-y-3"
        >
          {hasReachedLimit ? (
            <div className="w-full h-14 flex items-center justify-center bg-secondary/30 rounded-lg border border-border/50 text-muted-foreground text-sm">
              You can only have {MAX_EPICS} active epics at a time
            </div>
          ) : (
            <>
              {/* Smart Epic Wizard - Primary CTA */}
              <Button
                onClick={() => setSmartWizardOpen(true)}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 h-14 text-lg"
                size="lg"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Create Smart Epic
              </Button>
              
              {/* Manual create option */}
              <Button
                onClick={() => {
                  setSelectedTemplate(null);
                  setCreateDialogOpen(true);
                }}
                variant="outline"
                className="w-full h-12"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Epic
              </Button>
            </>
          )}
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
            {activeEpics.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-secondary/20 rounded-lg border-2 border-dashed border-primary/20"
              >
                <Sparkles className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-semibold mb-2">No Active Epics</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Begin your first legendary quest! Discover guided paths designed to help you build powerful habits and achieve your goals.
                </p>
                <Button
                  onClick={() => setTemplatesDialogOpen(true)}
                  className="bg-gradient-to-r from-amber-500 via-purple-500 to-pink-500 hover:from-amber-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-8 text-base font-semibold"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Explore Star Paths
                  <ChevronRight className="w-5 h-5 ml-2" />
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

        {/* Pathfinder */}
        <Pathfinder
          open={smartWizardOpen}
          onOpenChange={setSmartWizardOpen}
          onCreateEpic={(data) => {
            createEpic(data);
            setSmartWizardOpen(false);
          }}
          isCreating={isCreating}
        />

        {/* Create Epic Dialog */}
        <CreateEpicDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreateEpic={handleCreateEpic}
          isCreating={isCreating}
          template={selectedTemplate}
        />
        
        {/* Join Epic Dialog */}
        <JoinEpicDialog
          open={joinDialogOpen}
          onOpenChange={setJoinDialogOpen}
        />

        {/* Star Paths Browser Dialog */}
        <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Star Paths
              </DialogTitle>
            </DialogHeader>
            <StarPathsBrowser onSelectTemplate={handleSelectTemplate} />
          </DialogContent>
        </Dialog>
        
        <PageInfoModal
          open={showPageInfo}
          onClose={() => setShowPageInfo(false)}
          title="About Epics"
          icon={Target}
          description="Epics are long-term goals that link your daily habits together for massive growth."
          features={[
            "Create epics with target completion days",
            "Link habits to track progress automatically",
            "Join guilds to work toward goals with others",
            "Compete with rivals and send shouts to motivate",
            "Earn bonus XP for completing epic-linked habits"
          ]}
          tip="Try a template like 'Detox Warrior' for a dopamine detox challenge with pre-built habits!"
        />
      </div>

    </PageTransition>
  );
};

export default Epics;
