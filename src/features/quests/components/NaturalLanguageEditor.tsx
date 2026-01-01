import { useState } from "react";
import { Sparkles, Mic, MicOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNaturalLanguageParser, ParsedTask } from "@/features/tasks/hooks";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";

interface NaturalLanguageEditorProps {
  onApply: (parsed: ParsedTask) => void;
}

export function NaturalLanguageEditor({ onApply }: NaturalLanguageEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();

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
    parsed.scheduledTime || parsed.scheduledDate || parsed.estimatedDuration || 
    parsed.difficulty !== "medium" || parsed.recurrencePattern ||
    parsed.clearTime || parsed.clearDate || parsed.clearDuration || parsed.clearRecurrence
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
        className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Quick edit with natural language...
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Quick Edit</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., 'at 3pm for 1 hour daily'"
          className="flex-1 text-sm"
        />
        {isVoiceSupported && (
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            onClick={toggleRecording}
            className="shrink-0"
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {hasParsedValues && (
        <div className="flex flex-wrap gap-2">
          {parsed.scheduledTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
              ⏰ {parsed.scheduledTime}
            </span>
          )}
          {parsed.scheduledDate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/50 text-accent-foreground text-xs">
              📅 {parsed.scheduledDate}
            </span>
          )}
          {parsed.estimatedDuration && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
              ⏱️ {parsed.estimatedDuration}min
            </span>
          )}
          {parsed.difficulty !== "medium" && (
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
              parsed.difficulty === "easy" && "bg-green-500/20 text-green-600",
              parsed.difficulty === "hard" && "bg-red-500/20 text-red-600"
            )}>
              {parsed.difficulty === "easy" ? "🌱" : "🔥"} {parsed.difficulty}
            </span>
          )}
          {parsed.recurrencePattern && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-600 text-xs">
              🔄 {parsed.recurrencePattern}
            </span>
          )}
          {parsed.clearTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/20 text-destructive text-xs">
              🚫 Remove time
            </span>
          )}
          {parsed.clearDate && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/20 text-destructive text-xs">
              🚫 Remove date
            </span>
          )}
          {parsed.clearDuration && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/20 text-destructive text-xs">
              🚫 Remove duration
            </span>
          )}
          {parsed.clearRecurrence && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/20 text-destructive text-xs">
              🚫 Remove repeat
            </span>
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
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasParsedValues}
          className="flex-1 gap-1"
        >
          <Check className="h-3 w-3" />
          Apply
        </Button>
      </div>
    </div>
  );
}
