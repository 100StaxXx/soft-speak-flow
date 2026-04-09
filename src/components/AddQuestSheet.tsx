import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { format, isToday, addMinutes } from "date-fns";
import { Sliders, CalendarIcon, Inbox, Map, X, Zap, Flame, Mountain, Trash2, Sparkles, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { QuestAttachmentPicker } from "@/components/QuestAttachmentPicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import { parseScheduledTime } from "@/utils/scheduledTime";
import { SEND_TO_CALENDAR_ENABLED } from "@/utils/calendarFeatureFlags";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import { hasRecurrencePattern } from "@/utils/recurrenceValidation";
import { QuestTemplateBrowser } from "@/features/quests/components/QuestTemplateBrowser";
import { usePersonalQuestTemplates } from "@/features/quests/hooks/usePersonalQuestTemplates";
import type {
  QuestComposerPrefillDraft,
  QuestCreationSource,
  QuestTemplateBrowserTab,
  QuestTemplatePrefill,
} from "@/features/quests/types";
import { hasQuestTemplateCustomization } from "@/features/quests/utils/templateDraftDiff";

export interface AddQuestData {
  text: string;
  taskDate: string | null;
  difficulty: "easy" | "medium" | "hard";
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
  location: string | null;
  contactId: string | null;
  autoLogInteraction: boolean;
  sendToInbox: boolean;
  sendToCalendar: boolean;
  subtasks: string[];
  imageUrl: string | null;
  attachments: QuestAttachmentInput[];
  creationSource: QuestCreationSource;
}

interface AddQuestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  prefilledTime?: string | null;
  autoFillTimeOnFirstTap?: boolean;
  presentation?: QuestComposerPresentation;
  prefillDraft?: QuestComposerPrefillDraft | null;
  prefillKey?: string | null;
  onAdd: (data: AddQuestData) => Promise<void>;
  isAdding?: boolean;
  onCreateCampaign?: () => void;
  preventClose?: boolean;
  onPreventedCloseAttempt?: () => void;
}

import {
  QUEST_FORM_STYLES,
  DIFFICULTY_COLORS,
  type QuestComposerPresentation,
  formatTime12,
  getQuestDifficultyIconClasses,
  getQuestDifficultyOptionClasses,
} from "@/components/quest-shared";
import { DurationPickerField, TimePickerField, getNextTimeForStep } from "@/components/scheduling";

type SubmitIntent = "scheduled" | "inbox";

