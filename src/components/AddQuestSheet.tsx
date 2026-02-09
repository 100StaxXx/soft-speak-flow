import { useState, useRef, useEffect, memo } from "react";
import { Plus, Zap, Flame, Mountain, Sliders, ChevronUp, Send, Users, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { QUEST_XP_REWARDS } from "@/config/xpRewards";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { SuggestedTimeSlots } from "@/components/SuggestedTimeSlots";
import { ContactPicker } from "@/components/tasks/ContactPicker";
import { useIOSKeyboardAvoidance } from "@/hooks/useIOSKeyboardAvoidance";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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
}

export const AddQuestSheet = memo(function AddQuestSheet({
  open,
  onOpenChange,
  selectedDate,
  prefilledTime,
  onAdd,
  isAdding = false,
}: AddQuestSheetProps) {
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
  const [sendToInbox, setSendToInbox] = useState(false);
  
  // Expanded mode - starts minimal, expands when user wants more options
  const [isExpanded, setIsExpanded] = useState(false);

  // Input ref for delayed focus
  const inputRef = useRef<HTMLInputElement>(null);

  // iOS keyboard avoidance
  const { containerStyle, inputStyle, scrollInputIntoView } = useIOSKeyboardAvoidance({ 
    offsetBuffer: 10 
  });

  // Update scheduled time when prefilledTime changes
  useEffect(() => {
    if (prefilledTime) setScheduledTime(prefilledTime);
  }, [prefilledTime]);

  // Reset expanded state when drawer closes (no auto-focus to avoid race condition)
  useEffect(() => {
    if (!open) {
      setIsExpanded(false);
    }
  }, [open]);

  // Swipe-up gesture tracking for expanding
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientY;
    const swipeDistance = touchStartY.current - touchEnd;
    
    // Swipe up detected (minimum 50px threshold)
    if (swipeDistance > 50 && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const resetForm = () => {
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
    setSendToInbox(false);
    setIsExpanded(false);
  };

  const handleSubmit = async () => {
    if (!taskText.trim()) return;
    
    await onAdd({
      text: taskText,
      difficulty,
      scheduledTime: sendToInbox ? null : scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
      moreInformation,
      location,
      contactId,
      autoLogInteraction,
      sendToInbox,
    });
    
    resetForm();
    onOpenChange(false);
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  // Minimal mode: just input + quick submit
  if (!isExpanded) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} handleOnly={true} repositionInputs={false}>
        <DrawerContent 
          className="max-h-[200px]"
          style={containerStyle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="px-4 py-3 space-y-3" data-vaul-no-drag>
            {/* Compact input row with send button */}
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                placeholder="What's your quest?"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                onFocus={() => scrollInputIntoView(inputRef)}
                disabled={isAdding}
                className="flex-1"
                style={inputStyle}
              />
              <Button 
                size="icon"
                onClick={handleSubmit}
                disabled={isAdding || !taskText.trim()}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Expand button */}
            <button
              onClick={handleExpand}
              className="flex items-center justify-center gap-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
              <span>More options (difficulty, time, reminders)</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Expanded mode: full form
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} handleOnly={true} repositionInputs={false}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add New Quest
          </DrawerTitle>
          <DrawerDescription>
            Create a new quest for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </DrawerDescription>
        </DrawerHeader>

        <div 
          className="px-4 pb-4 space-y-4 overflow-y-auto" 
          data-vaul-no-drag
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div data-vaul-no-drag>
            <Input
              ref={inputRef}
              placeholder="What's your quest?"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !showAdvanced && handleSubmit()}
              onFocus={() => scrollInputIntoView(inputRef)}
              disabled={isAdding}
              style={inputStyle}
            />
          </div>

          {/* Difficulty Buttons */}
          <div className="flex gap-2">
            <Button
              variant={difficulty === 'easy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDifficulty('easy')}
              className="flex-1 gap-1"
            >
              <Zap className="h-4 w-4" />
              Easy
              <span className="text-xs text-muted-foreground">+{QUEST_XP_REWARDS.EASY}</span>
            </Button>
            <Button
              variant={difficulty === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDifficulty('medium')}
              className="flex-1 gap-1"
            >
              <Flame className="h-4 w-4" />
              Medium
              <span className="text-xs text-muted-foreground">+{QUEST_XP_REWARDS.MEDIUM}</span>
            </Button>
            <Button
              variant={difficulty === 'hard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDifficulty('hard')}
              className="flex-1 gap-1"
            >
              <Mountain className="h-4 w-4" />
              Hard
              <span className="text-xs text-muted-foreground">+{QUEST_XP_REWARDS.HARD}</span>
            </Button>
          </div>

          {/* Send to Inbox toggle */}
          <button
            onClick={() => setSendToInbox(!sendToInbox)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors w-fit ${
              sendToInbox 
                ? 'bg-accent/15 border-accent/30 text-accent-foreground' 
                : 'border-border/50 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>{sendToInbox ? "Sending to Inbox (no date)" : "Add to Inbox"}</span>
          </button>

          {/* Smart Time Suggestions - show when no time is set and not inbox */}
          {!scheduledTime && !sendToInbox && (
            <SuggestedTimeSlots
              date={selectedDate}
              duration={estimatedDuration || 30}
              difficulty={difficulty}
              onSelectTime={(time) => {
                setScheduledTime(time);
                setShowAdvanced(true);
              }}
              disabled={isAdding}
            />
          )}

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/20 rounded-lg hover:bg-primary/5 w-fit"
          >
            <Sliders className="w-3 h-3" />
            {showAdvanced ? "Hide Advanced" : "Advanced Options"}
          </button>

          {showAdvanced && (
            <div data-vaul-no-drag className="space-y-4">
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
              
              {/* Contact Linking Section */}
              <div className="space-y-3 pt-2 border-t border-border/50">
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
                    <Label htmlFor="auto-log" className="text-sm cursor-pointer">
                      Log as interaction when completed
                    </Label>
                    <Switch
                      id="auto-log"
                      checked={autoLogInteraction}
                      onCheckedChange={setAutoLogInteraction}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <Button 
            onClick={handleSubmit}
            disabled={isAdding || !taskText.trim()}
            className="w-full"
          >
            {isAdding ? "Adding..." : "Add Quest"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
});
