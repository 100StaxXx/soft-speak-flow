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
  centerSelectedTimeInWheel,
  DIFFICULTY_COLORS,
  QUEST_FORM_STYLES,
  formatTime12,
  TIME_SLOTS,
  DURATION_OPTIONS,
  getNextHalfHourTime,
  getQuestDifficultyIconClasses,
  getQuestDifficultyOptionClasses,
  getQuestOptionPillClasses,
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
import { recurrenceRequiresScheduledTime } from "@/utils/recurrenceValidation";

interface Task {
  id: string;
  task_text: string;
  task_date?: string | null;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  recurrence_month_days?: number[] | null;
  recurrence_custom_period?: "week" | "month" | null;
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
    recurrence_month_days: number[];
    recurrence_custom_period: "week" | "month" | null;
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
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<number[]>([]);
  const [recurrenceCustomPeriod, setRecurrenceCustomPeriod] = useState<"week" | "month" | null>(null);
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

  const { subtasks, addSubtask, toggleSubtask, deleteSubtask } = useSubtasks(task?.id ?? null);

  // Initialize state from task
  useEffect(() => {
    if (task && open) {
      setTaskText(task.task_text);
      setTaskDate(normalizeTaskDate(task.task_date));
      setDifficulty(normalizeQuestDifficulty(task.difficulty));
      setScheduledTime(normalizeScheduledTime(task.scheduled_time));
      setEstimatedDuration(task.estimated_duration ?? 30);
      const normalizedRecurrenceDays = Array.isArray(task.recurrence_days) ? task.recurrence_days : [];
      const normalizedRecurrenceMonthDays = Array.isArray(task.recurrence_month_days) ? task.recurrence_month_days : [];
      const fallbackMonthDay = task.task_date ? new Date(`${normalizeTaskDate(task.task_date) ?? "2000-01-01"}T00:00:00`).getDate() : 1;
      const normalizedCustomPeriod = task.recurrence_pattern === "custom"
        ? (task.recurrence_custom_period ?? "week")
        : (task.recurrence_custom_period ?? null);
      const normalizedRecurrencePattern = task.recurrence_pattern === "weekly" && normalizedRecurrenceDays.length > 1
        ? "custom"
        : (task.recurrence_pattern || null);
      setRecurrencePattern(normalizedRecurrencePattern);
      setRecurrenceDays(normalizedRecurrenceDays);
      setRecurrenceMonthDays(
        normalizedRecurrencePattern === "monthly" && normalizedRecurrenceMonthDays.length === 0
          ? [fallbackMonthDay]
          : normalizedRecurrenceMonthDays
      );
      setRecurrenceCustomPeriod(
        normalizedRecurrencePattern === "custom"
          ? normalizedCustomPeriod
          : null
      );
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
        !!task.location
      );
    }
  }, [task, open]);

  // Auto-scroll time wheel
  useEffect(() => {
    if (!showTimePicker || !scheduledTime) return;

    const frameId = window.requestAnimationFrame(() => {
      centerSelectedTimeInWheel(timeWheelRef.current, scheduledTime, "smooth");
    });

    return () => window.cancelAnimationFrame(frameId);
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
  const hasRecurrenceWithoutTime = recurrenceRequiresScheduledTime(recurrencePattern, scheduledTime);

  const handleSave = useCallback(async () => {
    if (!task || !taskText.trim() || hasRecurrenceWithoutTime) return;
    await onSave(task.id, {
      task_text: taskText.trim(),
      task_date: normalizeTaskDate(taskDate),
      difficulty,
      scheduled_time: normalizeScheduledTime(scheduledTime),
      estimated_duration: estimatedDuration,
      recurrence_pattern: recurrencePattern,
      recurrence_days: Array.isArray(recurrenceDays) ? recurrenceDays : [],
      recurrence_month_days: Array.isArray(recurrenceMonthDays) ? recurrenceMonthDays : [],
      recurrence_custom_period: recurrencePattern === "custom" ? (recurrenceCustomPeriod ?? "week") : null,
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: Number.isFinite(reminderMinutesBefore) && reminderMinutesBefore > 0 ? reminderMinutesBefore : 15,
      notes: moreInformation,
      category: task.category || null,
      image_url: attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null,
      location,
      attachments,
    });
    onOpenChange(false);
  }, [task, taskText, taskDate, difficulty, scheduledTime, estimatedDuration, recurrencePattern, recurrenceDays, recurrenceMonthDays, recurrenceCustomPeriod, reminderEnabled, reminderMinutesBefore, moreInformation, attachments, location, hasRecurrenceWithoutTime, onSave, onOpenChange]);

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
      <SheetContent
        side="bottom"
        className={cn(
          "h-[92vh] rounded-t-[34px] flex flex-col p-0 gap-0 overflow-hidden",
          QUEST_FORM_STYLES.sheet,
        )}
      >
        <SheetTitle className="sr-only">Edit Quest</SheetTitle>
        <SheetDescription className="sr-only">
          Update this quest details, schedule, and reminders.
        </SheetDescription>

        {/* Header Banner - difficulty colored, editable title */}
        <div className={cn("relative isolate overflow-hidden px-4 pt-3 pb-4 flex-shrink-0", colors.bg)}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_72%)] opacity-80" />
          <div className="pointer-events-none absolute -left-10 top-10 h-24 w-24 rounded-full bg-white/[0.10] blur-2xl" />
          <div className="pointer-events-none absolute -right-8 bottom-5 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/22 bg-black/10 p-2 text-white shadow-[0_10px_18px_rgba(0,0,0,0.14)] backdrop-blur-md transition-all duration-200 ease-out hover:bg-black/18 active:scale-[0.97] motion-reduce:transition-none"
              aria-label="Close"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className={QUEST_FORM_STYLES.titleFieldShell}>
                <div className={QUEST_FORM_STYLES.titleFieldInner}>
                  <Input
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    className={QUEST_FORM_STYLES.titleInput}
                    placeholder="Quest title"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-sm text-white/80">{summaryLine}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/22 bg-black/10 p-2 text-white shadow-[0_10px_18px_rgba(0,0,0,0.14)] backdrop-blur-md transition-all duration-200 ease-out hover:bg-black/18 active:scale-[0.97] motion-reduce:transition-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Compact Difficulty Selector */}
          <div className="mt-3 flex justify-center gap-2">
            {([
              { value: "easy" as const, icon: Zap, label: "Easy" },
              { value: "medium" as const, icon: Flame, label: "Medium" },
              { value: "hard" as const, icon: Mountain, label: "Hard" },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={getQuestDifficultyOptionClasses(value, difficulty === value)}
              >
                <span className={getQuestDifficultyIconClasses(value, difficulty === value)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="font-fredoka text-[12px] leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className={cn("flex-1 overflow-y-auto", QUEST_FORM_STYLES.body)}>
          <div className="px-4 py-4 space-y-4">
            {/* Date & Time Chips side by side */}
            <div className="flex gap-2">
              {/* Date Chip */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white",
                    QUEST_FORM_STYLES.selectorChip,
                    taskDate
                      ? ""
                      : QUEST_FORM_STYLES.selectorChipMuted
                  )}>
                    <CalendarIcon className="h-4 w-4" />
                    {taskDate ? format(dateObj, "MMM d") : "Date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-auto p-1 z-[100]", QUEST_FORM_STYLES.popover)} align="start">
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
                  "flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white",
                  QUEST_FORM_STYLES.selectorChip,
                  scheduledTime
                    ? ""
                    : QUEST_FORM_STYLES.selectorChipMuted
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
                  className="h-11 rounded-[20px] border-white/10 bg-white/[0.08] text-base text-white"
                />
                <div
                  ref={timeWheelRef}
                  className={QUEST_FORM_STYLES.timeWheel}
                  style={{ scrollbarWidth: "none" }}
                >
                  <div className={QUEST_FORM_STYLES.timeWheelFadeTop} />
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
                          data-time-slot={slot}
                          onClick={() => setScheduledTime(slot)}
                          className={cn(
                            "my-0.5 w-[85%] rounded-[20px] py-2.5 text-center text-sm font-semibold snap-center transition-all duration-150 motion-reduce:transition-none",
                            isSelected
                              ? cn(getQuestOptionPillClasses(true, colors.pill), "scale-[1.02]")
                              : "text-white/74 hover:bg-white/[0.08]"
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
                  <div className={QUEST_FORM_STYLES.timeWheelFadeBottom} />
                </div>
              </div>
            )}

            {/* Duration Row */}
            <button
              onClick={() => setShowDurationChips(!showDurationChips)}
              className={cn(
                "w-full flex items-center justify-between text-white",
                QUEST_FORM_STYLES.selectorChip,
              )}
            >
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                <Clock className="h-4 w-4 text-white/58" />
                <span>{durationLabel}</span>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-white/52 transition-transform", showDurationChips && "rotate-90")} />
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
                        className={getQuestOptionPillClasses(isSelected, colors.pill)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {(isCustomDuration || (estimatedDuration === null && customDurationInput !== undefined)) && (
                  <div className={cn("flex items-center gap-2 rounded-[20px] px-3 py-2", QUEST_FORM_STYLES.insetPanel)}>
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
                      className="h-10 w-28 border-white/10 bg-white/[0.08] text-sm text-white"
                      autoFocus
                    />
                    <span className="text-xs text-white/58">min</span>
                  </div>
                )}
              </div>
            )}

            {/* Subtasks + Notes Card */}
            <div className={cn(QUEST_FORM_STYLES.sectionCard, "overflow-hidden")}>
              {subtasks.map((st) => (
                <div key={st.id} className={cn("group flex items-center gap-2 px-4 py-3", `border-b ${QUEST_FORM_STYLES.divider}`)}>
                  <Checkbox
                    checked={st.completed}
                    onCheckedChange={(checked) => toggleSubtask({ subtaskId: st.id, completed: !!checked })}
                    className="h-4 w-4 border-white/18"
                  />
                  <span className={cn("flex-1 text-sm text-white", st.completed && "line-through text-white/42")}>{st.title}</span>
                  <button
                    onClick={() => deleteSubtask(st.id)}
                    className="rounded-full p-1 opacity-0 transition-all hover:bg-white/[0.08] text-white/44 hover:text-white group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Add subtask row */}
              <div className={cn("flex items-center gap-2 px-4 py-3", `border-b ${QUEST_FORM_STYLES.divider}`)}>
                <Checkbox disabled className="h-4 w-4 border-white/14 opacity-40" />
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
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42"
                />
              </div>

              <Textarea
                value={moreInformation || ""}
                onChange={(e) => setMoreInformation(e.target.value || null)}
                placeholder="Add notes, meeting links or phone numbers..."
                className="min-h-[88px] border-0 rounded-none bg-transparent resize-none px-4 py-4 text-sm text-white placeholder:text-white/42 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
                data-vaul-no-drag
              />
            </div>

            {/* Attachments Section */}
            <div className={cn(QUEST_FORM_STYLES.sectionCard, "space-y-3 px-4 py-4")}>
              <p className={cn("text-sm font-semibold", QUEST_FORM_STYLES.label)}>Photo / Files</p>
              <QuestAttachmentPicker
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                visualStyle="quest-soft"
              />
            </div>

            {scheduledTime && (
              <AdvancedQuestOptions
                scheduledTime={scheduledTime}
                estimatedDuration={estimatedDuration}
                recurrencePattern={recurrencePattern}
                recurrenceDays={recurrenceDays}
                recurrenceMonthDays={recurrenceMonthDays}
                recurrenceCustomPeriod={recurrenceCustomPeriod}
                reminderEnabled={reminderEnabled}
                reminderMinutesBefore={reminderMinutesBefore}
                onScheduledTimeChange={setScheduledTime}
                onEstimatedDurationChange={setEstimatedDuration}
                onRecurrencePatternChange={setRecurrencePattern}
                onRecurrenceDaysChange={setRecurrenceDays}
                onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
                onRecurrenceCustomPeriodChange={setRecurrenceCustomPeriod}
                onReminderEnabledChange={setReminderEnabled}
                onReminderMinutesBeforeChange={setReminderMinutesBefore}
                moreInformation={moreInformation}
                onMoreInformationChange={setMoreInformation}
                location={location}
                onLocationChange={setLocation}
                selectedDate={parsedTaskDate ?? new Date()}
                hideScheduledTime
                hideDuration
                hideMoreInformation
                hideRecurrence
                hideLocation
                requireScheduledTimeForRecurrence
                visualStyle="quest-soft"
              />
            )}

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={QUEST_FORM_STYLES.advancedTrigger}
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
                    recurrenceMonthDays={recurrenceMonthDays}
                    recurrenceCustomPeriod={recurrenceCustomPeriod}
                    reminderEnabled={reminderEnabled}
                    reminderMinutesBefore={reminderMinutesBefore}
                    onScheduledTimeChange={setScheduledTime}
                    onEstimatedDurationChange={setEstimatedDuration}
                    onRecurrencePatternChange={setRecurrencePattern}
                    onRecurrenceDaysChange={setRecurrenceDays}
                    onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
                    onRecurrenceCustomPeriodChange={setRecurrenceCustomPeriod}
                    onReminderEnabledChange={setReminderEnabled}
                    onReminderMinutesBeforeChange={setReminderMinutesBefore}
                    moreInformation={moreInformation}
                    onMoreInformationChange={setMoreInformation}
                    location={location}
                    onLocationChange={setLocation}
                    selectedDate={parsedTaskDate ?? new Date()}
                    hideScheduledTime
                    hideDuration
                    hideMoreInformation
                    hideReminder
                    requireScheduledTimeForRecurrence
                    visualStyle="quest-soft"
                  />
                  {hasRecurrenceWithoutTime && (
                    <p className={cn("mt-2", QUEST_FORM_STYLES.helperText)}>
                      Set a time before enabling recurrence.
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex flex-col gap-3 border-t border-white/8 px-5 pt-4 pb-6">
            <Button
              onClick={handleSave}
              disabled={isSaving || !taskText.trim() || hasRecurrenceWithoutTime}
              className={cn(
                "h-14 w-full rounded-[28px] font-fredoka text-[1.05rem] tracking-[0.01em] disabled:opacity-100",
                taskText.trim() && !hasRecurrenceWithoutTime ? colors.primaryButton : colors.primaryButtonDisabled,
              )}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          {onSendToCalendar && (
            <Button
              variant="outline"
              onClick={() => onSendToCalendar(task?.id || "")}
              disabled={isSendingToCalendar || !task?.id}
              className={cn("h-12 w-full rounded-[26px] border font-semibold disabled:opacity-45", QUEST_FORM_STYLES.secondaryButton)}
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
              className="w-full rounded-[24px] text-white/72 hover:bg-white/[0.06] hover:text-white"
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
