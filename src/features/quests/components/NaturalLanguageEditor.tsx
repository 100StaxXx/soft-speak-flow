import { useState } from "react";
import { Sparkles, Mic, MicOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNaturalLanguageParser, ParsedTask } from "@/features/tasks/hooks";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS, QUEST_FORM_STYLES } from "@/components/quest-shared";

interface NaturalLanguageEditorProps {
  onApply: (parsed: ParsedTask) => void;
  visualStyle?: "default" | "quest-soft";
}

export function NaturalLanguageEditor({ onApply, visualStyle = "default" }: NaturalLanguageEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();
  const isQuestSoft = visualStyle === "quest-soft";

  const { isRecording, toggleRecording, isSupported: isVoiceSupported } = useVoiceInput({
    onInterimResult: (transcript) => {
      setInput(prev => prev + " " + transcript);
    },
    onFinalResult: (transcript) => {
      setInput(prev => (prev + " " + transcript).trim());
    },
    language: "en-US",
    autoStopOnSilence: true,
  });

  const hasParsedValues = parsed && (
    // Set values
    parsed.scheduledTime || parsed.scheduledDate || parsed.estimatedDuration || 
    parsed.difficulty !== "medium" || parsed.recurrencePattern ||
    parsed.priority || parsed.context || parsed.isTopThree ||
    parsed.reminderEnabled || parsed.notes ||
    parsed.category || parsed.frequency || parsed.customDays ||
    parsed.paused !== null || parsed.archived !== null ||
    parsed.isBonus !== null || parsed.isMilestone !== null ||
    parsed.xpReward || parsed.xpMultiplier ||
    parsed.newTitle || parsed.triggerDecomposition ||
    // Clear values
    parsed.clearTime || parsed.clearDate || parsed.clearDuration || parsed.clearRecurrence ||
    parsed.clearAll || parsed.clearCategory || parsed.clearPriority || 
    parsed.clearNotes || parsed.clearReminder
  );

  const handleApply = () => {
    if (parsed) {
      onApply(parsed);
    }
    reset();
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className={cn(
          isQuestSoft
            ? cn(QUEST_FORM_STYLES.advancedTrigger, "justify-start gap-2")
            : "w-full justify-start gap-2 text-muted-foreground hover:text-foreground",
        )}
      >
        <Sparkles className="h-4 w-4" />
        Quick edit with natural language...
      </Button>
    );
  }

  return (
    <div className={cn(
      "space-y-3 p-3",
      isQuestSoft
        ? QUEST_FORM_STYLES.sectionCardSoft
        : "rounded-lg bg-muted/50 border border-border",
    )}>
      <div className="flex items-center gap-2">
        <Sparkles className={cn("h-4 w-4", isQuestSoft ? "text-[#8d481c]" : "text-primary")} />
        <span className={cn("text-sm font-medium", isQuestSoft && "text-[#5d2a0f]")}>Quick Edit</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., 'at 3pm for 1 hour daily for body'"
          className={cn("flex-1 text-sm", isQuestSoft && QUEST_FORM_STYLES.desktopPanelInput)}
        />
        {isVoiceSupported && (
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            onClick={toggleRecording}
            className={cn("shrink-0", isQuestSoft && QUEST_FORM_STYLES.iconSecondaryButton)}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {hasParsedValues && (
        <div className="flex flex-wrap gap-2">
          {/* Set values */}
          {parsed.scheduledTime && (
            <Badge color="primary">⏰ {parsed.scheduledTime}</Badge>
          )}
          {parsed.scheduledDate && (
            <Badge color="accent">📅 {parsed.scheduledDate}</Badge>
          )}
          {parsed.estimatedDuration && (
            <Badge color="secondary">⏱️ {parsed.estimatedDuration}min</Badge>
          )}
          {parsed.difficulty !== "medium" && (
            <Badge color={parsed.difficulty === "easy" ? "green" : "red"}>
              {parsed.difficulty === "easy" ? "🌱" : "🔥"} {parsed.difficulty}
            </Badge>
          )}
          {parsed.recurrencePattern && (
            <Badge color="purple">🔄 {parsed.recurrencePattern}</Badge>
          )}
          {parsed.priority && (
            <Badge color={parsed.priority === 'urgent' ? 'red' : parsed.priority === 'high' ? 'orange' : 'blue'}>
              ⚡ {parsed.priority}
            </Badge>
          )}
          {parsed.category && (
            <Badge color={parsed.category === 'mind' ? 'blue' : parsed.category === 'body' ? 'green' : 'purple'}>
              {parsed.category === 'mind' ? '🧠' : parsed.category === 'body' ? '💪' : '✨'} {parsed.category}
            </Badge>
          )}
          {parsed.context && (
            <Badge color="secondary">📍 @{parsed.context}</Badge>
          )}
          {parsed.frequency && (
            <Badge color="purple">📊 {parsed.frequency}</Badge>
          )}
          {parsed.customDays && (
            <Badge color="purple">📅 {formatDays(parsed.customDays)}</Badge>
          )}
          {parsed.isTopThree && (
            <Badge color="yellow">⭐ Top 3</Badge>
          )}
          {parsed.reminderEnabled && (
            <Badge color="blue">
              🔔 {(parsed.reminderOffsetsMinutes?.length ?? 0) > 1
                ? `${parsed.reminderOffsetsMinutes.length} reminders`
                : parsed.reminderMinutesBefore
                  ? `${parsed.reminderMinutesBefore}min before`
                  : 'reminder'}
            </Badge>
          )}
          {parsed.isBonus === true && (
            <Badge color="yellow">🎁 Bonus</Badge>
          )}
          {parsed.isBonus === false && (
            <Badge color="primary">✓ Required</Badge>
          )}
          {parsed.isMilestone && (
            <Badge color="gold">🏆 Milestone</Badge>
          )}
          {parsed.xpReward && (
            <Badge color="yellow">✨ {parsed.xpReward} XP</Badge>
          )}
          {parsed.xpMultiplier && (
            <Badge color="yellow">✨ {parsed.xpMultiplier}x XP</Badge>
          )}
          {parsed.paused === true && (
            <Badge color="orange">⏸️ Pause</Badge>
          )}
          {parsed.paused === false && (
            <Badge color="green">▶️ Resume</Badge>
          )}
          {parsed.archived === true && (
            <Badge color="gray">📦 Archive</Badge>
          )}
          {parsed.newTitle && (
            <Badge color="primary">✏️ "{parsed.newTitle}"</Badge>
          )}
          {parsed.triggerDecomposition && (
            <Badge color="blue">🔀 Break down</Badge>
          )}
          {parsed.notes && (
            <Badge color="secondary">📝 Note added</Badge>
          )}
          
          {/* Clear values */}
          {parsed.clearAll && (
            <Badge color="destructive">🚫 Reset all</Badge>
          )}
          {parsed.clearTime && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove time</Badge>
          )}
          {parsed.clearDate && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove date</Badge>
          )}
          {parsed.clearDuration && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove duration</Badge>
          )}
          {parsed.clearRecurrence && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove repeat</Badge>
          )}
          {parsed.clearCategory && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove category</Badge>
          )}
          {parsed.clearPriority && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove priority</Badge>
          )}
          {parsed.clearNotes && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove notes</Badge>
          )}
          {parsed.clearReminder && !parsed.clearAll && (
            <Badge color="destructive">🚫 Remove reminder</Badge>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setIsExpanded(false);
          }}
          className={cn("flex-1", isQuestSoft && QUEST_FORM_STYLES.secondaryButton)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasParsedValues}
          className={cn("flex-1 gap-1", isQuestSoft && DIFFICULTY_COLORS.medium.primaryButton)}
        >
          <Check className="h-3 w-3" />
          Apply
        </Button>
      </div>
    </div>
  );
}

// Helper component for badges
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/50 text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    green: "bg-green-500/20 text-green-600 dark:text-green-400",
    red: "bg-red-500/20 text-red-600 dark:text-red-400",
    purple: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    orange: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    yellow: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    gold: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    gray: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/20 text-destructive",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
      colorClasses[color] || colorClasses.secondary
    )}>
      {children}
    </span>
  );
}

// Helper to format day numbers to names
function formatDays(days: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map(d => dayNames[d]).join(', ');
}
