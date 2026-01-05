import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Send, Calendar, Clock, Timer, Zap, Flame, Mountain,
  AlertTriangle, Star, Repeat, Battery, BatteryLow, BatteryFull, StickyNote,
  Sparkles, CalendarDays
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNaturalLanguageParser, ParsedTask } from '../hooks/useNaturalLanguageParser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { QuickSuggestionChips } from './QuickSuggestionChips';
import { PermissionRequestDialog } from '@/components/PermissionRequestDialog';
import { AudioReactiveWaveform } from '@/components/AudioReactiveWaveform';
import { TypewriterPlaceholder } from '@/components/TypewriterPlaceholder';
import { ParsedBadge } from './ParsedBadge';
import { TaskPreviewCard } from './TaskPreviewCard';
import { PlanMyDayClarification, PlanMyDayAnswers } from './PlanMyDayClarification';
import { PlanMyWeekClarification, PlanMyWeekAnswers } from './PlanMyWeekClarification';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface CompactSmartInputProps {
  onSubmit: (parsed: ParsedTask) => void;
  onPlanMyDay?: (answers: PlanMyDayAnswers) => void;
  onPlanMyWeek?: (answers: PlanMyWeekAnswers) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  activeEpics?: Array<{ id: string; title: string; progress_percentage?: number | null }>;
  habitsAtRisk?: Array<{ id: string; title: string; current_streak: number }>;
}

