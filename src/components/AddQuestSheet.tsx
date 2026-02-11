import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { format, isToday, addMinutes, parse } from "date-fns";
import { Plus, Sliders, CalendarIcon, Inbox, Map, X, Zap, Flame, Mountain, Clock, ChevronRight, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { SuggestedTimeSlots } from "@/components/SuggestedTimeSlots";
import { ContactPicker } from "@/components/tasks/ContactPicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

export interface AddQuestData {
  text: string;
  taskDate: string | null;
  difficulty: "easy" | "medium" | "hard";
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
  location: string | null;
  contactId: string | null;
  autoLogInteraction: boolean;
  sendToInbox: boolean;
  subtasks: string[];
}

interface AddQuestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  prefilledTime?: string | null;
  onAdd: (data: AddQuestData) => Promise<void>;
  isAdding?: boolean;
  onCreateCampaign?: () => void;
}

import { DIFFICULTY_COLORS, DifficultyIconMap, formatTime12, TIME_SLOTS, DURATION_OPTIONS } from "@/components/quest-shared";

const DifficultyIcon = ({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) => {
  const Icon = DifficultyIconMap[difficulty];
  return <Icon className="h-5 w-5" />;
};

export const AddQuestSheet = memo(function AddQuestSheet({
  open,
  onOpenChange,
  selectedDate,
  prefilledTime,
  onAdd,
  isAdding = false,
  onCreateCampaign,
}: AddQuestSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [taskText, setTaskText] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(prefilledTime ?? null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(30);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [autoLogInteraction, setAutoLogInteraction] = useState(true);
  const [taskDate, setTaskDate] = useState<string | null>(format(selectedDate, "yyyy-MM-dd"));
  const [showDurationChips, setShowDurationChips] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [customDurationInput, setCustomDurationInput] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const timeWheelRef = useRef<HTMLDivElement>(null);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);
  const subtaskInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (prefilledTime) setScheduledTime(prefilledTime);
  }, [prefilledTime]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setTaskText("");
      setDifficulty("medium");
      setShowAdvanced(false);
      setScheduledTime(null);
      setEstimatedDuration(30);
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setReminderEnabled(false);
      setReminderMinutesBefore(15);
      setMoreInformation(null);
      setLocation(null);
      setContactId(null);
      setAutoLogInteraction(true);
      setShowDurationChips(false);
      setShowTimePicker(false);
      setSubtasks([]);
    } else {
      setTaskDate(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [open, selectedDate]);

  // Auto-focus title input
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

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
    const base = parse(scheduledTime, "HH:mm", new Date());
    return format(addMinutes(base, estimatedDuration), "HH:mm");
  }, [scheduledTime, estimatedDuration]);

  const isCustomDuration = estimatedDuration !== null && !DURATION_OPTIONS.some(o => o.value === estimatedDuration);

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

  const hasDateAndTime = !!taskDate && !!scheduledTime;
  const canCreateTask = !!taskText.trim() && hasDateAndTime;

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

  const handleSubmit = useCallback(async () => {
    if (!taskText.trim()) return;
    await onAdd({
      text: taskText,
      taskDate,
      difficulty,
      scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
      moreInformation,
      location,
      contactId,
      autoLogInteraction,
      sendToInbox: false,
      subtasks: subtasks.filter(s => s.trim()),
    });
    onOpenChange(false);
  }, [taskText, taskDate, difficulty, scheduledTime, estimatedDuration, recurrencePattern, recurrenceDays, reminderEnabled, reminderMinutesBefore, moreInformation, location, contactId, autoLogInteraction, subtasks, onAdd, onOpenChange]);

  const handleAddToInbox = useCallback(async () => {
    if (!taskText.trim()) return;
    await onAdd({
      text: taskText,
      taskDate: null,
      difficulty,
      scheduledTime: null,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
      moreInformation,
      location,
      contactId,
      autoLogInteraction,
      sendToInbox: true,
      subtasks: subtasks.filter(s => s.trim()),
    });
    onOpenChange(false);
  }, [taskText, difficulty, estimatedDuration, recurrencePattern, recurrenceDays, reminderEnabled, reminderMinutesBefore, moreInformation, location, contactId, autoLogInteraction, subtasks, onAdd, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl flex flex-col p-0 gap-0 overflow-hidden">

        {step === 1 ? (
          <>
            {/* STEP 1: Title + Difficulty */}
            <div className={cn("relative px-5 pt-4 pb-5 flex-shrink-0", colors.bg)}>
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white z-10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center text-center pt-2 text-white">
                <DifficultyIcon difficulty={difficulty} />
                <p className="text-sm opacity-80 mt-1.5">New Quest</p>
                <Input
                  ref={inputRef}
                  placeholder="Quest Title"
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && taskText.trim()) {
                      e.preventDefault();
                      setStep(2);
                    }
                  }}
                  disabled={isAdding}
                  className="mt-2 text-center text-lg font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 h-11"
                />
              </div>

              {/* Compact Difficulty Selector */}
              <div className="flex justify-center gap-3 mt-3">
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

            {/* Step 1 spacer */}
            <div className="flex-1" />

            {/* Step 1 Footer */}
            <div className="px-5 pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t border-border/50">
              <Button
                onClick={() => setStep(2)}
                disabled={!taskText.trim()}
                className={cn("w-full text-white", taskText.trim() ? cn(colors.pill, "hover:opacity-90") : "")}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* STEP 2: Scheduling + Details */}
            {/* Compact header with back button and summary */}
            <div className={cn("relative px-5 pt-3 pb-3 flex-shrink-0 flex items-center gap-3", colors.bg)}>
              <button
                onClick={() => setStep(1)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base truncate">{taskText}</p>
                <p className="text-white/70 text-xs">{summaryLine}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-4 space-y-3">

                {/* Duration Row (tappable, expands to chips) */}
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
                        const now = new Date();
                        const rm = Math.ceil(now.getMinutes() / 15) * 15;
                        const rounded = new Date(now);
                        rounded.setMinutes(rm, 0, 0);
                        if (rm >= 60) rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
                        setScheduledTime(format(rounded, "HH:mm"));
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
                )}

                {/* Subtasks + Notes Card */}
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 border-b border-border/30 group">
                      <Checkbox disabled className="h-4 w-4 opacity-50" />
                      <input
                        ref={(el) => { subtaskInputRefs.current[idx] = el; }}
                        value={st}
                        onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                        onKeyDown={(e) => handleSubtaskKeyDown(idx, e)}
                        placeholder="Subtask"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        onClick={() => handleDeleteSubtask(idx)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleAddSubtaskRow}
                    className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-muted/30 transition-colors border-b border-border/30"
                  >
                    <Checkbox disabled className="h-4 w-4 opacity-30" />
                    <span className="text-sm text-muted-foreground/60">Add Subtask</span>
                  </button>

                  <Textarea
                    value={moreInformation || ""}
                    onChange={(e) => setMoreInformation(e.target.value || null)}
                    placeholder="Add notes, meeting links or phone numbers..."
                    className="min-h-[70px] border-0 rounded-none bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                    style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
                    data-vaul-no-drag
                  />
                </div>

                {/* Advanced Settings (collapsible) */}
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
                    <div className="mt-3 space-y-4">
                      {/* Contact Linking */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>Link to Contact</span>
                        </div>
                        <ContactPicker
                          value={contactId}
                          onChange={setContactId}
                          placeholder="Select a contact..."
                        />
                        {contactId && (
                          <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                            <Label htmlFor="auto-log-add" className="text-sm cursor-pointer">
                              Log as interaction when completed
                            </Label>
                            <Switch
                              id="auto-log-add"
                              checked={autoLogInteraction}
                              onCheckedChange={setAutoLogInteraction}
                            />
                          </div>
                        )}
                      </div>

                      {/* Recurrence, Reminders, Location (no duplicated fields) */}
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
                        selectedDate={selectedDate}
                        taskDifficulty={difficulty}
                        hideScheduledTime
                        hideDuration
                        hideMoreInformation
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Step 2 Footer */}
            <div className="px-5 pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t border-border/50">
              <Button
                onClick={handleSubmit}
                disabled={isAdding || !canCreateTask}
                className={cn(
                  "w-full text-white",
                  canCreateTask ? cn(colors.pill, "hover:opacity-90") : ""
                )}
              >
                {isAdding ? "Creating..." : "Create Quest"}
              </Button>
              <Button
                variant="outline"
                onClick={handleAddToInbox}
                disabled={isAdding || !taskText.trim()}
                className="w-full"
              >
                <Inbox className="mr-2 h-4 w-4" />
                Add to Inbox instead
              </Button>
              {onCreateCampaign && (
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onCreateCampaign();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 py-1"
                >
                  <Map className="w-3.5 h-3.5" />
                  Or create a Campaign
                </button>
              )}
            </div>
          </>
        )}

      </SheetContent>
    </Sheet>
  );
});
