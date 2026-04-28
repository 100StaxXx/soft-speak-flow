import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Pencil, Plus, Repeat, Target, Trash2, Wand2 } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { EditRitualSheet, type RitualData } from "@/components/EditRitualSheet";
import { RescheduleDrawer } from "@/components/RescheduleDrawer";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { DIFFICULTY_COLORS } from "@/components/quest-shared";
import { useAuth } from "@/hooks/useAuth";
import { useEpics } from "@/hooks/useEpics";
import { supabase } from "@/integrations/supabase/client";
import { resolveEpicEndDate } from "@/utils/epicDates";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type CampaignHabit = {
  habit_id: string;
  habits: {
    id: string;
    title: string;
    difficulty: string;
    description?: string | null;
    frequency?: string | null;
    estimated_minutes?: number | null;
    preferred_time?: string | null;
    custom_days?: number[] | null;
    custom_month_days?: number[] | null;
    category?: "mind" | "body" | "soul" | null;
  } | null;
};

type EditCampaignSheetEpic = {
  id: string;
  title: string;
  description?: string | null;
  target_days: number;
  start_date: string;
  end_date: string | null;
  status?: string;
  epic_habits?: CampaignHabit[] | null;
};

interface EditCampaignSheetProps {
  epic: EditCampaignSheetEpic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

type EditCampaignSheetDependencies = {
  activeEpics: EditCampaignSheetEpic[];
  updateEpic: (params: {
    epicId: string;
    updates: {
      title: string;
      description: string | null;
    };
  }) => Promise<void>;
  deleteEpic: (params: { epicId: string }) => Promise<void>;
  createCampaignRitual: (params: {
    epicId: string;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    frequency: string;
    customDays: number[];
  }) => Promise<void>;
  deleteRitual: (habitId: string) => Promise<boolean>;
};

interface EditCampaignSheetFrameProps extends EditCampaignSheetProps {
  dependencies: EditCampaignSheetDependencies;
  visualPreview?: boolean;
}

const DEFAULT_RITUAL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const createPreviewCampaignEpic = (): EditCampaignSheetEpic => ({
  id: "test-scroll-campaign-preview",
  title: "Companion Planner Sprint",
  description: "A local-only visual fixture for checking the warm campaign editor shell.",
  target_days: 30,
  start_date: "2026-04-01",
  end_date: "2026-04-30",
  status: "active",
  epic_habits: [
    {
      habit_id: "test-scroll-ritual-focus",
      habits: {
        id: "test-scroll-ritual-focus",
        title: "Morning focus ritual",
        description: "Open the day with one intentional planning block.",
        difficulty: "medium",
        frequency: "daily",
        custom_days: [],
        custom_month_days: null,
        preferred_time: "08:30",
        estimated_minutes: 25,
        category: "mind",
      },
    },
    {
      habit_id: "test-scroll-ritual-review",
      habits: {
        id: "test-scroll-ritual-review",
        title: "Evening review",
        description: "Close the loop and choose tomorrow's first move.",
        difficulty: "easy",
        frequency: "custom",
        custom_days: [1, 3, 5],
        custom_month_days: null,
        preferred_time: "18:00",
        estimated_minutes: 15,
        category: "soul",
      },
    },
  ],
});

export function EditCampaignSheet({
  epic,
  open,
  onOpenChange,
  onDeleted,
}: EditCampaignSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    activeEpics,
    updateEpic,
    deleteEpic,
    createCampaignRitual,
  } = useEpics();

  const deleteRitual = async (habitId: string) => {
    if (!user?.id) return false;

    const { error: habitError } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", user.id);

    if (habitError) throw habitError;

    const { error: tasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("habit_source_id", habitId)
      .eq("user_id", user.id)
      .eq("completed", false);

    if (tasksError) {
      console.error("Error deleting linked tasks:", tasksError);
    }

    queryClient.invalidateQueries({ queryKey: ["habits"] });
    queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["epics"] });

    return true;
  };

  return (
    <EditCampaignSheetFrame
      epic={epic}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      dependencies={{
        activeEpics,
        updateEpic,
        deleteEpic,
        createCampaignRitual,
        deleteRitual,
      }}
    />
  );
}

