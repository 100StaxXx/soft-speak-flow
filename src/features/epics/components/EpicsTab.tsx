import { useState } from "react";
import { Target, Trophy, Users, Castle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JourneyCard } from "@/components/JourneyCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EmptyState } from "@/components/EmptyState";
import { EpicSectionTooltip } from "@/components/EpicSectionTooltip";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { PromotionOpportunitiesSection } from "@/components/PromotionOpportunitiesSection";
import { useEpics } from "@/hooks/useEpics";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";

const MAX_EPICS = 2;

export function EpicsTab() {
  const { activeEpics, completedEpics, isLoading, createEpic, isCreating, updateEpicStatus } = useEpics();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showTemplatesFirst, setShowTemplatesFirst] = useState(false);
  const [joinEpicDialogOpen, setJoinEpicDialogOpen] = useState(false);
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('epics');
  
  const hasReachedLimit = activeEpics.length >= MAX_EPICS;

  const handleOpenWizard = (templatesFirst: boolean) => {
    setShowTemplatesFirst(templatesFirst);
    setWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* AI-detected Promotion Opportunities */}
      <PromotionOpportunitiesSection maxVisible={2} compact />
      {/* Create Epic and Join Guild Buttons */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <div className="flex gap-2 w-full overflow-hidden">
          <Button
            onClick={() => handleOpenWizard(true)}
            disabled={hasReachedLimit}
            className={cn(
              "flex-1 min-w-0 text-xs font-bold",
              hasReachedLimit 
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-gradient-to-r from-primary via-purple-600 to-primary hover:from-primary/90 hover:via-purple-600/90 hover:to-primary/90 shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60 transition-all duration-300 hover:scale-[1.02]"
            )}
          >
            <Star className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
            Star Paths
          </Button>
          <Button
            onClick={() => handleOpenWizard(false)}
            variant="outline"
            disabled={hasReachedLimit}
            className="flex-1 min-w-0 h-auto py-3 text-xs font-medium"
          >
            <Castle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
            Create
          </Button>
          <Button
            onClick={() => setJoinEpicDialogOpen(true)}
            variant="outline"
            className="h-auto py-3 px-4 flex-shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
          </Button>
        </div>
        {hasReachedLimit && (
          <p className="text-xs text-amber-500 text-center mt-3">
            You can only have {MAX_EPICS} active Star Paths at a time. Complete or abandon one to start a new journey.
          </p>
        )}
      </Card>

      {/* Active Epics */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : activeEpics.length === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Active Epics
            </h3>
            <EpicSectionTooltip />
          </div>
          <EmptyState
            icon={Star}
            title="No Active Epics"
            description="Browse Star Paths to find the perfect epic quest and start your legendary journey!"
            actionLabel="Star Paths"
            onAction={() => handleOpenWizard(true)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Active Epics
            </h3>
            <EpicSectionTooltip />
          </div>
          {activeEpics.map((epic) => (
            <JourneyCard
              key={epic.id}
              journey={epic}
              onComplete={() => updateEpicStatus({ epicId: epic.id, status: "completed" })}
              onAbandon={() => updateEpicStatus({ epicId: epic.id, status: "abandoned" })}
            />
          ))}
        </div>
      )}

      {/* Completed Epics */}
      {completedEpics.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Legendary Epics
          </h3>
          {completedEpics.map((epic) => (
            <JourneyCard key={epic.id} journey={epic} />
          ))}
        </div>
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
