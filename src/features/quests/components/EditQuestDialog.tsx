import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { format, isToday, addMinutes } from "date-fns";
import { X, ArrowLeft, Trash2, Sliders, CalendarIcon, Zap, Flame, Mountain, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompanion } from "@/hooks/useCompanion";
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
import { QuestLocationLink } from "@/components/QuestLocationLink";
import { QuestAttachmentPicker } from "@/components/QuestAttachmentPicker";
import { useSubtasks } from "@/features/tasks/hooks/useSubtasks";
import {
  DIFFICULTY_COLORS,
  QUEST_FORM_STYLES,
  type QuestComposerPresentation,
  getQuestDifficultyIconClasses,
  getQuestDifficultyOptionClasses,
} from "@/components/quest-shared";
import { DurationPickerField, TimePickerField, formatDurationLabel, getNextTimeForStep } from "@/components/scheduling";
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
import {
  getPrimaryQuestReminderOffset,
  normalizeQuestReminderOffsets,
  resolveQuestReminderOffsets,
} from "@/utils/questReminders";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";

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
  reminder_offsets_minutes?: number[] | null;
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
    reminder_offsets_minutes: number[];
    notes: string | null;
    category: string | null;
    image_url: string | null;
    location: string | null;
    attachments?: QuestAttachmentInput[];
    subtasks?: string[];
  }) => Promise<void>;
  isSaving: boolean;
  onDelete?: (taskId: string) => Promise<void>;
  isDeleting?: boolean;
  onSendToCalendar?: (taskId: string) => Promise<void> | void;
  hasCalendarLink?: boolean;
  isSendingToCalendar?: boolean;
  presentation?: QuestComposerPresentation;
  plannerSubtaskDraft?: string[] | null;
  companionFrostedThemeStyle?: CSSProperties;
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
  presentation = "mobile-sheet",
  plannerSubtaskDraft = null,
  companionFrostedThemeStyle,
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
  const [reminderOffsetsMinutes, setReminderOffsetsMinutes] = useState<number[]>([]);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState<QuestAttachmentInput[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [localPlannerSubtasks, setLocalPlannerSubtasks] = useState<string[]>([]);

  const { subtasks, addSubtask, toggleSubtask, deleteSubtask } = useSubtasks(task?.id ?? null);
  const { companion } = useCompanion();
  const resolvedCompanionFrostedThemeStyle = useMemo(
    () => companionFrostedThemeStyle ?? getCompanionFrostedThemeStyle(companion?.favorite_color),
    [companionFrostedThemeStyle, companion?.favorite_color],
  );
  const hasPlannerSubtaskDraft = Array.isArray(plannerSubtaskDraft);

  useEffect(() => {
    if (!open || !hasPlannerSubtaskDraft) {
      setLocalPlannerSubtasks([]);
      return;
    }

    setLocalPlannerSubtasks(
      plannerSubtaskDraft
        .map((subtask) => subtask.trim())
        .filter((subtask, index, collection) => (
          subtask.length > 0 && collection.indexOf(subtask) === index
        )),
    );
  }, [hasPlannerSubtaskDraft, open, plannerSubtaskDraft]);

  const displayedSubtasks = useMemo(
    () => (
      hasPlannerSubtaskDraft
        ? localPlannerSubtasks.map((title, index) => ({
            id: `planner-subtask-${index}-${title}`,
            title,
            completed: false,
          }))
        : subtasks
    ),
    [hasPlannerSubtaskDraft, localPlannerSubtasks, subtasks],
  );

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
      const resolvedReminderOffsets = resolveQuestReminderOffsets({
        reminderEnabled: task.reminder_enabled,
        reminderMinutesBefore: task.reminder_minutes_before,
        reminderOffsetsMinutes: task.reminder_offsets_minutes,
      });
      setReminderEnabled(resolvedReminderOffsets.length > 0);
      setReminderMinutesBefore(getPrimaryQuestReminderOffset(resolvedReminderOffsets));
      setReminderOffsetsMinutes(resolvedReminderOffsets);
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
      setShowAdvanced(
        !!task.recurrence_pattern ||
        !!task.location
      );
    }
  }, [task, open]);

  const endTime = useMemo(() => {
    if (!scheduledTime || !estimatedDuration) return null;
    const base = parseScheduledTime(scheduledTime);
    if (!base) return null;
    return format(addMinutes(base, estimatedDuration), "HH:mm");
  }, [scheduledTime, estimatedDuration]);

  const durationLabel = useMemo(() => {
    return formatDurationLabel(estimatedDuration);
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
  const isDesktopPanel = presentation === "desktop-panel";
  const difficultyOptions = [
    { value: "easy" as const, icon: Zap, label: "Easy" },
    { value: "medium" as const, icon: Flame, label: "Medium" },
    { value: "hard" as const, icon: Mountain, label: "Hard" },
  ];

  const applyReminderOffsets = useCallback((offsets: readonly unknown[]) => {
    const normalizedOffsets = normalizeQuestReminderOffsets(offsets);
    setReminderOffsetsMinutes(normalizedOffsets);
    setReminderEnabled(normalizedOffsets.length > 0);
    setReminderMinutesBefore(getPrimaryQuestReminderOffset(normalizedOffsets));
  }, []);

  const handleReminderEnabledChange = useCallback((enabled: boolean) => {
    if (!enabled) {
      applyReminderOffsets([]);
      return;
    }

    applyReminderOffsets(reminderOffsetsMinutes.length > 0 ? reminderOffsetsMinutes : [reminderMinutesBefore]);
  }, [applyReminderOffsets, reminderMinutesBefore, reminderOffsetsMinutes]);

  const handleReminderMinutesBeforeChange = useCallback((minutes: number) => {
    applyReminderOffsets([minutes]);
  }, [applyReminderOffsets]);

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
      reminder_offsets_minutes: reminderOffsetsMinutes,
      notes: moreInformation,
      category: task.category || null,
      image_url: attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null,
      location,
      attachments,
      subtasks: hasPlannerSubtaskDraft
        ? localPlannerSubtasks.filter((subtask) => subtask.trim().length > 0)
        : undefined,
    });
    onOpenChange(false);
  }, [
    task,
    taskText,
    taskDate,
    difficulty,
    scheduledTime,
    estimatedDuration,
    recurrencePattern,
    recurrenceDays,
    recurrenceMonthDays,
    recurrenceCustomPeriod,
    reminderEnabled,
    reminderMinutesBefore,
    reminderOffsetsMinutes,
    moreInformation,
    attachments,
    location,
    hasPlannerSubtaskDraft,
    hasRecurrenceWithoutTime,
    localPlannerSubtasks,
    onOpenChange,
    onSave,
  ]);

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const handleAddSubtask = useCallback(() => {
    if (newSubtaskText.trim()) {
      if (hasPlannerSubtaskDraft) {
        setLocalPlannerSubtasks((current) => [...current, newSubtaskText.trim()]);
      } else {
        addSubtask(newSubtaskText.trim());
      }
      setNewSubtaskText("");
    }
  }, [addSubtask, hasPlannerSubtaskDraft, newSubtaskText]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktopPanel ? "right" : "bottom"}
        data-testid={isDesktopPanel ? "edit-quest-desktop-panel" : "edit-quest-mobile-sheet"}
        className={cn(
          isDesktopPanel
            ? "!top-4 !bottom-4 !left-auto !right-4 !h-[calc(100dvh-2rem)] !w-[calc(100vw-2rem)] !max-w-[640px] !rounded-[32px] flex flex-col !p-0 !gap-0 overflow-hidden sm:!w-[620px]"
            : "h-[92vh] rounded-t-[34px] flex flex-col p-0 gap-0 overflow-hidden",
          isDesktopPanel ? QUEST_FORM_STYLES.desktopPanelShell : QUEST_FORM_STYLES.sheet,
        )}
        style={resolvedCompanionFrostedThemeStyle}
      >
        <SheetTitle className="sr-only">Edit Quest</SheetTitle>
        <SheetDescription className="sr-only">
          Update this quest details, schedule, and reminders.
        </SheetDescription>

        {isDesktopPanel ? (
          <div className={cn("flex-shrink-0 px-5 py-5", QUEST_FORM_STYLES.desktopPanelHeader)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--stardust-gold))]">
                  Edit Quest
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{summaryLine}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className={QUEST_FORM_STYLES.desktopPanelCloseButton}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={cn("mt-4 space-y-4", QUEST_FORM_STYLES.desktopPanelHeaderCard)}>
              <Input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                className={QUEST_FORM_STYLES.desktopPanelInput}
                placeholder="Quest title"
              />

              <div className="flex flex-wrap items-center gap-2">
                {difficultyOptions.map(({ value, icon: Icon, label }) => (
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
          </div>
        ) : (
          <div className={cn("px-4 pt-4 pb-4 flex-shrink-0", QUEST_FORM_STYLES.mobileHeader)}>
            <div className={QUEST_FORM_STYLES.mobileHeaderGlow} />
            <div className="flex items-start gap-2.5">
              <button
                onClick={() => onOpenChange(false)}
                className={QUEST_FORM_STYLES.mobileHeaderUtilityButton}
                aria-label="Close"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className={QUEST_FORM_STYLES.mobileHeaderKicker}>Edit Quest</p>
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
                <p className={QUEST_FORM_STYLES.mobileHeaderSummary}>{summaryLine}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className={QUEST_FORM_STYLES.mobileHeaderUtilityButton}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={QUEST_FORM_STYLES.mobileDifficultyGroup}>
              {difficultyOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setDifficulty(value)}
                  className={cn("flex-1", getQuestDifficultyOptionClasses(value, difficulty === value))}
                >
                  <span className={getQuestDifficultyIconClasses(value, difficulty === value)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-fredoka text-[12px] leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className={cn("flex-1 min-h-0 overflow-y-auto", QUEST_FORM_STYLES.body)}>
          <div className={cn(isDesktopPanel ? "px-5 py-5 space-y-5" : "px-4 py-4 space-y-4")}>
            <div className={cn(isDesktopPanel ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-3" : "space-y-4")}>
              {/* Date Chip */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center justify-center gap-2 text-sm font-semibold",
                    QUEST_FORM_STYLES.selectorChip,
                    taskDate
                      ? ""
                      : QUEST_FORM_STYLES.selectorChipMuted
                  )}>
                    <CalendarIcon className="h-4 w-4" />
                    {taskDate ? format(dateObj, "MMM d") : "Date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn("w-auto p-1 z-[100]", QUEST_FORM_STYLES.popover)}
                  align="start"
                  style={resolvedCompanionFrostedThemeStyle}
                >
                  <Calendar
                    mode="single"
                    selected={dateObj}
                    onSelect={(date) => setTaskDate(date ? format(date, "yyyy-MM-dd") : null)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <TimePickerField
                value={scheduledTime}
                onChange={setScheduledTime}
                placeholder="Time"
                ariaLabel="Custom quest time"
                variant="quest-soft"
                tone={difficulty}
                stepMinutes={30}
                seedValueOnOpen={() => getNextTimeForStep(30)}
                endTimeHint={endTime}
              />
              <DurationPickerField
                value={estimatedDuration}
                onChange={setEstimatedDuration}
                variant="quest-soft"
                tone={difficulty}
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
                reminderOffsetsMinutes={reminderOffsetsMinutes}
                onScheduledTimeChange={setScheduledTime}
                onEstimatedDurationChange={setEstimatedDuration}
                onRecurrencePatternChange={setRecurrencePattern}
                onRecurrenceDaysChange={setRecurrenceDays}
                onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
                onRecurrenceCustomPeriodChange={setRecurrenceCustomPeriod}
                onReminderEnabledChange={handleReminderEnabledChange}
                onReminderMinutesBeforeChange={handleReminderMinutesBeforeChange}
                onReminderOffsetsMinutesChange={applyReminderOffsets}
                moreInformation={moreInformation}
                onMoreInformationChange={setMoreInformation}
                location={location}
                onLocationChange={setLocation}
                selectedDate={parsedTaskDate ?? new Date()}
                reminderDate={parsedTaskDate}
                hideScheduledTime
                hideDuration
                hideMoreInformation
                hideRecurrence
                hideLocation
                requireScheduledTimeForRecurrence
                visualStyle="quest-soft"
                portalStyle={resolvedCompanionFrostedThemeStyle}
              />
            )}

            {/* Subtasks + Notes Card */}
            <div className={cn(QUEST_FORM_STYLES.sectionCard, "overflow-hidden")}>
              {displayedSubtasks.map((st, index) => (
                <div key={st.id} className={cn("group flex items-center gap-2 px-4 py-3", `border-b ${QUEST_FORM_STYLES.divider}`)}>
                  <Checkbox
                    checked={st.completed}
                    disabled={hasPlannerSubtaskDraft}
                    onCheckedChange={(checked) => {
                      if (hasPlannerSubtaskDraft) return;
                      toggleSubtask({ subtaskId: st.id, completed: !!checked });
                    }}
                    className="h-4 w-4 border-border/60"
                  />
                  <span className={cn("flex-1 text-sm text-foreground", st.completed && "line-through text-muted-foreground/70")}>{st.title}</span>
                  <button
                    onClick={() => {
                      if (hasPlannerSubtaskDraft) {
                        setLocalPlannerSubtasks((current) => current.filter((_, currentIndex) => currentIndex !== index));
                        return;
                      }
                      deleteSubtask(st.id);
                    }}
                    className="rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-card/70 hover:text-foreground group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Add subtask row */}
              <div className={cn("flex items-center gap-2 px-4 py-3", `border-b ${QUEST_FORM_STYLES.divider}`)}>
                <Checkbox disabled className="h-4 w-4 border-border/60 opacity-40" />
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
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Textarea
                value={moreInformation || ""}
                onChange={(e) => setMoreInformation(e.target.value || null)}
                placeholder="Add notes, meeting links or phone numbers..."
                className="min-h-[88px] border-0 rounded-none bg-transparent resize-none px-4 py-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
                data-vaul-no-drag
              />
            </div>

            {location ? (
              <QuestLocationLink
                location={location}
                label="Address"
                className={cn(QUEST_FORM_STYLES.sectionCard, "text-foreground")}
                textClassName="text-foreground"
              />
            ) : null}

            {/* Attachments Section */}
            <div className={cn(QUEST_FORM_STYLES.sectionCard, "space-y-3 px-4 py-4")}>
              <p className={cn("text-sm font-semibold", QUEST_FORM_STYLES.label)}>Photo / Files</p>
              <QuestAttachmentPicker
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                visualStyle="quest-soft"
              />
            </div>

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
                    reminderOffsetsMinutes={reminderOffsetsMinutes}
                    onScheduledTimeChange={setScheduledTime}
                    onEstimatedDurationChange={setEstimatedDuration}
                    onRecurrencePatternChange={setRecurrencePattern}
                    onRecurrenceDaysChange={setRecurrenceDays}
                    onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
                    onRecurrenceCustomPeriodChange={setRecurrenceCustomPeriod}
                    onReminderEnabledChange={handleReminderEnabledChange}
                    onReminderMinutesBeforeChange={handleReminderMinutesBeforeChange}
                    onReminderOffsetsMinutesChange={applyReminderOffsets}
                    moreInformation={moreInformation}
                    onMoreInformationChange={setMoreInformation}
                    location={location}
                    onLocationChange={setLocation}
                    selectedDate={parsedTaskDate ?? new Date()}
                    reminderDate={parsedTaskDate}
                    hideScheduledTime
                    hideDuration
                    hideMoreInformation
                    hideReminder
                    requireScheduledTimeForRecurrence
                    visualStyle="quest-soft"
                    portalStyle={resolvedCompanionFrostedThemeStyle}
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
        <div
          className={cn(
            "flex-shrink-0 flex flex-col gap-3 px-5 pt-4",
            isDesktopPanel ? `${QUEST_FORM_STYLES.desktopPanelFooter} pb-5` : `${QUEST_FORM_STYLES.desktopPanelFooter} pb-6`,
          )}
        >
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
              className="w-full rounded-[24px] text-muted-foreground hover:bg-card/70 hover:text-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent
          className={QUEST_FORM_STYLES.sectionCard}
          data-testid="edit-quest-delete-dialog"
          style={resolvedCompanionFrostedThemeStyle}
        >
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
