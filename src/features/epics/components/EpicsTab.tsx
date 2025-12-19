import { useState } from "react";
import { Target, Trophy, Users, Castle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EpicCard } from "@/components/EpicCard";
import { CreateEpicDialog } from "@/components/CreateEpicDialog";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { StarPathsBrowser } from "@/components/StarPathsBrowser";
import { EmptyState } from "@/components/EmptyState";
import { EpicSectionTooltip } from "@/components/EpicSectionTooltip";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { useEpics } from "@/hooks/useEpics";
import { useEpicTemplates, EpicTemplate } from "@/hooks/useEpicTemplates";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";

export function EpicsTab() {
  const { activeEpics, completedEpics, isLoading, createEpic, isCreating, updateEpicStatus } = useEpics();
  const [createEpicDialogOpen, setCreateEpicDialogOpen] = useState(false);
  const [joinEpicDialogOpen, setJoinEpicDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EpicTemplate | null>(null);
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('epics');

  const handleSelectTemplate = (template: EpicTemplate) => {
    setSelectedTemplate(template);
    setTemplatesDialogOpen(false);
    setCreateEpicDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Create Epic and Join Guild Buttons */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <div className="flex gap-2 w-full overflow-hidden">
          <Button
            onClick={() => setTemplatesDialogOpen(true)}
            className="flex-1 min-w-0 bg-gradient-to-r from-primary via-purple-600 to-primary hover:from-primary/90 hover:via-purple-600/90 hover:to-primary/90 shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60 transition-all duration-300 hover:scale-[1.02] text-sm font-bold"
          >
            <Star className="h-4 w-4 mr-1.5 flex-shrink-0" />
            Star Paths
          </Button>
          <Button
            onClick={() => setCreateEpicDialogOpen(true)}
            variant="outline"
            className="flex-1 min-w-0 h-auto py-3 text-sm font-medium"
          >
            <Castle className="h-4 w-4 mr-1.5 flex-shrink-0" />
            Create
          </Button>
          <Button
            onClick={() => setJoinEpicDialogOpen(true)}
            variant="outline"
            className="h-auto py-3 px-4 flex-shrink-0"
          >
            <Users className="w-4 h-4" />
          </Button>
        </div>
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
            onAction={() => setTemplatesDialogOpen(true)}
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
            <EpicCard
              key={epic.id}
              epic={epic}
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
            <EpicCard key={epic.id} epic={epic} />
          ))}
        </div>
      )}

      {/* Create Epic Dialog */}
      <CreateEpicDialog
        open={createEpicDialogOpen}
        onOpenChange={(open) => {
          setCreateEpicDialogOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
        onCreateEpic={(data) => {
          createEpic(data);
          setCreateEpicDialogOpen(false);
          setSelectedTemplate(null);
        }}
        isCreating={isCreating}
        template={selectedTemplate}
      />

      {/* Star Paths Dialog */}
      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Star Paths
            </DialogTitle>
          </DialogHeader>
          <StarPathsBrowser onSelectTemplate={handleSelectTemplate} />
        </DialogContent>
      </Dialog>

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
