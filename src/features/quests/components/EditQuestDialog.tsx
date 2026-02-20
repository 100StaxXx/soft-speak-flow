import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format, isToday, addMinutes } from "date-fns";
import { X, ArrowLeft, Clock, ChevronRight, Trash2, Sliders, CalendarIcon, Zap, Flame, Mountain, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { QuestAttachmentPicker } from "@/components/QuestAttachmentPicker";
import { useSubtasks } from "@/features/tasks/hooks/useSubtasks";
import {
  DIFFICULTY_COLORS,
  formatTime12,
  TIME_SLOTS,
  DURATION_OPTIONS,
  getNextHalfHourTime,
} from "@/components/quest-shared";
import type { QuestDifficulty } from "../types";
import {
  normalizeQuestDifficulty,
  normalizeScheduledTime,
  normalizeTaskDate,
  parseTaskDate,
} from "../utils/editQuestDialogNormalization";
import { parseScheduledTime } from "@/utils/scheduledTime";
import type { QuestAttachmentInput, TaskAttachment } from "@/types/questAttachments";

interface Task {
  id: string;
  task_text: string;
  task_date?: string | null;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  notes?: string | null;
  habit_source_id?: string | null;
  image_url?: string | null;
  attachments?: TaskAttachment[] | null;
  location?: string | null;
}

interface EditQuestDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: {
    task_text: string;
    task_date: string | null;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    notes: string | null;
    category: string | null;
    image_url: string | null;
    location: string | null;
    attachments?: QuestAttachmentInput[];
  }) => Promise<void>;
  isSaving: boolean;
  onDelete?: (taskId: string) => Promise<void>;
  isDeleting?: boolean;
  onSendToCalendar?: (taskId: string) => Promise<void> | void;
  hasCalendarLink?: boolean;
  isSendingToCalendar?: boolean;
}