export function EditCampaignSheetPreview({
  open,
  onOpenChange,
}: Pick<EditCampaignSheetProps, "open" | "onOpenChange">) {
  const [previewEpic, setPreviewEpic] = useState<EditCampaignSheetEpic>(() => createPreviewCampaignEpic());

  useEffect(() => {
    if (open && !previewEpic) {
      setPreviewEpic(createPreviewCampaignEpic());
    }
  }, [open, previewEpic]);

  const previewDependencies = useMemo<EditCampaignSheetDependencies>(() => ({
    activeEpics: previewEpic ? [previewEpic] : [],
    updateEpic: async ({ updates }) => {
      setPreviewEpic((current) => current
        ? {
          ...current,
          title: updates.title,
          description: updates.description,
        }
        : current);
    },
    deleteEpic: async () => {
      setPreviewEpic(null);
    },
    createCampaignRitual: async ({ title, difficulty, frequency, customDays }) => {
      setPreviewEpic((current) => {
        if (!current) return current;

        const ritualId = `test-scroll-ritual-${Date.now()}`;
        return {
          ...current,
          epic_habits: [
            ...(current.epic_habits ?? []),
            {
              habit_id: ritualId,
              habits: {
                id: ritualId,
                title,
                description: "Local-only preview ritual.",
                difficulty,
                frequency,
                custom_days: customDays,
                custom_month_days: null,
                preferred_time: null,
                estimated_minutes: 20,
                category: "mind",
              },
            },
          ],
        };
      });
    },
    deleteRitual: async (habitId) => {
      setPreviewEpic((current) => current
        ? {
          ...current,
          epic_habits: (current.epic_habits ?? []).filter((link) => link.habit_id !== habitId),
        }
        : current);

      return true;
    },
  }), [previewEpic]);

  return (
    <EditCampaignSheetFrame
      epic={previewEpic}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={() => setPreviewEpic(createPreviewCampaignEpic())}
      dependencies={previewDependencies}
      visualPreview
    />
  );
}

