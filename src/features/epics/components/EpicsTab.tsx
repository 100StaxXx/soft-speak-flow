import { useState } from "react";
import { JourneyCard } from "@/components/JourneyCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { CampaignEmptyStateModal } from "./CampaignEmptyStateModal";
import { useEpics } from "@/hooks/useEpics";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

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
          {/* Full-screen empty state modal */}
          <CampaignEmptyStateModal
            open={!hasCampaigns}
            onLaunch={handleAddCampaign}
          />

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