export const AddQuestSheet = memo(function AddQuestSheet({
  open,
  onOpenChange,
  selectedDate,
  prefilledTime,
  presentation = "mobile-sheet",
  prefillDraft = null,
  prefillKey = null,
  onAdd,
  isAdding = false,
  onCreateCampaign,
  preventClose = false,
  onPreventedCloseAttempt,
}: AddQuestSheetProps) {
  const [sheetView, setSheetView] = useState<"editor" | "templates">("editor");
  const [templateBrowserInitialTab, setTemplateBrowserInitialTab] = useState<QuestTemplateBrowserTab>("common");
  const [taskText, setTaskText] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(prefilledTime ?? null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(30);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<number[]>([]);
  const [recurrenceCustomPeriod, setRecurrenceCustomPeriod] = useState<"week" | "month" | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [taskDate, setTaskDate] = useState<string | null>(format(selectedDate, "yyyy-MM-dd"));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [sendToCalendar, setSendToCalendar] = useState(false);
  const [attachments, setAttachments] = useState<QuestAttachmentInput[]>([]);
  const [creationSource, setCreationSource] = useState<QuestCreationSource>("manual");
  const [selectedTemplate, setSelectedTemplate] = useState<QuestTemplatePrefill | null>(null);
  const [showTemplateUpdatePrompt, setShowTemplateUpdatePrompt] = useState(false);
  const [pendingSubmitIntent, setPendingSubmitIntent] = useState<SubmitIntent | null>(null);
  const [isHandlingTemplatePrompt, setIsHandlingTemplatePrompt] = useState(false);
  const {
    templates: personalTemplates,
    isSavingTemplate,
    saveTemplate,
  } = usePersonalQuestTemplates({ enabled: open });
  const { toast } = useToast();

  const { integrationVisible, defaultProvider, connections } = useCalendarIntegrations();
  const effectiveProvider = useMemo(() => {
    const connectedDefaultProvider = defaultProvider
      ? connections.find((connection) => connection.provider === defaultProvider)?.provider ?? null
      : null;
    return connectedDefaultProvider || connections[0]?.provider || null;
  }, [connections, defaultProvider]);
  const canShowCalendarSendOption = Boolean(
    SEND_TO_CALENDAR_ENABLED
      && integrationVisible
      && connections.length > 0
      && effectiveProvider,
  );

  const subtaskInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasEmittedTitleEnteredRef = useRef(false);
  const lastPrefillKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (prefilledTime) setScheduledTime(prefilledTime);
  }, [prefilledTime]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      setSheetView("editor");
      setTemplateBrowserInitialTab("common");
      setTaskText("");
      setDifficulty("medium");
      setShowAdvanced(false);
      setScheduledTime(null);
      setEstimatedDuration(30);
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setRecurrenceMonthDays([]);
      setRecurrenceCustomPeriod(null);
      setReminderEnabled(false);
      setReminderMinutesBefore(15);
      setMoreInformation(null);
      setLocation(null);
      setShowDatePicker(false);
      setSubtasks([]);
      setSendToCalendar(false);
      setAttachments([]);
      setCreationSource("manual");
      setSelectedTemplate(null);
      setShowTemplateUpdatePrompt(false);
      setPendingSubmitIntent(null);
      setIsHandlingTemplatePrompt(false);
      lastPrefillKeyRef.current = null;
      hasEmittedTitleEnteredRef.current = false;
    } else {
      setTaskDate(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;
    if (!prefillDraft || !prefillKey) return;
    if (lastPrefillKeyRef.current === prefillKey) return;

    lastPrefillKeyRef.current = prefillKey;
    setTaskText(prefillDraft.text ?? "");
    setDifficulty(prefillDraft.difficulty ?? "medium");
    setScheduledTime(prefillDraft.scheduledTime ?? null);
    setEstimatedDuration(prefillDraft.estimatedDuration ?? 30);
    setRecurrencePattern(prefillDraft.recurrencePattern ?? null);
    setRecurrenceDays(prefillDraft.recurrenceDays ?? []);
    setRecurrenceMonthDays(prefillDraft.recurrenceMonthDays ?? []);
    setRecurrenceCustomPeriod(prefillDraft.recurrenceCustomPeriod ?? null);
    setReminderEnabled(prefillDraft.reminderEnabled ?? false);
    setReminderMinutesBefore(prefillDraft.reminderMinutesBefore ?? 15);
    setMoreInformation(prefillDraft.moreInformation ?? null);
    setLocation(prefillDraft.location ?? null);
    setTaskDate(prefillDraft.taskDate ?? format(selectedDate, "yyyy-MM-dd"));
    setCreationSource(prefillDraft.creationSource ?? "manual");
    setSelectedTemplate(null);
    setShowTemplateUpdatePrompt(false);
    setPendingSubmitIntent(null);
  }, [open, prefillDraft, prefillKey, selectedDate]);

  const endTime = useMemo(() => {
    if (!scheduledTime || !estimatedDuration) return null;
    const base = parseScheduledTime(scheduledTime);
    if (!base) return null;
    return format(addMinutes(base, estimatedDuration), "HH:mm");
  }, [scheduledTime, estimatedDuration]);

  const trimmedTaskText = taskText.trim();

  const durationLabel = useMemo(() => {
    if (!estimatedDuration) return "No duration";
    if (estimatedDuration === 1440) return "All Day";
    if (estimatedDuration >= 60) return `${estimatedDuration / 60}h`;
    return `${estimatedDuration} min`;
  }, [estimatedDuration]);

  const summaryLine = useMemo(() => {
    const dur = durationLabel;
    if (taskDate) {
      const d = new Date(taskDate + "T00:00:00");
      if (isToday(d)) return `${dur} - Today`;
      return `${dur} - ${format(d, "EEE, MMM d")}`;
    }
    return `${dur} - Inbox`;
  }, [durationLabel, taskDate]);

  const colors = DIFFICULTY_COLORS[difficulty];
  const dateObj = taskDate ? new Date(taskDate + "T00:00:00") : selectedDate;
  const isDesktopPanel = presentation === "desktop-panel";

  const hasDateAndTime = !!taskDate && !!scheduledTime;
  const hasRecurrence = hasRecurrencePattern(recurrencePattern);
  const canCreateTask = !!trimmedTaskText && hasDateAndTime;
  const canAddToInbox = !!trimmedTaskText && !hasRecurrence;
  const reviewDateLabel = taskDate ? format(dateObj, "EEE, MMM d") : "Inbox";
  const reviewTimeLabel = scheduledTime ? formatTime12(scheduledTime) : "Select a time";
  const reviewTitle = trimmedTaskText || "Name your quest";
  const currentTemplateDraft = useMemo(() => ({
    title: taskText,
    difficulty,
    estimatedDuration,
    notes: moreInformation,
    subtasks,
  }), [taskText, difficulty, estimatedDuration, moreInformation, subtasks]);
  const hasTemplateCustomizations = useMemo(
    () => selectedTemplate
      ? hasQuestTemplateCustomization(selectedTemplate, currentTemplateDraft)
      : false,
    [currentTemplateDraft, selectedTemplate],
  );
  const templatePromptConfig = useMemo(() => {
    if (!selectedTemplate) return null;

    if (selectedTemplate.templateOrigin === "personal_explicit") {
      return {
        title: "Update your template?",
        description: "This quest started from one of your saved templates. Update that template with these changes too?",
        actionLabel: "Update Template",
      };
    }

    return {
      title: "Save these changes to My Templates?",
      description: "This quest started from a template. Save this customized version to My Templates so it is ready next time?",
      actionLabel: "Save to My Templates",
    };
  }, [selectedTemplate]);
  const isTemplatePromptBusy = isHandlingTemplatePrompt || isSavingTemplate || isAdding;
  const difficultyOptions = [
    { value: "easy" as const, icon: Zap, label: "Easy" },
    { value: "medium" as const, icon: Flame, label: "Medium" },
    { value: "hard" as const, icon: Mountain, label: "Hard" },
  ];

  // --- Subtask helpers ---
  const handleSubtaskChange = useCallback((index: number, value: string) => {
    setSubtasks(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleSubtaskKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" && subtasks[index]?.trim()) {
      e.preventDefault();
      // Add new empty subtask
      setSubtasks(prev => {
        const next = [...prev];
        next.splice(index + 1, 0, "");
        return next;
      });
      setTimeout(() => subtaskInputRefs.current[index + 1]?.focus(), 50);
    }
    if (e.key === "Backspace" && !subtasks[index] && subtasks.length > 0) {
      e.preventDefault();
      setSubtasks(prev => prev.filter((_, i) => i !== index));
      setTimeout(() => subtaskInputRefs.current[Math.max(0, index - 1)]?.focus(), 50);
    }
  }, [subtasks]);

  const handleDeleteSubtask = useCallback((index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSubtaskRow = useCallback(() => {
    setSubtasks(prev => [...prev, ""]);
    setTimeout(() => subtaskInputRefs.current[subtasks.length]?.focus(), 50);
  }, [subtasks.length]);

  const applyTemplatePrefill = useCallback((template: QuestTemplatePrefill) => {
    setTaskText(template.title);
    setDifficulty(template.difficulty);
    setEstimatedDuration(template.estimatedDuration);
    setMoreInformation(template.notes);
    setSubtasks([...template.subtasks]);
    setSelectedTemplate({
      ...template,
      subtasks: [...template.subtasks],
    });
    setShowTemplateUpdatePrompt(false);
    setPendingSubmitIntent(null);
    setShowDatePicker(false);
    setSheetView("editor");
  }, []);

  const openTemplateBrowser = useCallback((initialTab: QuestTemplateBrowserTab) => {
    setTemplateBrowserInitialTab(initialTab);
    setShowDatePicker(false);
    setSheetView("templates");
  }, []);

  const topPersonalTemplates = useMemo(
    () => personalTemplates.slice(0, 4),
    [personalTemplates],
  );

  const requestOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }

      if (preventClose) {
        window.dispatchEvent(new CustomEvent("add-quest-sheet-close-attempted"));
        onPreventedCloseAttempt?.();
        return;
      }

      onOpenChange(false);
    },
    [onOpenChange, onPreventedCloseAttempt, preventClose]
  );

  const executeSubmit = useCallback(async (intent: SubmitIntent) => {
    if (!taskText.trim()) return;
    if (intent === "inbox" && hasRecurrencePattern(recurrencePattern)) return;

    const resolvedCreationSource: QuestCreationSource =
      creationSource === "voice" || creationSource === "nlp"
        ? creationSource
        : intent === "inbox"
          ? "inbox"
          : "manual";

    if (intent === "scheduled") {
      window.dispatchEvent(new CustomEvent("add-quest-create-attempted"));
    }

    await onAdd({
      text: taskText,
      taskDate: intent === "inbox" ? null : taskDate,
      difficulty,
      scheduledTime: intent === "inbox" ? null : scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      recurrenceMonthDays,
      recurrenceCustomPeriod,
      reminderEnabled,
      reminderMinutesBefore,
      moreInformation,
      location,
      contactId: null,
      autoLogInteraction: true,
      sendToInbox: intent === "inbox",
      sendToCalendar: intent === "scheduled" && sendToCalendar && canShowCalendarSendOption,
      subtasks: subtasks.filter(s => s.trim()),
      imageUrl: attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null,
      attachments,
      creationSource: resolvedCreationSource,
    });
    onOpenChange(false);
  }, [taskText, recurrencePattern, creationSource, scheduledTime, onAdd, taskDate, difficulty, estimatedDuration, recurrenceDays, recurrenceMonthDays, recurrenceCustomPeriod, reminderEnabled, reminderMinutesBefore, moreInformation, location, sendToCalendar, canShowCalendarSendOption, subtasks, attachments, onOpenChange]);

  const submitWithTemplateHandling = useCallback(async (intent: SubmitIntent) => {
    if (selectedTemplate && hasTemplateCustomizations) {
      setPendingSubmitIntent(intent);
      setShowTemplateUpdatePrompt(true);
      return;
    }

    await executeSubmit(intent);
  }, [executeSubmit, hasTemplateCustomizations, selectedTemplate]);

  const handleSubmit = useCallback(async () => {
    await submitWithTemplateHandling("scheduled");
  }, [submitWithTemplateHandling]);

  const handleAddToInbox = useCallback(async () => {
    await submitWithTemplateHandling("inbox");
  }, [submitWithTemplateHandling]);

  const handleContinueWithoutTemplateUpdate = useCallback(async () => {
    if (!pendingSubmitIntent) return;

    const nextIntent = pendingSubmitIntent;
    setShowTemplateUpdatePrompt(false);
    setPendingSubmitIntent(null);
    await executeSubmit(nextIntent);
  }, [executeSubmit, pendingSubmitIntent]);

  const handleSaveTemplateAndContinue = useCallback(async () => {
    if (!selectedTemplate || !pendingSubmitIntent) return;

    setIsHandlingTemplatePrompt(true);

    try {
      const savedTemplate = await saveTemplate({
        templateId: selectedTemplate.templateOrigin === "personal_explicit"
          ? selectedTemplate.id
          : undefined,
        sourceCommonTemplateId: selectedTemplate.templateOrigin === "common"
          ? selectedTemplate.id
          : selectedTemplate.sourceCommonTemplateId,
        title: currentTemplateDraft.title,
        difficulty: currentTemplateDraft.difficulty,
        estimatedDuration: currentTemplateDraft.estimatedDuration,
        notes: currentTemplateDraft.notes,
        subtasks: currentTemplateDraft.subtasks,
      });

      const nextIntent = pendingSubmitIntent;
      setSelectedTemplate({
        ...savedTemplate,
        subtasks: [...savedTemplate.subtasks],
      });
      setShowTemplateUpdatePrompt(false);
      setPendingSubmitIntent(null);
      await executeSubmit(nextIntent);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to save your quest template.";
      toast({
        title: "Failed to save template",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsHandlingTemplatePrompt(false);
    }
  }, [currentTemplateDraft, executeSubmit, pendingSubmitIntent, saveTemplate, selectedTemplate, toast]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("add-quest-sheet-opened"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (hasEmittedTitleEnteredRef.current) return;
    if (!taskText.trim()) return;

    hasEmittedTitleEnteredRef.current = true;
    window.dispatchEvent(new CustomEvent("add-quest-title-entered"));
  }, [open, taskText]);

  useEffect(() => {
    if (!scheduledTime) return;
    window.dispatchEvent(
      new CustomEvent("add-quest-time-selected", {
        detail: { scheduledTime },
      })
    );
  }, [scheduledTime]);

  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      <SheetContent
        side={isDesktopPanel ? "right" : "bottom"}
        data-testid={isDesktopPanel ? "add-quest-desktop-panel" : "add-quest-mobile-sheet"}
        data-tour="add-quest-sheet"
        className={cn(
          isDesktopPanel
            ? "!top-4 !bottom-4 !left-auto !right-4 !h-[calc(100dvh-2rem)] !w-[calc(100vw-2rem)] !max-w-[640px] !rounded-[32px] flex flex-col !p-0 !gap-0 overflow-hidden sm:!w-[620px]"
            : "h-[92vh] rounded-t-[34px] flex flex-col p-0 gap-0 overflow-hidden",
          isDesktopPanel ? QUEST_FORM_STYLES.desktopPanelShell : QUEST_FORM_STYLES.sheet,
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">Add Quest</SheetTitle>
        <SheetDescription className="sr-only">
          Create a new quest with schedule, subtasks, and optional details.
        </SheetDescription>
        {sheetView === "editor" ? (
          isDesktopPanel ? (
            <div className={cn("flex-shrink-0 px-5 py-5", QUEST_FORM_STYLES.desktopPanelHeader)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42">
                    New Quest
                  </p>
                  <p className="mt-1 text-sm text-white/62">{summaryLine}</p>
                </div>
                <button
                  onClick={() => requestOpenChange(false)}
                  className={QUEST_FORM_STYLES.desktopPanelCloseButton}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div data-testid="add-quest-editor-header" className={cn("mt-4 space-y-4", QUEST_FORM_STYLES.desktopPanelHeaderCard)}>
                <Input
                  data-tour="add-quest-title-input"
                  placeholder="Quest Title"
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  disabled={isAdding}
                  className={QUEST_FORM_STYLES.desktopPanelInput}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
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

                  <button
                    type="button"
                    onClick={() => openTemplateBrowser("common")}
                    className={QUEST_FORM_STYLES.desktopPanelToolbarButton}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse common quests
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn("relative isolate overflow-hidden px-4 pt-3 pb-4 flex-shrink-0", colors.bg)}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_72%)] opacity-80" />
              <div className="pointer-events-none absolute -left-10 top-10 h-24 w-24 rounded-full bg-white/[0.10] blur-2xl" />
              <div className="pointer-events-none absolute -right-8 bottom-5 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
              <button
                onClick={() => requestOpenChange(false)}
                className="absolute top-4 right-4 z-10 rounded-full border border-white/22 bg-black/10 p-2 text-white shadow-[0_10px_18px_rgba(0,0,0,0.14)] backdrop-blur-md transition-all duration-200 ease-out hover:bg-black/18 active:scale-[0.97] motion-reduce:transition-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div data-testid="add-quest-editor-header" className="flex flex-col items-center text-center pt-1 text-white">
                <div className="w-full max-w-md pr-12 text-left">
                  <div className={QUEST_FORM_STYLES.titleFieldShell}>
                    <div className={QUEST_FORM_STYLES.titleFieldInner}>
                      <Input
                        data-tour="add-quest-title-input"
                        placeholder="Quest Title"
                        value={taskText}
                        onChange={(e) => setTaskText(e.target.value)}
                        disabled={isAdding}
                        className={QUEST_FORM_STYLES.titleInput}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-white/80">{summaryLine}</p>
                <button
                  type="button"
                  onClick={() => openTemplateBrowser("common")}
                  className={cn("mt-2.5 font-fredoka", QUEST_FORM_STYLES.heroAction)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Browse common quests
                </button>
              </div>

              <div className="mt-3 flex justify-center gap-2">
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
          )
        ) : isDesktopPanel ? (
          <div className={cn("flex-shrink-0 px-5 py-4", QUEST_FORM_STYLES.desktopPanelHeader)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42">
                  Quest Shortcuts
                </p>
                <p className="mt-1 text-sm text-white/62">
                  Pick a common quest or one you already use a lot.
                </p>
              </div>
              <button
                onClick={() => requestOpenChange(false)}
                className={QUEST_FORM_STYLES.desktopPanelCloseButton}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className={cn("relative isolate overflow-hidden px-4 pt-3 pb-4 flex-shrink-0", colors.bg)}>
            <div className="flex min-h-[128px] flex-col items-center justify-center pt-2 text-center text-white">
              <div className={QUEST_FORM_STYLES.heroIcon}>
                <History className="h-5 w-5" />
              </div>
              <p className="mt-3 font-fredoka text-[1.15rem]">Quest shortcuts</p>
              <p className="mt-1 max-w-[16rem] text-sm text-white/74">
                Pick a common quest or one you already use a lot.
              </p>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden", QUEST_FORM_STYLES.body)}>
          {sheetView === "editor" ? (
            <div className={cn(isDesktopPanel ? "px-5 py-5 space-y-5" : "px-4 py-4 space-y-4")}>
              {topPersonalTemplates.length > 0 && (
                <div className={cn(QUEST_FORM_STYLES.sectionCard, "px-4 py-4")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-fredoka text-[1.05rem] text-white">Your templates</p>
                      <p className="text-xs text-white/60">Saved templates and repeat quests you can reuse fast</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openTemplateBrowser("yours")}
                      className="text-xs font-semibold text-white/72 transition-colors hover:text-white"
                    >
                      See all
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {topPersonalTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplatePrefill(template)}
                        className={cn(
                          "min-w-[156px] shrink-0 px-4 py-3 text-left",
                          QUEST_FORM_STYLES.sectionCardSoft,
                        )}
                      >
                        <span className="line-clamp-2 text-sm font-semibold text-white">{template.title}</span>
                        <span className={cn("mt-2", QUEST_FORM_STYLES.subtleBadge)}>
                          {template.templateOrigin === "personal_explicit" ? "Saved" : `${template.frequency}x`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={cn(isDesktopPanel ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-3" : "space-y-4")}>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center justify-center gap-2 text-sm font-semibold text-white",
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
                      onSelect={(date) => {
                        setTaskDate(date ? format(date, "yyyy-MM-dd") : null);
                        if (date) {
                          setShowDatePicker(false);
                        }
                      }}
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
                  className={isDesktopPanel ? "" : "flex-1"}
                  triggerProps={{
                    "data-tour": "add-quest-time-chip",
                  }}
                  inputProps={{
                    "data-tour": "add-quest-time-input",
                  }}
                  getSlotButtonProps={(slot) => ({
                    "data-tour": "add-quest-time-slot",
                    "data-time-slot": slot,
                  })}
                />

                <DurationPickerField
                  value={estimatedDuration}
                  onChange={setEstimatedDuration}
                  variant="quest-soft"
                  tone={difficulty}
                />
              </div>

              <div className={cn(QUEST_FORM_STYLES.sectionCard, "overflow-hidden")}>
                {subtasks.map((st, idx) => (
                  <div key={idx} className={cn("group flex items-center gap-2 px-4 py-3", `border-b ${QUEST_FORM_STYLES.divider}`)}>
                    <Checkbox disabled className="h-4 w-4 border-white/18 opacity-60" />
                    <input
                      ref={(el) => { subtaskInputRefs.current[idx] = el; }}
                      value={st}
                      onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                      onKeyDown={(e) => handleSubtaskKeyDown(idx, e)}
                      placeholder="Subtask"
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42"
                    />
                    <button
                      onClick={() => handleDeleteSubtask(idx)}
                      className="rounded-full p-1 opacity-0 transition-all hover:bg-white/[0.08] text-white/44 hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleAddSubtaskRow}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleAddSubtaskRow();
                    }
                  }}
                  className={cn("flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]", `border-b ${QUEST_FORM_STYLES.divider}`)}
                >
                  <Checkbox disabled className="h-4 w-4 border-white/14 opacity-40" />
                  <span className="text-sm text-white/48">Add Subtask</span>
                </div>

                <Textarea
                  value={moreInformation || ""}
                  onChange={(e) => setMoreInformation(e.target.value || null)}
                  placeholder="Add notes, meeting links or phone numbers..."
                  className="min-h-[88px] border-0 rounded-none bg-transparent resize-none px-4 py-4 text-sm text-white placeholder:text-white/42 focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
                  data-vaul-no-drag
                />
              </div>

              <div className="px-1">
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
                  selectedDate={dateObj}
                  taskDifficulty={difficulty}
                  hideScheduledTime
                  hideDuration
                  hideMoreInformation
                  hideReminder
                  hideLocation
                  requireScheduledTimeForRecurrence
                  visualStyle="quest-soft"
                />
              </div>

              <div className={cn(QUEST_FORM_STYLES.sectionCard, "space-y-3 px-4 py-4")}>
                <Label className={cn("text-sm font-semibold", QUEST_FORM_STYLES.label)}>Photo / Files</Label>
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
                  selectedDate={dateObj}
                  taskDifficulty={difficulty}
                  hideScheduledTime
                  hideDuration
                  hideMoreInformation
                  hideRecurrence
                  hideLocation
                  requireScheduledTimeForRecurrence
                  visualStyle="quest-soft"
                />
              )}

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
                  <div className="mt-3 space-y-4">
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
                      selectedDate={dateObj}
                      taskDifficulty={difficulty}
                      hideScheduledTime
                      hideDuration
                      hideMoreInformation
                      hideReminder
                      hideRecurrence
                      requireScheduledTimeForRecurrence
                      visualStyle="quest-soft"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <QuestTemplateBrowser
              initialTab={templateBrowserInitialTab}
              personalTemplates={personalTemplates}
              onBack={() => setSheetView("editor")}
              onSelectTemplate={applyTemplatePrefill}
            />
          )}
        </div>

        {sheetView === "editor" && (
          <div
            className={cn(
              "flex-shrink-0 flex flex-col gap-3 px-5 pt-4",
              isDesktopPanel ? `${QUEST_FORM_STYLES.desktopPanelFooter} pb-5` : "border-t border-white/8 pb-6",
            )}
          >
            <div className={QUEST_FORM_STYLES.footerReview}>
              <p className="text-xs text-white/74">
                {reviewTitle} · {reviewTimeLabel} · {reviewDateLabel}
              </p>
            </div>
            {canShowCalendarSendOption && (
              <div className={cn(QUEST_FORM_STYLES.sectionCardSoft, "flex items-center justify-between px-4 py-3")}>
                <div className="text-xs text-white/62">
                  Send to {effectiveProvider === "apple" ? "Apple" : effectiveProvider === "google" ? "Google" : "Outlook"} Calendar after create
                </div>
                <Switch checked={sendToCalendar} onCheckedChange={setSendToCalendar} />
              </div>
            )}
            <Button
              onClick={handleSubmit}
              data-tour="add-quest-create-button"
              disabled={isAdding || !canCreateTask}
              className={cn(
                "h-14 w-full rounded-[28px] font-fredoka text-[1.05rem] tracking-[0.01em] disabled:opacity-100",
                canCreateTask ? colors.primaryButton : colors.primaryButtonDisabled,
              )}
            >
              {isAdding ? "Adding..." : "Add Quest"}
            </Button>
            <Button
              variant="outline"
              onClick={handleAddToInbox}
              disabled={isAdding || !canAddToInbox}
              className={cn("h-12 w-full rounded-[26px] border font-semibold disabled:opacity-45", QUEST_FORM_STYLES.secondaryButton)}
            >
              <Inbox className="mr-2 h-4 w-4" />
              Add to Inbox instead
            </Button>
            {hasRecurrence && (
              <p className={cn("text-center", QUEST_FORM_STYLES.helperText)}>
                Recurring quests must stay scheduled with a time.
              </p>
            )}
            {onCreateCampaign && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onCreateCampaign();
                }}
                className={cn("flex items-center justify-center gap-1.5 py-1 text-sm", QUEST_FORM_STYLES.footerLink)}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Or create a Campaign</span>
                <span className={QUEST_FORM_STYLES.subtleBadge}>
                  Max 2 active
                </span>
              </button>
            )}
          </div>
        )}
      </SheetContent>
      <AlertDialog
        open={showTemplateUpdatePrompt}
        onOpenChange={(nextOpen) => {
          if (isTemplatePromptBusy) return;
          setShowTemplateUpdatePrompt(nextOpen);
          if (!nextOpen) {
            setPendingSubmitIntent(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{templatePromptConfig?.title ?? "Save template changes?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {templatePromptConfig?.description ?? "Save this customized version for next time, or keep it as a one-off quest."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleContinueWithoutTemplateUpdate()}
              disabled={isTemplatePromptBusy}
            >
              Just this time
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveTemplateAndContinue()}
              disabled={isTemplatePromptBusy}
            >
              {templatePromptConfig?.actionLabel ?? "Save to My Templates"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
});
