import { useState, useRef, useCallback } from 'react';
import { 
  Sparkles,
  Clock, 
  Calendar, 
  Zap, 
  Flame, 
  Mountain, 
  MapPin,
  Star,
  AlertTriangle,
  Repeat,
  Timer,
  Battery,
  BatteryLow,
  BatteryFull,
  Mic,
  MicOff,
  Send,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNaturalLanguageParser, ParsedTask } from '../hooks/useNaturalLanguageParser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SmartTaskInputProps {
  onSubmit: (parsed: ParsedTask) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function SmartTaskInput({
  onSubmit,
  placeholder = "Add a quest... try 'Call mom tomorrow at 3pm @phone'",
  autoFocus = false,
  disabled = false,
}: SmartTaskInputProps) {
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [interimText, setInterimText] = useState('');

  const { medium, success } = useHapticFeedback();
  
  const { isRecording, isSupported, toggleRecording } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      setInput((prev) => (prev + ' ' + text).trim());
      setInterimText('');
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Voice toggle with haptic feedback
  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      success(); // Satisfying completion haptic
    } else {
      medium(); // Action initiated haptic
    }
    toggleRecording();
  }, [isRecording, success, medium, toggleRecording]);

  // Display text combines typed input with interim voice results
  const displayText = interimText ? `${input} ${interimText}`.trim() : input;

  const handleSubmit = () => {
    if (!parsed || !parsed.text.trim()) return;
    onSubmit(parsed);
    reset();
    setInterimText('');
  };

  const handleClear = () => {
    reset();
    setInterimText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const showPreview = isFocused && parsed && (
    parsed.scheduledTime ||
    parsed.scheduledDate ||
    parsed.estimatedDuration ||
    parsed.difficulty !== 'medium' ||
    parsed.priority ||
    parsed.context ||
    parsed.recurrencePattern ||
    parsed.isTopThree ||
    parsed.energyLevel !== 'medium'
  );

  const difficultyConfig = {
    easy: { icon: Zap, label: 'Easy', color: 'text-green-500 bg-green-500/10 border-green-500/30' },
    medium: { icon: Flame, label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
    hard: { icon: Mountain, label: 'Hard', color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  };

  const energyConfig = {
    low: { icon: BatteryLow, label: 'Low Energy', color: 'text-blue-400' },
    medium: { icon: Battery, label: 'Medium Energy', color: 'text-blue-500' },
    high: { icon: BatteryFull, label: 'High Energy', color: 'text-blue-600' },
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Sparkles className={cn(
            "h-4 w-4 transition-colors",
            isRecording ? "text-destructive animate-pulse" : isFocused ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <Input
          ref={inputRef}
          value={displayText}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={isRecording ? "Listening..." : placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={cn(
            "pl-10 pr-28",
            isRecording && "border-destructive/50 ring-1 ring-destructive/20"
          )}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Voice Input Button */}
          {isSupported && (
            <Button
              type="button"
              variant={isRecording ? "destructive" : "ghost"}
              size="sm"
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={cn(
                "h-7 px-2",
                isRecording && "animate-pulse"
              )}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {/* Clear Button */}
          {(input.trim() || interimText) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          {/* Submit Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={disabled || !parsed?.text.trim()}
            className="h-7 px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Smart Preview */}
      {showPreview && (
        <div className="flex flex-wrap gap-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Cleaned text preview */}
          {parsed.text !== input && (
            <Badge variant="outline" className="text-xs gap-1 bg-primary/5 border-primary/20">
              <Sparkles className="h-3 w-3 text-primary" />
              {parsed.text.length > 30 ? parsed.text.slice(0, 30) + '...' : parsed.text}
            </Badge>
          )}

          {/* Date */}
          {parsed.scheduledDate && (
            <Badge variant="outline" className="text-xs gap-1 bg-blue-500/10 border-blue-500/30 text-blue-500">
              <Calendar className="h-3 w-3" />
              {format(new Date(parsed.scheduledDate), 'MMM d')}
            </Badge>
          )}

          {/* Time */}
          {parsed.scheduledTime && (
            <Badge variant="outline" className="text-xs gap-1 bg-purple-500/10 border-purple-500/30 text-purple-500">
              <Clock className="h-3 w-3" />
              {parsed.scheduledTime}
            </Badge>
          )}

          {/* Duration */}
          {parsed.estimatedDuration && (
            <Badge variant="outline" className="text-xs gap-1 bg-cyan-500/10 border-cyan-500/30 text-cyan-500">
              <Timer className="h-3 w-3" />
              {parsed.estimatedDuration >= 60 
                ? `${Math.floor(parsed.estimatedDuration / 60)}h${parsed.estimatedDuration % 60 ? ` ${parsed.estimatedDuration % 60}m` : ''}`
                : `${parsed.estimatedDuration}m`
              }
            </Badge>
          )}

          {/* Difficulty (only if not medium) */}
          {parsed.difficulty !== 'medium' && (
            <Badge variant="outline" className={cn("text-xs gap-1 border", difficultyConfig[parsed.difficulty].color)}>
              {(() => {
                const Icon = difficultyConfig[parsed.difficulty].icon;
                return <Icon className="h-3 w-3" />;
              })()}
              {difficultyConfig[parsed.difficulty].label}
            </Badge>
          )}

          {/* Priority */}
          {parsed.priority && (
            <Badge variant="outline" className="text-xs gap-1 bg-orange-500/10 border-orange-500/30 text-orange-500">
              <AlertTriangle className="h-3 w-3" />
              {parsed.priority === 'urgent-important' ? 'Urgent & Important' :
               parsed.priority === 'urgent-not-important' ? 'Urgent' :
               parsed.priority === 'not-urgent-important' ? 'Important' : ''}
            </Badge>
          )}

          {/* Top 3 */}
          {parsed.isTopThree && (
            <Badge variant="outline" className="text-xs gap-1 bg-stardust-gold/20 border-stardust-gold/40 text-stardust-gold">
              <Star className="h-3 w-3 fill-current" />
              Top 3
            </Badge>
          )}

          {/* Context */}
          {parsed.context && (
            <Badge variant="outline" className="text-xs gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
              <MapPin className="h-3 w-3" />
              @{parsed.context}
            </Badge>
          )}

          {/* Recurrence */}
          {parsed.recurrencePattern && (
            <Badge variant="outline" className="text-xs gap-1 bg-indigo-500/10 border-indigo-500/30 text-indigo-500">
              <Repeat className="h-3 w-3" />
              {parsed.recurrencePattern}
            </Badge>
          )}

          {/* Energy (only if not medium) */}
          {parsed.energyLevel !== 'medium' && (
            <Badge variant="outline" className={cn("text-xs gap-1 bg-background border-border", energyConfig[parsed.energyLevel].color)}>
              {(() => {
                const Icon = energyConfig[parsed.energyLevel].icon;
                return <Icon className="h-3 w-3" />;
              })()}
              {energyConfig[parsed.energyLevel].label}
            </Badge>
          )}
        </div>
      )}

      {/* Hint text */}
      {isFocused && !input && !isRecording && (
        <p className="text-xs text-muted-foreground px-1 animate-in fade-in duration-300">
          Try: "Meeting with John tomorrow at 2pm for 1h @work" or tap 🎤 to speak
        </p>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <p className="text-xs text-destructive px-1 animate-pulse">
          🎤 Listening... tap mic to stop
        </p>
      )}
    </div>
  );
}
