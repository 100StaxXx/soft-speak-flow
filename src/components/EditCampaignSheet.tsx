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
import { useAuth } from "@/hooks/useAuth";
import { useEpics } from "@/hooks/useEpics";
import { supabase } from "@/integrations/supabase/client";
import { resolveEpicEndDate } from "@/utils/epicDates";
import { toast } from "@/components/ui/sonner";

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

const DEFAULT_RITUAL_DAYS = [0, 1, 2, 3, 4, 5, 6];

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

  const currentEpic = useMemo(
    () => activeEpics.find((candidate) => candidate.id === epic?.id) ?? epic,
    [activeEpics, epic],
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
      await updateEpic({
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
      await deleteEpic({ epicId: currentEpic.id });
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleDeleteRitual = async (habitId: string) => {
    if (!user?.id) return;

    setIsDeletingRitual(true);
    try {
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

      toast.success("Ritual deleted");
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
      await createCampaignRitual({
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
        <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl px-0 pb-0">
          <SheetHeader className="px-6 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Campaign
            </SheetTitle>
            <SheetDescription>
              Update campaign details, manage linked rituals, or permanently delete this campaign.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="mt-4 h-[calc(88vh-152px)] px-6 pb-6">
            <div className="space-y-8 pb-6" data-vaul-no-drag>
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-title">Campaign name</Label>
                  <Input
                    id="campaign-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Name your campaign"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-description">Description</Label>
                  <Textarea
                    id="campaign-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What is this campaign about?"
                    rows={4}
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/40 bg-card/40 p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Timeline</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {resolvedEndDate
                    ? `Deadline: ${new Date(resolvedEndDate).toLocaleDateString()}`
                    : "No deadline is set for this campaign yet."}
                </p>
                {currentEpic && resolvedEndDate ? (
                  <RescheduleDrawer
                    epicId={currentEpic.id}
                    epicTitle={currentEpic.title}
                    epicGoal={currentEpic.description ?? undefined}
                    currentDeadline={resolvedEndDate}
                  >
                    <Button type="button" variant="outline" className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      Adjust timeline
                    </Button>
                  </RescheduleDrawer>
                ) : null}
              </section>

              <section className="space-y-4 rounded-2xl border border-border/40 bg-card/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Rituals</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowAddRitual((current) => !current)}
                  >
                    <Plus className="h-4 w-4" />
                    Add ritual
                  </Button>
                </div>

                {showAddRitual ? (
                  <div className="space-y-4 rounded-2xl border border-dashed border-border/50 bg-background/40 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-ritual-title">Ritual name</Label>
                      <Input
                        id="new-ritual-title"
                        value={newRitualTitle}
                        onChange={(event) => setNewRitualTitle(event.target.value)}
                        placeholder="Add a campaign ritual"
                      />
                    </div>
                    <HabitDifficultySelector
                      value={newRitualDifficulty}
                      onChange={setNewRitualDifficulty}
                    />
                    <FrequencyPicker
                      selectedDays={newRitualDays}
                      onDaysChange={setNewRitualDays}
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className="gap-2"
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
                        className="flex w-full items-center justify-between rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-background/70"
                        onClick={() => {
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
                          <p className="text-xs text-muted-foreground">
                            {ritual.frequency ?? "daily"}
                          </p>
                        </div>
                        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/50 bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground">
                    No rituals are linked to this campaign yet.
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
                </div>
                <p className="text-sm text-muted-foreground">
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

          <SheetFooter className="border-t border-border/40 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeletingCampaign}
            >
              Close
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={!currentEpic || !trimmedTitle || !hasChanges || isSaving || isDeletingCampaign}
              onClick={handleSave}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