export function EditQuestDialog({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving,
  onDelete,
  isDeleting,
  onSendToCalendar,
  hasCalendarLink = false,
  isSendingToCalendar = false,
}: EditQuestDialogProps) {
  const [taskText, setTaskText] = useState("");
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<QuestDifficulty>("medium");
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(30);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState<QuestAttachmentInput[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [showDurationChips, setShowDurationChips] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState("");
  const [newSubtaskText, setNewSubtaskText] = useState("");

  const timeWheelRef = useRef<HTMLDivElement>(null);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);

  const { subtasks, addSubtask, toggleSubtask, deleteSubtask } = useSubtasks(task?.id ?? null);

  // Initialize state from task
  useEffect(() => {
    if (task && open) {
      setTaskText(task.task_text);
      setTaskDate(normalizeTaskDate(task.task_date));
      setDifficulty(normalizeQuestDifficulty(task.difficulty));
      setScheduledTime(normalizeScheduledTime(task.scheduled_time));
      setEstimatedDuration(task.estimated_duration ?? 30);
      setRecurrencePattern(task.recurrence_pattern || null);
      setRecurrenceDays(Array.isArray(task.recurrence_days) ? task.recurrence_days : []);
      setReminderEnabled(Boolean(task.reminder_enabled));
      setReminderMinutesBefore(
        typeof task.reminder_minutes_before === "number" && task.reminder_minutes_before > 0
          ? task.reminder_minutes_before
          : 15,
      );
      setMoreInformation(task.notes || null);
      const taskAttachments = (task.attachments ?? []).map((attachment, index) => ({
        fileUrl: attachment.fileUrl,
        filePath: attachment.filePath,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSizeBytes: attachment.fileSizeBytes,
        isImage: attachment.isImage,
        sortOrder: attachment.sortOrder ?? index,
      }));
      if (taskAttachments.length > 0) {
        setAttachments(taskAttachments);
      } else if (task.image_url) {
        setAttachments([{
          fileUrl: task.image_url,
          filePath: "",
          fileName: "image",
          mimeType: "image/jpeg",
          fileSizeBytes: 0,
          isImage: true,
          sortOrder: 0,
        }]);
      } else {
        setAttachments([]);
      }
      setLocation(task.location || null);
      setShowDurationChips(false);
      setShowTimePicker(false);
      setShowAdvanced(
        !!task.recurrence_pattern ||
        !!task.reminder_enabled ||
        !!task.location
      );
    }
  }, [task, open]);

  // Auto-scroll time wheel
  useEffect(() => {
    if (showTimePicker && selectedTimeRef.current) {
      setTimeout(() => {
        selectedTimeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
    }
  }, [showTimePicker, scheduledTime]);

  const endTime = useMemo(() => {
    if (!scheduledTime || !estimatedDuration) return null;
    const base = parseScheduledTime(scheduledTime);
    if (!base) return null;
    return format(addMinutes(base, estimatedDuration), "HH:mm");
  }, [scheduledTime, estimatedDuration]);

  const isCustomDuration = estimatedDuration !== null && !DURATION_OPTIONS.some(o => o.value === estimatedDuration);

  const durationLabel = useMemo(() => {
    if (!estimatedDuration) return "No duration";
    if (estimatedDuration === 1440) return "All Day";
    if (estimatedDuration >= 60) return `${estimatedDuration / 60}h`;
    return `${estimatedDuration} min`;
  }, [estimatedDuration]);

  const parsedTaskDate = useMemo(() => parseTaskDate(taskDate), [taskDate]);

  const summaryLine = useMemo(() => {
    const dur = durationLabel;
    if (parsedTaskDate) {
      const d = parsedTaskDate;
      if (isToday(d)) return `${dur} · Today`;
      return `${dur} · ${format(d, "EEE, MMM d")}`;
    }
    return `${dur} · Inbox`;
  }, [durationLabel, parsedTaskDate]);

  const colors = DIFFICULTY_COLORS[difficulty];
  const dateObj = parsedTaskDate ?? new Date();

  const handleSave = useCallback(async () => {
    if (!task || !taskText.trim()) return;
    await onSave(task.id, {
      task_text: taskText.trim(),
      task_date: normalizeTaskDate(taskDate),
      difficulty,
      scheduled_time: normalizeScheduledTime(scheduledTime),
      estimated_duration: estimatedDuration,
      recurrence_pattern: recurrencePattern,
      recurrence_days: Array.isArray(recurrenceDays) ? recurrenceDays : [],
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: Number.isFinite(reminderMinutesBefore) && reminderMinutesBefore > 0 ? reminderMinutesBefore : 15,
      notes: moreInformation,
      category: task.category || null,
      image_url: attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null,
      location,
      attachments,
    });
    onOpenChange(false);
  }, [task, taskText, taskDate, difficulty, scheduledTime, estimatedDuration, recurrencePattern, recurrenceDays, reminderEnabled, reminderMinutesBefore, moreInformation, attachments, location, onSave, onOpenChange]);

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const handleAddSubtask = useCallback(() => {
    if (newSubtaskText.trim()) {
      addSubtask(newSubtaskText.trim());
      setNewSubtaskText("");
    }
  }, [newSubtaskText, addSubtask]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetTitle className="sr-only">Edit Quest</SheetTitle>
        <SheetDescription className="sr-only">
          Update this quest details, schedule, and reminders.
        </SheetDescription>

        {/* Header Banner - difficulty colored, editable title */}
        <div className={cn("relative px-5 pt-3 pb-3 flex-shrink-0", colors.bg)}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
              aria-label="Close"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <Input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                className="text-base font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 h-9"
                placeholder="Quest title"
              />
              <p className="text-white/70 text-xs mt-1">{summaryLine}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Compact Difficulty Selector */}
          <div className="flex justify-center gap-3 mt-2">
            {([
              { value: "easy" as const, icon: Zap, label: "Easy" },
              { value: "medium" as const, icon: Flame, label: "Medium" },
              { value: "hard" as const, icon: Mountain, label: "Hard" },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={cn(
                  "w-14 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border-2",
                  difficulty === value
                    ? "bg-white/30 border-white scale-110"
                    : "bg-white/10 border-transparent hover:bg-white/20"
                )}
              >
                <Icon className="h-4 w-4 text-white" />
                <span className="text-[10px] font-medium text-white/80 leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-3">

            {/* Duration Row */}
            <button
              onClick={() => setShowDurationChips(!showDurationChips)}
              className="w-full flex items-center justify-between bg-card rounded-xl px-4 py-3 border border-border/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{durationLabel}</span>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showDurationChips && "rotate-90")} />
            </button>

            {showDurationChips && (
              <div className="space-y-2 px-1">
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = opt.value === -1
                      ? isCustomDuration
                      : estimatedDuration === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (opt.value === -1) {
                            setCustomDurationInput("");
                            setEstimatedDuration(null);
                          } else {
                            setCustomDurationInput("");
                            setEstimatedDuration(opt.value);
                          }
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150",
                          isSelected
                            ? cn(colors.pill, "text-white shadow-md")
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {(isCustomDuration || (estimatedDuration === null && customDurationInput !== undefined)) && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Minutes"
                      value={customDurationInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDurationInput(val);
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num > 0) {
                          setEstimatedDuration(num);
                        } else {
                          setEstimatedDuration(null);
                        }
                      }}
                      className="w-28 h-9 text-sm"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                )}
              </div>
            )}

            {/* Date & Time Chips side by side */}
            <div className="flex gap-2">
              {/* Date Chip */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                    taskDate
                      ? "bg-card border-border/50 text-foreground"
                      : "bg-muted/30 border-dashed border-border/50 text-muted-foreground"
                  )}>
                    <CalendarIcon className="h-4 w-4" />
                    {taskDate ? format(dateObj, "MMM d") : "Date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={dateObj}
                    onSelect={(date) => setTaskDate(date ? format(date, "yyyy-MM-dd") : null)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {/* Time Chip */}
              <button
                onClick={() => {
                  if (!scheduledTime) {
                    setScheduledTime(getNextHalfHourTime());
                  }
                  setShowTimePicker(!showTimePicker);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                  scheduledTime
                    ? "bg-card border-border/50 text-foreground"
                    : "bg-muted/30 border-dashed border-border/50 text-muted-foreground"
                )}
              >
                <Clock className="h-4 w-4" />
                {scheduledTime ? formatTime12(scheduledTime) : "Time"}
              </button>
            </div>

            {/* Time Wheel */}
            {showTimePicker && (
              <div className="space-y-2">
                <Input
                  aria-label="Custom quest time"
                  type="time"
                  step={60}
                  value={scheduledTime || ""}
                  onChange={(event) => setScheduledTime(event.target.value || null)}
                  className="h-10"
                />
                <div
                  ref={timeWheelRef}
                  className="relative h-[180px] overflow-y-auto rounded-xl bg-card border border-border/50 snap-y snap-mandatory scrollbar-none"
                  style={{ scrollbarWidth: "none" }}
                >
                  <div className="sticky top-0 h-12 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
                  <div className="flex flex-col items-center py-1">
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = scheduledTime === slot;
                      const selectedIdx = scheduledTime ? TIME_SLOTS.indexOf(scheduledTime) : -1;
                      const slotIdx = TIME_SLOTS.indexOf(slot);
                      const distance = selectedIdx >= 0 ? Math.abs(slotIdx - selectedIdx) : 0;
                      const opacity = isSelected ? 1 : Math.max(0.25, 1 - distance * 0.15);

                      return (
                        <button
                          key={slot}
                          ref={isSelected ? selectedTimeRef : undefined}
                          onClick={() => setScheduledTime(slot)}
                          className={cn(
                            "w-[85%] py-2.5 rounded-xl text-center text-sm font-semibold snap-center transition-all duration-150 my-0.5",
                            isSelected
                              ? cn(colors.pill, "text-white shadow-lg scale-[1.02]")
                              : "text-foreground hover:bg-muted/50"
                          )}
                          style={{ opacity: isSelected ? 1 : opacity }}
                        >
                          {isSelected && endTime
                            ? `${formatTime12(slot)} – ${formatTime12(endTime)}`
                            : formatTime12(slot)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="sticky bottom-0 h-12 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Subtasks + Notes Card */}
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 px-3 py-2 border-b border-border/30 group">
                  <Checkbox
                    checked={st.completed}
                    onCheckedChange={(checked) => toggleSubtask({ subtaskId: st.id, completed: !!checked })}
                    className="h-4 w-4"
                  />
                  <span className={cn("flex-1 text-sm", st.completed && "line-through text-muted-foreground")}>{st.title}</span>
                  <button
                    onClick={() => deleteSubtask(st.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Add subtask row */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                <Checkbox disabled className="h-4 w-4 opacity-30" />
                <input
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubtaskText.trim()) {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add Subtask"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>

              <Textarea
                value={moreInformation || ""}
                onChange={(e) => setMoreInformation(e.target.value || null)}
                placeholder="Add notes, meeting links or phone numbers..."
                className="min-h-[70px] border-0 rounded-none bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
                data-vaul-no-drag
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-2 px-1">
              <p className="text-sm font-medium text-muted-foreground">Photo / Files</p>
              <QuestAttachmentPicker
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Advanced Settings
                  </span>
                  <span className="text-xs">{showAdvanced ? "▲" : "▼"}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <AdvancedQuestOptions
                    scheduledTime={scheduledTime}
                    estimatedDuration={estimatedDuration}
                    recurrencePattern={recurrencePattern}
                    recurrenceDays={recurrenceDays}
                    reminderEnabled={reminderEnabled}
                    reminderMinutesBefore={reminderMinutesBefore}
                    onScheduledTimeChange={setScheduledTime}
                    onEstimatedDurationChange={setEstimatedDuration}
                    onRecurrencePatternChange={setRecurrencePattern}
                    onRecurrenceDaysChange={setRecurrenceDays}
                    onReminderEnabledChange={setReminderEnabled}
                    onReminderMinutesBeforeChange={setReminderMinutesBefore}
                    moreInformation={moreInformation}
                    onMoreInformationChange={setMoreInformation}
                    location={location}
                    onLocationChange={setLocation}
                    hideScheduledTime
                    hideDuration
                    hideMoreInformation
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t border-border/50">
            <Button
              onClick={handleSave}
              disabled={isSaving || !taskText.trim()}
              className={cn(
                "w-full text-white",
                taskText.trim() ? cn(colors.pill, "hover:opacity-90") : ""
              )}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          {onSendToCalendar && (
            <Button
              variant="outline"
              onClick={() => onSendToCalendar(task?.id || "")}
              disabled={isSendingToCalendar || !task?.id}
              className="w-full"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              {isSendingToCalendar
                ? "Syncing..."
                : hasCalendarLink
                  ? "Re-send to Calendar"
                  : "Send to Calendar"}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quest?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{task?.task_text}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
