import { useState } from "react";
import { JourneyCard } from "@/components/JourneyCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { CampaignEmptyStateModal } from "./CampaignEmptyStateModal";
import { CampaignsPageSkeleton } from "@/components/skeletons/CampaignsPageSkeleton";
import { useEpics } from "@/hooks/useEpics";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Inline skeleton for tab content */}
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 overflow-hidden animate-pulse">
                <div className="h-32 bg-muted/20" />
                <div className="p-4 space-y-3">
                  <div className="h-6 w-2/3 bg-muted/30 rounded" />
                  <div className="h-4 w-1/2 bg-muted/20 rounded" />
                  <div className="h-2 w-full bg-muted/20 rounded-full" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Full-screen empty state modal */}
            <CampaignEmptyStateModal
              open={!hasCampaigns}
              onLaunch={handleAddCampaign}
            />

            {/* Active Campaigns */}
            {activeEpics.map((epic, index) => (
              <motion.div
                key={epic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <JourneyCard
                  journey={epic}
                  onComplete={() => updateEpicStatus({ epicId: epic.id, status: "completed" })}
                  onAbandon={() => updateEpicStatus({ epicId: epic.id, status: "abandoned" })}
                />
              </motion.div>
            ))}

            {/* Completed Campaigns */}
            {completedEpics.map((epic, index) => (
              <motion.div
                key={epic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (activeEpics.length + index) * 0.05 }}
              >
                <JourneyCard journey={epic} />
              </motion.div>
            ))}

            {/* Subtle Add Button - Only when has campaigns and under limit */}
            {hasCampaigns && activeEpics.length < 2 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              onClick={handleAddCampaign}
                className="mx-auto flex items-center justify-center w-10 h-10 text-muted-foreground/50 hover:text-muted-foreground transition-all"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
