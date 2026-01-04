import { useState, useRef, useEffect } from "react";
import { Plus, Zap, Flame, Mountain, Sliders, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUEST_XP_REWARDS } from "@/config/xpRewards";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { SuggestedTimeSlots } from "@/components/SuggestedTimeSlots";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
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
}

interface AddQuestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  prefilledTime?: string | null;
  onAdd: (data: AddQuestData) => Promise<void>;
  isAdding?: boolean;
}

export function AddQuestSheet({
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
  
  // Expanded mode - starts minimal, expands when user wants more options
  const [isExpanded, setIsExpanded] = useState(false);

  // Input ref for delayed focus
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard height for positioning drawer above keyboard
  const keyboardHeight = useKeyboardHeight();

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
    setIsExpanded(false);
  };

  const handleSubmit = async () => {
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
          style={{ 
            transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : undefined,
            transition: 'transform 0.15s ease-out'
          }}
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
                disabled={isAdding}
                className="flex-1"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
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
              disabled={isAdding}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
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

          {/* Smart Time Suggestions - show when no time is set */}
          {!scheduledTime && (
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
            <div data-vaul-no-drag>
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
                selectedDate={selectedDate}
                taskDifficulty={difficulty}
              />
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
}