export function CompactSmartInput({
  onSubmit,
  onPlanMyDay,
  onPlanMyWeek,
  placeholder = "Add quest...",
  disabled = false,
  className,
  activeEpics = [],
  habitsAtRisk = [],
}: CompactSmartInputProps) {
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPlanClarification, setShowPlanClarification] = useState(false);
  const [showWeekClarification, setShowWeekClarification] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);

  const { medium, success, light, tap } = useHapticFeedback();

  const { isRecording, isSupported, permissionStatus, toggleRecording, requestPermission } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      setInput((prev) => (prev ? prev + ' ' + text : text).trim());
      setInterimText('');
      success();
    },
    onError: (error) => {
      toast.error(error);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  const handleRequestPermission = async () => {
    const status = await requestPermission();
    
    if (status === 'granted') {
      setShowPermissionDialog(false);
      toggleRecording();
    }
  };

  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      success();
    } else {
      medium();
    }
    toggleRecording();
  }, [isRecording, success, medium, toggleRecording]);

  const displayText = interimText ? `${input} ${interimText}`.trim() : input;
  const showTypewriter = isFocused && !displayText && !isRecording;

  const handleSubmit = () => {
    // Check for plan my week trigger first (more specific)
    if (parsed?.triggerPlanMyWeek) {
      success();
      setShowWeekClarification(true);
      return;
    }
    
    // Check for plan my day trigger
    if (parsed?.triggerPlanMyDay) {
      success();
      setShowPlanClarification(true);
      return;
    }
    
    if (!parsed || !parsed.text.trim()) return;
    success();
    setShowPreview(true);
  };

  const handlePlanComplete = async (answers: PlanMyDayAnswers) => {
    setIsPlanLoading(true);
    try {
      await onPlanMyDay?.(answers);
      reset();
      setInterimText('');
      setShowPlanClarification(false);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handlePlanSkip = async () => {
    setIsPlanLoading(true);
    try {
      await onPlanMyDay?.({ energyLevel: 'medium', dayType: 'mixed', focusArea: 'progress' });
      reset();
      setInterimText('');
      setShowPlanClarification(false);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleWeekComplete = async (answers: PlanMyWeekAnswers) => {
    setIsPlanLoading(true);
    try {
      await onPlanMyWeek?.(answers);
      reset();
      setInterimText('');
      setShowWeekClarification(false);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleWeekSkip = async () => {
    setIsPlanLoading(true);
    try {
      await onPlanMyWeek?.({ energyLevel: 'medium' });
      reset();
      setInterimText('');
      setShowWeekClarification(false);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handlePreviewConfirm = () => {
    if (!parsed || !parsed.text.trim()) return;
    success();
    onSubmit(parsed);
    reset();
    setInterimText('');
    setShowPreview(false);
    inputRef.current?.blur();
  };

  const handlePreviewDiscard = () => {
    setShowPreview(false);
    light();
  };

  const handlePreviewEdit = () => {
    setShowPreview(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      reset();
      setInterimText('');
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    tap();
    setInput(prev => `${prev} ${suggestion}`.trim());
    inputRef.current?.focus();
  };

  const hasContent = displayText.trim().length > 0;

  // Badge configurations
  const difficultyConfig: Record<string, { icon: typeof Zap; label: string; color: string }> = {
    easy: { icon: Zap, label: 'Easy', color: 'text-green-500 bg-green-500/10 border-green-500/30' },
    medium: { icon: Flame, label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
    hard: { icon: Mountain, label: 'Hard', color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  };

  const energyConfig: Record<string, { icon: typeof Battery; label: string; color: string }> = {
    low: { icon: BatteryLow, label: 'Low', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
    medium: { icon: Battery, label: 'Med', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
    high: { icon: BatteryFull, label: 'High', color: 'text-blue-600 bg-blue-600/10 border-blue-600/30' },
  };

  // Build badges array from parsed data
  const badges: { key: string; icon: typeof Calendar; label: string; color: string }[] = [];
  
  if (parsed?.scheduledDate) {
    try {
      badges.push({ 
        key: 'date', 
        icon: Calendar, 
        label: format(parseISO(parsed.scheduledDate), 'MMM d'), 
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' 
      });
    } catch {}
  }
  if (parsed?.scheduledTime) {
    badges.push({ 
      key: 'time', 
      icon: Clock, 
      label: parsed.scheduledTime, 
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' 
    });
  }
  if (parsed?.estimatedDuration) {
    const dur = parsed.estimatedDuration >= 60 
      ? `${Math.floor(parsed.estimatedDuration / 60)}h${parsed.estimatedDuration % 60 ? ` ${parsed.estimatedDuration % 60}m` : ''}`
      : `${parsed.estimatedDuration}m`;
    badges.push({ 
      key: 'duration', 
      icon: Timer, 
      label: dur, 
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' 
    });
  }
  if (parsed?.priority && parsed.priority !== 'medium') {
    badges.push({ 
      key: 'priority', 
      icon: parsed.priority === 'high' ? AlertTriangle : Star, 
      label: parsed.priority === 'high' ? 'High' : 'Low', 
      color: parsed.priority === 'high' 
        ? 'text-red-500 bg-red-500/10 border-red-500/30'
        : 'text-gray-500 bg-gray-500/10 border-gray-500/30'
    });
  }
  if (parsed?.recurrencePattern) {
    badges.push({ 
      key: 'recurrence', 
      icon: Repeat, 
      label: parsed.recurrencePattern, 
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' 
    });
  }
  if (parsed?.difficulty && difficultyConfig[parsed.difficulty]) {
    const config = difficultyConfig[parsed.difficulty];
    badges.push({ key: 'difficulty', icon: config.icon, label: config.label, color: config.color });
  }
  if (parsed?.energyLevel && energyConfig[parsed.energyLevel]) {
    const config = energyConfig[parsed.energyLevel];
    badges.push({ key: 'energy', icon: config.icon, label: config.label, color: config.color });
  }
  if (parsed?.notes) {
    badges.push({ 
      key: 'notes', 
      icon: StickyNote, 
      label: 'Note', 
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' 
    });
  }
  if (parsed?.triggerPlanMyWeek) {
    badges.push({ 
      key: 'planmyweek', 
      icon: CalendarDays, 
      label: 'Plan My Week', 
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' 
    });
  } else if (parsed?.triggerPlanMyDay) {
    badges.push({ 
      key: 'planmyday', 
      icon: Sparkles, 
      label: 'Plan My Day', 
      color: 'text-violet-500 bg-violet-500/10 border-violet-500/30' 
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative flex items-center gap-1.5">
        {/* Main input */}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={displayText}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder={isRecording ? "Listening..." : (showTypewriter ? '' : placeholder)}
            disabled={disabled || isRecording}
            className={cn(
              "h-7 text-xs pl-3 pr-14 rounded-full bg-muted/50 border-muted-foreground/20",
              "focus:ring-1 focus:ring-primary/30 focus:border-primary/50",
              "placeholder:text-muted-foreground/50",
              isRecording && "border-primary/50 bg-primary/5"
            )}
          />
          
          {/* Typewriter placeholder overlay */}
          {showTypewriter && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
              <TypewriterPlaceholder isActive={showTypewriter} prefix="try '" />
            </div>
          )}
          
          {/* Recording waveform overlay */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <AudioReactiveWaveform isActive={isRecording} className="w-20 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Action buttons inside input */}
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {/* Mic button */}
            {isSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleVoiceToggle}
                disabled={disabled}
                className={cn(
                  "h-5 w-5 rounded-full",
                  isRecording && "bg-primary/20 text-primary"
                )}
              >
                {isRecording ? (
                  <MicOff className="h-3 w-3" />
                ) : (
                  <Mic className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            )}
            
            {/* Send button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSubmit}
              disabled={disabled || !hasContent}
              className={cn(
                "h-5 w-5 rounded-full",
                hasContent && "text-primary hover:bg-primary/20"
              )}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Real-time parsed badges */}
      <AnimatePresence>
        {isFocused && badges.length > 0 && !showPreview && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1 px-1 overflow-hidden"
          >
            {badges.map((badge, index) => (
              <ParsedBadge
                key={badge.key}
                index={index}
                icon={badge.icon}
                label={badge.label}
                colorClass={badge.color}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick suggestion chips - shown when focused and no preview or clarification */}
      <AnimatePresence>
        {isFocused && !showPreview && !showPlanClarification && !showWeekClarification && (
          <QuickSuggestionChips
            onSuggestionClick={handleSuggestionClick}
            currentInput={displayText}
            className="px-1"
          />
        )}
      </AnimatePresence>

      {/* Plan My Day Clarification */}
      <AnimatePresence>
        {showPlanClarification && (
          <PlanMyDayClarification
            onComplete={handlePlanComplete}
            onSkip={handlePlanSkip}
            isLoading={isPlanLoading}
          />
        )}
      </AnimatePresence>

      {/* Plan My Week Clarification */}
      <AnimatePresence>
        {showWeekClarification && (
          <PlanMyWeekClarification
            onComplete={handleWeekComplete}
            onSkip={handleWeekSkip}
            isLoading={isPlanLoading}
            activeEpics={activeEpics}
            habitsAtRisk={habitsAtRisk}
          />
        )}
      </AnimatePresence>

      {/* Preview Card after submit */}
      <AnimatePresence>
        {showPreview && parsed && parsed.text.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <TaskPreviewCard
              parsed={parsed}
              rawInput={displayText}
              onConfirm={handlePreviewConfirm}
              onEdit={handlePreviewEdit}
              onDiscard={handlePreviewDiscard}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Permission dialog */}
      <PermissionRequestDialog
        isOpen={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onRequestPermission={handleRequestPermission}
        permissionStatus={permissionStatus}
      />
    </div>
  );
}
