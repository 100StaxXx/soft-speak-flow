import { useState, type ComponentProps } from "react";

import { AddQuestSheet, type AddQuestData } from "@/components/AddQuestSheet";
import { Pathfinder } from "@/components/Pathfinder/Pathfinder";
import { Button } from "@/components/ui/button";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EditCampaignSheetPreview } from "@/pages/test-scroll/EditCampaignSheetPreview";

type VisualOverlay =
  | "pathfinder"
  | "add-quest-mobile"
  | "add-quest-desktop"
  | "edit-quest-mobile"
  | "edit-quest-desktop"
  | "edit-campaign"
  | null;

const VISUAL_TEST_DATE = new Date("2026-04-28T12:00:00");

const editQuestFixture: NonNullable<ComponentProps<typeof EditQuestDialog>["task"]> = {
  id: "test-scroll-edit-quest",
  task_text: "Draft the weekly planning ritual",
  task_date: "2026-04-28",
  difficulty: "medium",
  scheduled_time: "09:30",
  estimated_duration: 45,
  recurrence_pattern: "weekly",
  recurrence_days: [2],
  recurrence_month_days: [],
  recurrence_custom_period: "week",
  reminder_enabled: true,
  reminder_minutes_before: 15,
  category: "mind",
  notes: "Local-only fixture for visual QA.",
  habit_source_id: null,
  image_url: null,
  attachments: [],
  location: "Library reading room",
};

const TestScroll = () => {
  const [activeOverlay, setActiveOverlay] = useState<VisualOverlay>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingQuest, setIsAddingQuest] = useState(false);
  const [isSavingQuest, setIsSavingQuest] = useState(false);

  const handleCreateEpic = (data: unknown) => {
    console.log("Epic created (mock):", data);
    setIsCreating(true);
    setTimeout(() => {
      setIsCreating(false);
      setActiveOverlay(null);
    }, 1000);
  };

  const handleAddQuest = async (data: AddQuestData) => {
    console.log("Quest added (mock):", data);
    setIsAddingQuest(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setIsAddingQuest(false);
    setActiveOverlay(null);
  };

  const handleSaveQuest: ComponentProps<typeof EditQuestDialog>["onSave"] = async (taskId, updates) => {
    console.log("Quest saved (mock):", { taskId, updates });
    setIsSavingQuest(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setIsSavingQuest(false);
    setActiveOverlay(null);
  };

  const handleDeleteQuest = async (taskId: string) => {
    console.log("Quest deleted (mock):", taskId);
    setActiveOverlay(null);
  };

  const setOverlayOpen = (overlay: Exclude<VisualOverlay, null>) => (open: boolean) => {
    setActiveOverlay(open ? overlay : null);
  };

  return (
    <div className="min-h-screen bg-background p-6 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Planner Editor Visual QA</h1>
          <p className="text-muted-foreground">
            This page bypasses authentication for local visual checks. Quest and campaign actions use mock or local-only
            fixture handlers.
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => setActiveOverlay("pathfinder")} className="w-full">
              Open Pathfinder Modal
            </Button>
            <Button onClick={() => setActiveOverlay("edit-campaign")} variant="outline" className="w-full">
              Open Edit Campaign Sheet
            </Button>
            <Button onClick={() => setActiveOverlay("add-quest-mobile")} variant="outline" className="w-full">
              Open Add Quest Mobile Sheet
            </Button>
            <Button onClick={() => setActiveOverlay("add-quest-desktop")} variant="outline" className="w-full">
              Open Add Quest Desktop Panel
            </Button>
            <Button onClick={() => setActiveOverlay("edit-quest-mobile")} variant="outline" className="w-full">
              Open Edit Quest Mobile Sheet
            </Button>
            <Button onClick={() => setActiveOverlay("edit-quest-desktop")} variant="outline" className="w-full">
              Open Edit Quest Desktop Panel
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Active preview: {activeOverlay ?? "none"}
        </p>

        <Pathfinder
          open={activeOverlay === "pathfinder"}
          onOpenChange={setOverlayOpen("pathfinder")}
          onCreateEpic={handleCreateEpic}
          isCreating={isCreating}
        />

        <AddQuestSheet
          open={activeOverlay === "add-quest-mobile"}
          onOpenChange={setOverlayOpen("add-quest-mobile")}
          selectedDate={VISUAL_TEST_DATE}
          prefilledTime="09:00"
          onAdd={handleAddQuest}
          isAdding={isAddingQuest}
          onCreateCampaign={() => setActiveOverlay("pathfinder")}
        />

        <AddQuestSheet
          open={activeOverlay === "add-quest-desktop"}
          onOpenChange={setOverlayOpen("add-quest-desktop")}
          selectedDate={VISUAL_TEST_DATE}
          prefilledTime="09:00"
          presentation="desktop-panel"
          onAdd={handleAddQuest}
          isAdding={isAddingQuest}
          onCreateCampaign={() => setActiveOverlay("pathfinder")}
        />

        <EditQuestDialog
          task={editQuestFixture}
          open={activeOverlay === "edit-quest-mobile"}
          onOpenChange={setOverlayOpen("edit-quest-mobile")}
          onSave={handleSaveQuest}
          isSaving={isSavingQuest}
          onDelete={handleDeleteQuest}
          plannerSubtaskDraft={["Pick one focus block", "Review the warm editor footer"]}
        />

        <EditQuestDialog
          task={editQuestFixture}
          open={activeOverlay === "edit-quest-desktop"}
          onOpenChange={setOverlayOpen("edit-quest-desktop")}
          onSave={handleSaveQuest}
          isSaving={isSavingQuest}
          onDelete={handleDeleteQuest}
          presentation="desktop-panel"
          plannerSubtaskDraft={["Pick one focus block", "Review the warm editor footer"]}
        />

        <EditCampaignSheetPreview
          open={activeOverlay === "edit-campaign"}
          onOpenChange={setOverlayOpen("edit-campaign")}
        />
      </div>
    </div>
  );
};

export default TestScroll;
