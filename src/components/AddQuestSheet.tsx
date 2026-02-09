import { useState, useRef, useEffect, useCallback, memo } from "react";
import { format } from "date-fns";
import { Plus, Sliders, ArrowLeft, ArrowRight, CalendarIcon, Inbox, Map } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
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
      setEstimatedDuration(null);
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl flex flex-col">
        {/* Step 1: Title + Difficulty */}
        {step === 1 && (
          <>
            <SheetHeader className="pb-2 flex-shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add New Quest
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="flex-1 pr-4">
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

                {/* Advanced Settings */}
                <div className="pt-2">
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
            </ScrollArea>

            <SheetFooter className="pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t">
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
            </SheetFooter>
          </>
        )}

        {/* Step 2: Date/Time Selection */}
        {step === 2 && (
          <>
            <SheetHeader className="pb-2 flex-shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="p-1 -ml-1 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                Schedule Quest
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">
                {taskText}
              </p>
            </SheetHeader>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !taskDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskDate
                          ? format(new Date(taskDate + "T00:00:00"), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={taskDate ? new Date(taskDate + "T00:00:00") : undefined}
                        onSelect={(date) => setTaskDate(date ? format(date, "yyyy-MM-dd") : null)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time + Duration side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Scheduled Time</label>
                    <Input
                      type="time"
                      value={scheduledTime || ""}
                      onChange={(e) => setScheduledTime(e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (min)</label>
                    <Input
                      type="number"
                      value={estimatedDuration || ""}
                      onChange={(e) =>
                        setEstimatedDuration(e.target.value ? parseInt(e.target.value) : null)
                      }
                      placeholder="30"
                      min="1"
                    />
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
              </div>
            </ScrollArea>

            <SheetFooter className="pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t">
              <Button
                onClick={handleSubmit}
                disabled={isAdding || !taskText.trim()}
                className="w-full"
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
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
});
