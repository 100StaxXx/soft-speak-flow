import { useState } from "react";
import { JourneyCard } from "@/components/JourneyCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { useEpics } from "@/hooks/useEpics";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Plus, Compass, Sparkles, Rocket, ChevronRight } from "lucide-react";
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

                {/* Cosmic Compass Icon */}
                <motion.div 
                  className="relative mx-auto w-20 h-20 mb-6"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 via-purple-500/30 to-pink-500/20 blur-xl" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center backdrop-blur-sm border border-primary/30 shadow-lg shadow-primary/20">
                    <Compass className="w-9 h-9 text-primary" />
                  </div>
                </motion.div>

                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  Your Adventure Awaits
                </h3>
                <p className="text-muted-foreground mb-5 max-w-sm mx-auto">
                  Transform your goals into an epic journey. Build habits, unlock postcards, and watch your companion grow.
                </p>

                {/* Drag-to-Launch CTA */}
                <div className="relative w-64 mx-auto">
                  <div className="relative h-12 rounded-full bg-gradient-to-r from-muted/50 via-primary/10 to-primary/30 border border-primary/20 overflow-hidden">
                    {/* Shimmer hint */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    
                    {/* Draggable rocket */}
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 160 }}
                      dragElastic={0.1}
                      onDragEnd={(_, info) => {
                        if (info.offset.x > 120) handleAddCampaign();
                      }}
                      whileDrag={{ scale: 1.15 }}
                      whileHover={{ scale: 1.05 }}
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-primary/40 z-10"
                    >
                      <Rocket className="w-5 h-5 text-white rotate-90" />
                    </motion.div>
                    
                    {/* Destination sparkles */}
                    <motion.div 
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary/50"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ChevronRight className="w-4 h-4" />
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground/50 text-center mt-2">
                    Drag to launch your adventure
                  </p>
                </div>

                {/* Tap fallback for accessibility */}
                <button 
                  onClick={handleAddCampaign}
                  className="mt-3 text-xs text-muted-foreground/40 hover:text-primary/60 transition-colors"
                >
                  or tap here
                </button>
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