function EditCampaignSheetFrame({
  epic,
  open,
  onOpenChange,
  onDeleted,
  dependencies,
  visualPreview = false,
}: EditCampaignSheetFrameProps) {
  const currentEpic = useMemo(
    () => dependencies.activeEpics.find((candidate) => candidate.id === epic?.id) ?? epic,
    [dependencies.activeEpics, epic],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingRitual, setEditingRitual] = useState<RitualData | null>(null);
  const [isDeletingRitual, setIsDeletingRitual] = useState(false);
  const [showAddRitual, setShowAddRitual] = useState(false);
  const [newRitualTitle, setNewRitualTitle] = useState("");
  const [newRitualDifficulty, setNewRitualDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newRitualDays, setNewRitualDays] = useState<number[]>(DEFAULT_RITUAL_DAYS);
  const [isAddingRitual, setIsAddingRitual] = useState(false);

  useEffect(() => {
    if (!open || !currentEpic) return;
    setTitle(currentEpic.title);
    setDescription(currentEpic.description ?? "");
  }, [currentEpic, open]);

  useEffect(() => {
    if (!open) {
      setEditingRitual(null);
      setShowDeleteConfirm(false);
      setShowAddRitual(false);
      setNewRitualTitle("");
      setNewRitualDifficulty("medium");
      setNewRitualDays(DEFAULT_RITUAL_DAYS);
      setIsSaving(false);
      setIsDeletingCampaign(false);
      setIsDeletingRitual(false);
      setIsAddingRitual(false);
    }
  }, [open]);

  const resolvedEndDate = useMemo(
    () => (currentEpic ? resolveEpicEndDate(currentEpic) : null),
    [currentEpic],
  );

  const rituals = useMemo(
    () =>
      (currentEpic?.epic_habits ?? [])
        .filter((link): link is CampaignHabit & { habits: NonNullable<CampaignHabit["habits"]> } => Boolean(link.habits))
        .map((link) => link.habits),
    [currentEpic],
  );

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const normalizedCurrentDescription = currentEpic?.description?.trim() ?? "";
  const hasChanges = Boolean(
    currentEpic
    && (
      trimmedTitle !== currentEpic.title
      || trimmedDescription !== normalizedCurrentDescription
    ),
  );

  const handleSave = async () => {
    if (!currentEpic || !trimmedTitle || !hasChanges) return;

    setIsSaving(true);
    try {
      await dependencies.updateEpic({
        epicId: currentEpic.id,
        updates: {
          title: trimmedTitle,
          description: trimmedDescription.length > 0 ? trimmedDescription : null,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!currentEpic) return;

    setIsDeletingCampaign(true);
    try {
      await dependencies.deleteEpic({ epicId: currentEpic.id });
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleDeleteRitual = async (habitId: string) => {
    setIsDeletingRitual(true);
    try {
      const didDelete = await dependencies.deleteRitual(habitId);
      if (didDelete) {
        toast.success("Ritual deleted");
      }
    } catch (error) {
      console.error("Error deleting ritual:", error);
      toast.error("Failed to delete ritual");
    } finally {
      setIsDeletingRitual(false);
      setEditingRitual(null);
    }
  };

  const handleAddRitual = async () => {
    if (!currentEpic || !newRitualTitle.trim()) return;

    setIsAddingRitual(true);
    try {
      await dependencies.createCampaignRitual({
        epicId: currentEpic.id,
        title: newRitualTitle.trim(),
        difficulty: newRitualDifficulty,
        frequency: newRitualDays.length === 7 ? "daily" : "custom",
        customDays: newRitualDays.length === 7 ? [] : newRitualDays,
      });
      setNewRitualTitle("");
      setNewRitualDifficulty("medium");
      setNewRitualDays(DEFAULT_RITUAL_DAYS);
      setShowAddRitual(false);
    } finally {
      setIsAddingRitual(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            plannerPathfinderTheme.shell,
            "fixed flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden rounded-t-[2.25rem] px-0 pb-0",
          )}
          data-testid="edit-campaign-sheet-shell"
        >
          <div className={plannerPathfinderTheme.shellGloss} />
          <div className={plannerPathfinderTheme.shellGlow} />

          <SheetHeader className="relative z-10 px-4 pt-4 sm:px-5 sm:pt-5">
            <div className={plannerPathfinderTheme.headerBar}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#b04b12] shadow-[0_5px_0_rgba(77,40,17,0.45)]">
                <Pencil className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-xl text-white">
                  Edit Campaign
                </SheetTitle>
                <SheetDescription className="text-sm text-white/[0.68]">
                  Update campaign details, manage linked rituals, or permanently delete this campaign.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className={cn("relative z-10 mx-4 mt-3 min-h-0 flex-1 rounded-[2rem] border-[4px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.9),rgba(255,216,128,0.82))] shadow-[0_12px_0_rgba(77,40,17,0.84)] sm:mx-5")}>
            <div className="space-y-5 px-4 py-4 text-[#4f240c] sm:px-5" data-vaul-no-drag>
              <section className={cn(plannerPathfinderTheme.raisedPanel, "space-y-4 p-4")}>
                <div className="space-y-2">
                  <Label htmlFor="campaign-title" className="text-[#5d2a0f]">Campaign name</Label>
                  <Input
                    id="campaign-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Name your campaign"
                    className={plannerPathfinderTheme.textField}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-description" className="text-[#5d2a0f]">Description</Label>
                  <Textarea
                    id="campaign-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What is this campaign about?"
                    rows={4}
                    className={plannerPathfinderTheme.textField}
                  />
                </div>
              </section>

              <section className={cn(plannerPathfinderTheme.mutedPanel, "space-y-3 p-4")}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#8d481c]" />
                  <h3 className="text-sm font-semibold">Timeline</h3>
                </div>
                <p className="text-sm text-[#7f4a1d]/80">
                  {resolvedEndDate
                    ? `Deadline: ${new Date(resolvedEndDate).toLocaleDateString()}`
                    : "No deadline is set for this campaign yet."}
                </p>
                {currentEpic && resolvedEndDate ? (
                  visualPreview ? (
                    <Button type="button" variant="outline" className={cn(plannerPathfinderTheme.outlineButton, "gap-2")}>
                      <Wand2 className="h-4 w-4" />
                      Adjust timeline
                    </Button>
                  ) : (
                    <RescheduleDrawer
                      epicId={currentEpic.id}
                      epicTitle={currentEpic.title}
                      epicGoal={currentEpic.description ?? undefined}
                      currentDeadline={resolvedEndDate}
                    >
                      <Button type="button" variant="outline" className={cn(plannerPathfinderTheme.outlineButton, "gap-2")}>
                        <Wand2 className="h-4 w-4" />
                        Adjust timeline
                      </Button>
                    </RescheduleDrawer>
                  )
                ) : null}
              </section>

              <section className={cn(plannerPathfinderTheme.raisedPanel, "space-y-4 p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-[#8d481c]" />
                    <h3 className="text-sm font-semibold">Rituals</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(plannerPathfinderTheme.outlineButton, "gap-2")}
                    onClick={() => setShowAddRitual((current) => !current)}
                  >
                    <Plus className="h-4 w-4" />
                    Add ritual
                  </Button>
                </div>

                {showAddRitual ? (
                  <div className={cn(plannerPathfinderTheme.mutedPanel, "space-y-4 border-dashed p-4")}>
                    <div className="space-y-2">
                      <Label htmlFor="new-ritual-title" className="text-[#5d2a0f]">Ritual name</Label>
                      <Input
                        id="new-ritual-title"
                        value={newRitualTitle}
                        onChange={(event) => setNewRitualTitle(event.target.value)}
                        placeholder="Add a campaign ritual"
                        className={plannerPathfinderTheme.textField}
                      />
                    </div>
                    <HabitDifficultySelector
                      value={newRitualDifficulty}
                      onChange={setNewRitualDifficulty}
                      variant="planner"
                    />
                    <FrequencyPicker
                      selectedDays={newRitualDays}
                      onDaysChange={setNewRitualDays}
                      variant="quest-soft"
                      activeTone={DIFFICULTY_COLORS.medium.pill}
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className={cn(plannerPathfinderTheme.primaryButton, "gap-2")}
                        disabled={isAddingRitual || newRitualTitle.trim().length === 0 || newRitualDays.length === 0}
                        onClick={handleAddRitual}
                      >
                        {isAddingRitual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Save ritual
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isAddingRitual}
                        className="text-[#6b3416] hover:bg-white/55 hover:text-[#4f240c]"
                        onClick={() => {
                          setShowAddRitual(false);
                          setNewRitualTitle("");
                          setNewRitualDifficulty("medium");
                          setNewRitualDays(DEFAULT_RITUAL_DAYS);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {rituals.length > 0 ? (
                  <div className="space-y-3">
                    {rituals.map((ritual) => (
                      <button
                        key={ritual.id}
                        type="button"
                        className={cn(
                          plannerPathfinderTheme.mutedPanel,
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-transform hover:-translate-y-0.5 hover:bg-white/75",
                        )}
                        onClick={() => {
                          if (visualPreview) return;

                          setEditingRitual({
                            habitId: ritual.id,
                            title: ritual.title,
                            description: ritual.description ?? null,
                            difficulty: ritual.difficulty,
                            frequency: ritual.frequency ?? undefined,
                            estimated_minutes: ritual.estimated_minutes ?? null,
                            preferred_time: ritual.preferred_time ?? null,
                            category: ritual.category ?? null,
                            custom_days: ritual.custom_days ?? null,
                            custom_month_days: ritual.custom_month_days ?? null,
                          });
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{ritual.title}</p>
                          <p className="text-xs text-[#7f4a1d]/80">
                            {ritual.frequency ?? "daily"}
                          </p>
                        </div>
                        <Pencil className="h-4 w-4 shrink-0 text-[#8d481c]" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border-[3px] border-dashed border-[#6b3416] bg-white/45 px-4 py-6 text-center text-sm text-[#7f4a1d]/80">
                    No rituals are linked to this campaign yet.
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-[1.5rem] border-[3px] border-[#8a2716] bg-[#ffd9bf] p-4 text-[#8a2716] shadow-[0_8px_0_rgba(154,71,24,0.18)]">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Danger zone</h3>
                </div>
                <p className="text-sm text-[#8a2716]/80">
                  Permanently delete this campaign, its linked rituals, and any incomplete ritual tasks.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  disabled={isDeletingCampaign || !currentEpic}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {isDeletingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete campaign
                </Button>
              </section>
            </div>
          </ScrollArea>

          <SheetFooter className={cn(plannerPathfinderTheme.footerBar, "relative z-10 shrink-0 px-4 pb-safe pt-4 sm:px-5")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeletingCampaign}
              className={plannerPathfinderTheme.outlineButton}
            >
              Close
            </Button>
            <Button
              type="button"
              className={cn(plannerPathfinderTheme.primaryButton, "gap-2")}
              disabled={!currentEpic || !trimmedTitle || !hasChanges || isSaving || isDeletingCampaign}
              onClick={handleSave}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {!visualPreview ? (
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingRitual(null);
            }
          }}
          onDelete={handleDeleteRitual}
          isDeleting={isDeletingRitual}
        />
      ) : null}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the campaign, its rituals, and incomplete linked tasks. Completed history will stay in your timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCampaign}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCampaign();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingCampaign}
            >
              {isDeletingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
