import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { format, isToday, addMinutes, parse } from "date-fns";
import { Plus, Sliders, ArrowLeft, ArrowRight, CalendarIcon, Inbox, Map, X, Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { SuggestedTimeSlots } from "@/components/SuggestedTimeSlots";
import { ContactPicker } from "@/components/tasks/ContactPicker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

export interface AddQuestData {
  text: string;
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

// --- Difficulty color helpers ---
const DIFFICULTY_COLORS = {
  easy: { bg: "bg-emerald-600", text: "text-emerald-400", pill: "bg-emerald-500", border: "border-emerald-500/40" },
  medium: { bg: "bg-rose-500", text: "text-rose-400", pill: "bg-rose-500", border: "border-rose-500/40" },
  hard: { bg: "bg-red-600", text: "text-red-400", pill: "bg-red-500", border: "border-red-500/40" },
} as const;

const DifficultyIcon = ({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) => {
  if (difficulty === "easy") return <Zap className="h-5 w-5" />;
  if (difficulty === "medium") return <Flame className="h-5 w-5" />;
  return <Mountain className="h-5 w-5" />;
};

// Format 24h time to 12h
function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Generate time slots 6:00 AM to 11:45 PM in 15-min increments
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

const DURATION_OPTIONS = [
  { label: "1m", value: 1 },
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
];

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

  const inputRef = useRef<HTMLInputElement>(null);
  const timeWheelRef = useRef<HTMLDivElement>(null);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);

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
    } else {
      setTaskDate(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [open, selectedDate]);

  // Auto-focus input on step 1
  useEffect(() => {
    if (open && step === 1) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, step]);

  // Auto-scroll time wheel to selected time
  useEffect(() => {
    if (open && step === 2 && selectedTimeRef.current) {
      setTimeout(() => {
        selectedTimeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
    }
  }, [open, step, scheduledTime]);

  // Set default time if none set when entering step 2
  useEffect(() => {
    if (step === 2 && !scheduledTime) {
      const now = new Date();
      const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
      const rounded = new Date(now);
      rounded.setMinutes(roundedMinutes, 0, 0);
      if (roundedMinutes >= 60) rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
      setScheduledTime(format(rounded, "HH:mm"));
    }
  }, [step, scheduledTime]);

  const endTime = useMemo(() => {
    if (!scheduledTime || !estimatedDuration) return null;
    const base = parse(scheduledTime, "HH:mm", new Date());
    return format(addMinutes(base, estimatedDuration), "HH:mm");
  }, [scheduledTime, estimatedDuration]);

  const timeRangeLabel = useMemo(() => {
    if (!scheduledTime) return "";
    const start = formatTime12(scheduledTime);
    const end = endTime ? formatTime12(endTime) : "";
    const dur = estimatedDuration ? `${estimatedDuration}m` : "";
    return end ? `${start} – ${end} (${dur})` : start;
  }, [scheduledTime, endTime, estimatedDuration]);

  const colors = DIFFICULTY_COLORS[difficulty];
  const dateObj = taskDate ? new Date(taskDate + "T00:00:00") : selectedDate;

  const handleSubmit = useCallback(async () => {
    if (!taskText.trim()) return;
    await onAdd({
      text: taskText,
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
    });
    onOpenChange(false);
  }, [taskText, difficulty, scheduledTime, estimatedDuration, recurrencePattern, recurrenceDays, reminderEnabled, reminderMinutesBefore, moreInformation, location, contactId, autoLogInteraction, onAdd, onOpenChange]);

  const handleAddToInbox = useCallback(async () => {
    if (!taskText.trim()) return;
    await onAdd({
      text: taskText,
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
    });
    onOpenChange(false);
  }, [taskText, difficulty, estimatedDuration, recurrencePattern, recurrenceDays, reminderEnabled, reminderMinutesBefore, moreInformation, location, contactId, autoLogInteraction, onAdd, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl flex flex-col p-0 gap-0 overflow-hidden">
        {/* Step 1: Title + Difficulty */}
        {step === 1 && (
          <>
            <SheetHeader className="px-5 pt-5 pb-2 flex-shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add New Quest
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5">
              <div className="space-y-6 py-4">
                {/* Quest Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quest Name</label>
                  <Input
                    ref={inputRef}
                    placeholder="What quest will you conquer?"
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && taskText.trim() && setStep(2)}
                    disabled={isAdding}
                  />
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <HabitDifficultySelector
                    value={difficulty}
                    onChange={setDifficulty}
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t border-border/50">
              <Button
                onClick={() => setStep(2)}
                disabled={!taskText.trim()}
                className="w-full"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
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

        {/* Step 2: Structured-style scheduling */}
        {step === 2 && (
          <>
            {/* Colored Header Banner */}
            <div className={cn("relative px-5 pt-4 pb-5 flex-shrink-0", colors.bg)}>
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStep(1)}
                className="absolute top-3 left-3 p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center text-center pt-4 text-white">
                <DifficultyIcon difficulty={difficulty} />
                <p className="text-lg font-bold mt-2 tracking-tight leading-tight">
                  {timeRangeLabel || "Select a time"}
                </p>
                <p className="text-sm opacity-80 mt-0.5 truncate max-w-[80%]">{taskText}</p>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-4 space-y-4">

                {/* Date Row */}
                <div className="flex items-center justify-between bg-card rounded-xl px-4 py-3 border border-border/50">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2.5 text-sm font-medium hover:opacity-80 transition-opacity">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(dateObj, "EEE, MMM d, yyyy")}</span>
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
                  <button
                    onClick={() => setTaskDate(format(new Date(), "yyyy-MM-dd"))}
                    className={cn(
                      "text-sm font-semibold transition-colors",
                      isToday(dateObj) ? "text-muted-foreground" : colors.text
                    )}
                  >
                    Today &rsaquo;
                  </button>
                </div>

                {/* Time Wheel */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Time</p>
                  <div
                    ref={timeWheelRef}
                    className="relative h-[200px] overflow-y-auto rounded-xl bg-card border border-border/50 snap-y snap-mandatory scrollbar-none"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {/* Top/bottom fade overlays */}
                    <div className="sticky top-0 h-16 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
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
                    <div className="sticky bottom-0 h-16 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
                  </div>
                </div>

                {/* Duration Chips */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Duration</p>
                  <div className="flex gap-2 flex-wrap bg-card rounded-xl border border-border/50 p-3">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEstimatedDuration(opt.value)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all duration-150",
                          estimatedDuration === opt.value
                            ? cn(colors.pill, "text-white shadow-md")
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggested Time Slots */}
                {!scheduledTime && (
                  <SuggestedTimeSlots
                    date={selectedDate}
                    duration={estimatedDuration || 30}
                    difficulty={difficulty}
                    onSelectTime={(time) => setScheduledTime(time)}
                    disabled={isAdding}
                  />
                )}

                {/* Advanced Settings */}
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full justify-between text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-4 h-4" />
                      Advanced Settings
                    </span>
                    <span className="text-xs">{showAdvanced ? "▲" : "▼"}</span>
                  </Button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
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

                      {/* Recurrence, Reminders, Location, Notes */}
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
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t border-border/50">
              <Button
                onClick={handleSubmit}
                disabled={isAdding || !taskText.trim()}
                className={cn("w-full text-white", colors.pill, `hover:${colors.pill}/90`)}
              >
                {isAdding ? "Adding..." : "Add Quest"}
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
