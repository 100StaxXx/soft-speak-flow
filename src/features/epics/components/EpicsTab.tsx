import { useState } from "react";
import { JourneyCard } from "@/components/JourneyCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { useEpics } from "@/hooks/useEpics";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Plus, Compass, Sparkles, Map } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

export function EpicsTab() {
  const { activeEpics, completedEpics, isLoading, createEpic, isCreating, updateEpicStatus } = useEpics();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showTemplatesFirst, setShowTemplatesFirst] = useState(false);
  const [joinEpicDialogOpen, setJoinEpicDialogOpen] = useState(false);
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('epics');

  const hasCampaigns = activeEpics.length > 0 || completedEpics.length > 0;

  const handleAddCampaign = () => {
    setShowTemplatesFirst(false);
    setWizardOpen(true);
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Empty State - Fun & Inviting */}
          {!hasCampaigns && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <GlassCard variant="hero" className="p-8 text-center relative overflow-hidden">
                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-primary/30"
                      initial={{ 
                        x: Math.random() * 100 + "%", 
                        y: "100%",
                        opacity: 0 
                      }}
                      animate={{ 
                        y: "-20%",
                        opacity: [0, 0.6, 0],
                      }}
                      transition={{
                        duration: 4 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.8,
                        ease: "easeOut"
                      }}
                    />
                  ))}
                </div>

                {/* Icon cluster */}
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <Map className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 text-primary/60" />
                    <Sparkles className="absolute bottom-0 left-0 w-5 h-5 text-stardust-gold/60" />
                    <Sparkles className="absolute bottom-0 right-0 w-5 h-5 text-celestial-blue/60" />
                  </motion.div>
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center backdrop-blur-sm border border-primary/20">
                      <Compass className="w-8 h-8 text-primary" />
                    </div>
                  </motion.div>
                </div>

                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  Your Adventure Awaits
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start a campaign to transform your goals into an epic journey. Build habits, unlock postcards, and watch your companion grow.
                </p>

                <Button
                  onClick={handleAddCampaign}
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
                >
                  <Plus className="w-5 h-5" />
                  Start Your First Campaign
                </Button>
              </GlassCard>
            </motion.div>
          )}

          {/* Active Campaigns */}
          {activeEpics.map((epic) => (
            <JourneyCard
              key={epic.id}
              journey={epic}
              onComplete={() => updateEpicStatus({ epicId: epic.id, status: "completed" })}
              onAbandon={() => updateEpicStatus({ epicId: epic.id, status: "abandoned" })}
            />
          ))}

          {/* Completed Campaigns */}
          {completedEpics.map((epic) => (
            <JourneyCard key={epic.id} journey={epic} />
          ))}

          {/* Subtle Add Button - Only when has campaigns and under limit */}
          {hasCampaigns && activeEpics.length < 2 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddCampaign}
              className="mx-auto flex items-center justify-center w-10 h-10 rounded-full bg-muted/30 border border-border/20 text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground transition-all"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          )}
        </>
      )}

      {/* Pathfinder */}
      <Pathfinder
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreateEpic={(data) => {
          createEpic(data);
          setWizardOpen(false);
        }}
        isCreating={isCreating}
        showTemplatesFirst={showTemplatesFirst}
      />

      {/* Join Epic Dialog */}
      <JoinEpicDialog
        open={joinEpicDialogOpen}
        onOpenChange={setJoinEpicDialogOpen}
      />
      
      {/* First-time Tutorial Modal */}
      <EpicsTutorialModal open={showTutorial} onClose={dismissTutorial} />
    </div>
  );
}
