import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
  Check,
  Target,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNaturalLanguageParser, ParsedTask } from '../hooks/useNaturalLanguageParser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useIntentClassifier } from '@/hooks/useIntentClassifier';
import { useTaskDecomposition, SuggestedSubtask } from '@/hooks/useTaskDecomposition';
import { PermissionRequestDialog } from '@/components/PermissionRequestDialog';
import { AudioReactiveWaveform } from '@/components/AudioReactiveWaveform';
import { TypewriterPlaceholder } from '@/components/TypewriterPlaceholder';
import { QuickSuggestionChips } from './QuickSuggestionChips';
import { ParsedBadge } from './ParsedBadge';
import { TaskPreviewCard } from './TaskPreviewCard';
import { SmartEpicWizard } from '@/components/SmartEpicWizard/SmartEpicWizard';
import { useEpics } from '@/hooks/useEpics';
import { useHabits } from '@/features/habits';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';
import { parseNaturalLanguage } from '../hooks/useNaturalLanguageParser';

interface SmartTaskInputProps {
  onSubmit: (parsed: ParsedTask, subtasks?: SuggestedSubtask[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function SmartTaskInput({
  onSubmit,
  placeholder = "Add a quest...",
  autoFocus = false,
  disabled = false,
}: SmartTaskInputProps) {
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const [showPreviewCard, setShowPreviewCard] = useState(false);
  const [previewSource, setPreviewSource] = useState<'voice' | 'typed'>('typed');
  const [showEpicWizard, setShowEpicWizard] = useState(false);
  const prevParsedRef = useRef<ParsedTask | null>(null);
  
  // Breakdown state
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<SuggestedSubtask[]>([]);
  const { decompose, isLoading: isBreakingDown } = useTaskDecomposition();

  const { medium, success, light, tap } = useHapticFeedback();
  const { createEpic, isCreating: isCreatingEpic } = useEpics();
  const { addHabit, isAddingHabit, habits } = useHabits();
  
  // Intent classification for detecting epics/habits
  const { 
    classification, 
    isClassifying, 
    classifyDebounced, 
    reset: resetClassification,
    isEpicDetected,
    isHabitDetected,
  } = useIntentClassifier({ debounceMs: 600, minInputLength: 15 });

  // Trigger classification when input changes
  useEffect(() => {
    if (input.trim()) {
      classifyDebounced(input);
    }
  }, [input, classifyDebounced]);
  
  const { isRecording, isAutoStopping, isSupported, permissionStatus, toggleRecording, requestPermission } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      // Store in preview instead of directly adding to input
      setVoicePreview((prev) => (prev ? prev + ' ' + text : text).trim());
      setInterimText('');
      success(); // Haptic on voice result
    },
    onError: (error) => {
      toast.error(error);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
    onAutoStopping: () => {
      light();
    },
  });

  // Haptic feedback when new elements are parsed
  useEffect(() => {
    if (!parsed || !prevParsedRef.current) {
      prevParsedRef.current = parsed;
      return;
    }
    
    const prev = prevParsedRef.current;
    let hasNewElement = false;
    
    if (parsed.scheduledDate && !prev.scheduledDate) hasNewElement = true;
    if (parsed.scheduledTime && !prev.scheduledTime) hasNewElement = true;
    if (parsed.estimatedDuration && !prev.estimatedDuration) hasNewElement = true;
    if (parsed.context && !prev.context) hasNewElement = true;
    if (parsed.priority && !prev.priority) hasNewElement = true;
    if (parsed.isTopThree && !prev.isTopThree) hasNewElement = true;
    if (parsed.recurrencePattern && !prev.recurrencePattern) hasNewElement = true;
    if (parsed.difficulty !== 'medium' && prev.difficulty === 'medium') hasNewElement = true;
    if (parsed.energyLevel !== 'medium' && prev.energyLevel === 'medium') hasNewElement = true;
    
    if (hasNewElement) {
      tap(); // Subtle haptic when element is parsed
    }
    
    prevParsedRef.current = parsed;
  }, [parsed, tap]);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const status = await requestPermission();
    setIsRequestingPermission(false);
    
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

  const handleSubmit = () => {
    if (!parsed || !parsed.text.trim()) return;
    success(); // Haptic on submit
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 300);
    onSubmit(parsed);
    reset();
    setInterimText('');
  };

  const handleClear = () => {
    light();
    reset();
    resetClassification();
    setInterimText('');
    setVoicePreview(null);
    setShowPreviewCard(false);
    setSuggestedSubtasks([]);
  };

  // Handle breakdown request
  const handleBreakdown = async () => {
    const textToBreakdown = voicePreview || (parsed?.text || input);
    if (!textToBreakdown.trim()) return;
    
    try {
      const subtasks = await decompose(textToBreakdown);
      setSuggestedSubtasks(subtasks);
    } catch (error) {
      toast.error('Failed to break down task. Please try again.');
    }
  };

  const handleCreateAsEpic = () => {
    medium();
    setShowEpicWizard(true);
  };

  const handleCreateAsHabit = () => {
    if (!parsed?.text.trim()) return;
    medium();
    
    // Quick-create habit with detected text and medium difficulty
    addHabit({
      title: parsed.text.trim(),
      difficulty: parsed.difficulty || 'medium',
      selectedDays: [0, 1, 2, 3, 4, 5, 6], // Daily by default
    });
    
    reset();
    resetClassification();
  };

  const handleEpicCreated = async (data: Parameters<typeof createEpic>[0]) => {
    try {
      await createEpic(data);
      setShowEpicWizard(false);
      reset();
      resetClassification();
      toast.success('Epic created!');
    } catch (error) {
      console.error('Failed to create epic:', error);
      toast.error('Failed to create epic');
    }
  };

  // Handle confirming from preview card (creates task immediately)
  const handlePreviewConfirm = (subtasks?: SuggestedSubtask[]) => {
    const textToSubmit = voicePreview || input;
    if (!textToSubmit.trim()) return;
    
    const parsedTask = parseNaturalLanguage(textToSubmit);
    if (!parsedTask.text.trim()) return;
    
    success(); // Haptic on submit
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 300);
    onSubmit(parsedTask, subtasks);
    reset();
    setVoicePreview(null);
    setShowPreviewCard(false);
    setSuggestedSubtasks([]);
    resetClassification();
  };

  // Handle confirm with subtasks
  const handleConfirmWithSubtasks = (subtasks: SuggestedSubtask[]) => {
    handlePreviewConfirm(subtasks);
  };

  // Handle editing from preview card
  const handlePreviewEdit = () => {
    if (voicePreview) {
      setInput(voicePreview);
      setVoicePreview(null);
    }
    setShowPreviewCard(false);
    inputRef.current?.focus();
  };

  // Handle discarding preview
  const handlePreviewDiscard = () => {
    setVoicePreview(null);
    setShowPreviewCard(false);
    setSuggestedSubtasks([]);
    light();
  };

  // Show preview card when recording stops with content
  useEffect(() => {
    if (!isRecording && voicePreview && !showPreviewCard) {
      setPreviewSource('voice');
      setShowPreviewCard(true);
    }
  }, [isRecording, voicePreview, showPreviewCard]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    tap();
    setInput(prev => `${prev} ${suggestion}`.trim());
    inputRef.current?.focus();
  };

  // Badge removal handlers
  const clearDate = () => {
    tap();
    // Remove date-related words from input
    const datePatterns = [
      /\b(today|tomorrow|yesterday)\b/gi,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d+\b/gi,
      /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,
    ];
    let newInput = input;
    datePatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
  };

  const clearTime = () => {
    tap();
    const timePatterns = [
      /\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi,
      /\b(at\s+)?\d{1,2}:\d{2}\b/gi,
    ];
    let newInput = input;
    timePatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
  };

  const clearDuration = () => {
    tap();
    const durationPatterns = [
      /\b(for\s+)?\d+\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/gi,
      /\b\d+h\d*m?\b/gi,
    ];
    let newInput = input;
    durationPatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
  };

  const clearContext = () => {
    tap();
    setInput(input.replace(/@\w+/gi, '').replace(/\s+/g, ' ').trim());
  };

  const clearPriority = () => {
    tap();
    const priorityPatterns = [/!+\s*(urgent|important)?/gi, /\b(urgent|important)\b/gi];
    let newInput = input;
    priorityPatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
  };

  const clearTopThree = () => {
    tap();
    setInput(input.replace(/#top\s*3|#top3/gi, '').replace(/\s+/g, ' ').trim());
  };

  const clearRecurrence = () => {
    tap();
    const recurrencePatterns = [
      /\bevery\s+(day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(daily|weekly|monthly)\b/gi,
    ];
    let newInput = input;
    recurrencePatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
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
    low: { icon: BatteryLow, label: 'Low Energy', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
    medium: { icon: Battery, label: 'Medium Energy', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
    high: { icon: BatteryFull, label: 'High Energy', color: 'text-blue-600 bg-blue-600/10 border-blue-600/30' },
  };

  // Build badges array for staggered animation
  const badges: Array<{
    key: string;
    icon: typeof Calendar;
    label: string;
    color: string;
    onRemove?: () => void;
  }> = [];

  if (parsed?.scheduledDate) {
    // Use parseISO to avoid timezone issues with date-only strings
    const dateForDisplay = parseISO(parsed.scheduledDate);
    badges.push({
      key: 'date',
      icon: Calendar,
      label: format(dateForDisplay, 'MMM d'),
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
      onRemove: clearDate,
    });
  }

  if (parsed?.scheduledTime) {
    badges.push({
      key: 'time',
      icon: Clock,
      label: parsed.scheduledTime,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
      onRemove: clearTime,
    });
  }

  if (parsed?.estimatedDuration) {
    badges.push({
      key: 'duration',
      icon: Timer,
      label: parsed.estimatedDuration >= 60 
        ? `${Math.floor(parsed.estimatedDuration / 60)}h${parsed.estimatedDuration % 60 ? ` ${parsed.estimatedDuration % 60}m` : ''}`
        : `${parsed.estimatedDuration}m`,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
      onRemove: clearDuration,
    });
  }

  if (parsed?.difficulty && parsed.difficulty !== 'medium') {
    badges.push({
      key: 'difficulty',
      icon: difficultyConfig[parsed.difficulty].icon,
      label: difficultyConfig[parsed.difficulty].label,
      color: difficultyConfig[parsed.difficulty].color,
    });
  }

  if (parsed?.priority) {
    badges.push({
      key: 'priority',
      icon: AlertTriangle,
      label: parsed.priority === 'urgent-important' ? 'Urgent & Important' :
             parsed.priority === 'urgent-not-important' ? 'Urgent' :
             parsed.priority === 'not-urgent-important' ? 'Important' : '',
      color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
      onRemove: clearPriority,
    });
  }

  if (parsed?.isTopThree) {
    badges.push({
      key: 'top3',
      icon: Star,
      label: 'Top 3',
      color: 'text-stardust-gold bg-stardust-gold/20 border-stardust-gold/40',
      onRemove: clearTopThree,
    });
  }

  if (parsed?.context) {
    badges.push({
      key: 'context',
      icon: MapPin,
      label: `@${parsed.context}`,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
      onRemove: clearContext,
    });
  }

  if (parsed?.recurrencePattern) {
    badges.push({
      key: 'recurrence',
      icon: Repeat,
      label: parsed.recurrencePattern,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
      onRemove: clearRecurrence,
    });
  }

  if (parsed?.energyLevel && parsed.energyLevel !== 'medium') {
    badges.push({
      key: 'energy',
      icon: energyConfig[parsed.energyLevel].icon,
      label: energyConfig[parsed.energyLevel].label,
      color: energyConfig[parsed.energyLevel].color,
    });
  }

  const showTypewriter = isFocused && !input && !isRecording;

  return (
    <div className="space-y-2">
      {/* Input container with glow effect on focus */}
      <motion.div 
        className="relative group"
        animate={justSubmitted ? { scale: [1, 0.98, 1] } : {}}
        transition={{ duration: 0.2 }}
      >
        {/* Glow effect */}
        <AnimatePresence>
          {isFocused && !isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg blur-sm -z-10"
            />
          )}
        </AnimatePresence>
        
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <motion.div
            animate={isFocused ? { rotate: [0, 15, -15, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Sparkles className={cn(
              "h-4 w-4 transition-all duration-300",
              isRecording ? "text-destructive scale-110" : isFocused ? "text-primary" : "text-muted-foreground"
            )} />
          </motion.div>
        </div>
        
        {/* Custom input with typewriter placeholder */}
        <div className="relative">
          <Input
            ref={inputRef}
            value={displayText}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isRecording ? "Listening..." : (showTypewriter ? '' : placeholder)}
            autoFocus={autoFocus}
            disabled={disabled}
            className={cn(
              "pl-10 pr-28 transition-all duration-300",
              isRecording && "border-destructive/50 ring-2 ring-destructive/20 bg-destructive/5",
              isFocused && !isRecording && "ring-2 ring-primary/20"
            )}
          />
          
          {/* Typewriter placeholder overlay */}
          {showTypewriter && (
            <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-sm">
              <TypewriterPlaceholder isActive={showTypewriter} />
            </div>
          )}
        </div>

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
                "h-7 px-2 transition-all duration-200",
                isRecording && "shadow-lg shadow-destructive/30"
              )}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? (
                <span className="relative">
                  <MicOff className="h-4 w-4" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-white rounded-full animate-ping" />
                </span>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {/* Clear Button */}
          <AnimatePresence>
            {(input.trim() || interimText) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Submit Button */}
          <motion.div
            animate={parsed?.text.trim() ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || !parsed?.text.trim()}
              className={cn(
                "h-7 px-3 transition-all duration-200",
                parsed?.text.trim() && "shadow-md hover:shadow-lg hover:scale-105"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Epic Detection Badge */}
      <AnimatePresence>
        {isEpicDetected && !isRecording && input.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-1"
          >
            <Badge 
              variant="outline" 
              className="bg-primary/10 border-primary/30 text-primary gap-1.5 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={handleCreateAsEpic}
            >
              {isClassifying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Target className="w-3 h-3" />
              )}
              Goal detected
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCreateAsEpic}
              className="h-7 text-xs text-primary hover:text-primary"
            >
              Create as Epic →
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habit Detection Badge */}
      <AnimatePresence>
        {isHabitDetected && !isEpicDetected && !isRecording && input.trim() && habits.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-1"
          >
            <Badge 
              variant="outline" 
              className="bg-green-500/10 border-green-500/30 text-green-600 gap-1.5 cursor-pointer hover:bg-green-500/20 transition-colors"
              onClick={handleCreateAsHabit}
            >
              {isClassifying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Leaf className="w-3 h-3" />
              )}
              Habit detected
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCreateAsHabit}
              disabled={isAddingHabit}
              className="h-7 text-xs text-green-600 hover:text-green-600"
            >
              {isAddingHabit ? 'Creating...' : 'Create as Habit →'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Suggestion Chips */}
      <AnimatePresence>
        {isFocused && !isRecording && !isEpicDetected && (
          <QuickSuggestionChips 
            onSuggestionClick={handleSuggestionClick}
            currentInput={input}
            className="px-1"
          />
        )}
      </AnimatePresence>

      {/* Smart Preview with staggered badges */}
      <AnimatePresence>
        {showPreview && badges.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5 px-1 overflow-hidden"
          >
            {/* Cleaned text preview */}
            {parsed.text !== input && parsed.text.length > 0 && (
              <ParsedBadge
                index={0}
                icon={Sparkles}
                label={parsed.text.length > 30 ? parsed.text.slice(0, 30) + '...' : parsed.text}
                colorClass="text-primary bg-primary/5 border-primary/20"
              />
            )}
            
            {badges.map((badge, index) => (
              <ParsedBadge
                key={badge.key}
                index={index + (parsed.text !== input ? 1 : 0)}
                icon={badge.icon}
                label={badge.label}
                colorClass={badge.color}
                onRemove={badge.onRemove}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator with real audio waveform */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-3 px-1"
          >
            <AudioReactiveWaveform isActive={isRecording && !isAutoStopping} barCount={7} />
            <motion.p 
              className={cn(
                "text-xs transition-colors",
                isAutoStopping ? "text-green-500" : "text-destructive"
              )}
              animate={isAutoStopping ? { scale: [1, 1.05, 1] } : {}}
            >
              {isAutoStopping ? (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Finishing...
                </span>
              ) : (
                "Listening..."
              )}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Preview Card - shown for voice input or when user wants to preview */}
      <AnimatePresence>
        {voicePreview && !isRecording && (
          <TaskPreviewCard
            parsed={parseNaturalLanguage(voicePreview)}
            rawInput={voicePreview}
            onConfirm={() => handlePreviewConfirm()}
            onConfirmWithSubtasks={handleConfirmWithSubtasks}
            onEdit={handlePreviewEdit}
            onDiscard={handlePreviewDiscard}
            isVoiceInput={true}
            onBreakdown={handleBreakdown}
            isBreakingDown={isBreakingDown}
            suggestedSubtasks={suggestedSubtasks}
            onSubtasksChange={setSuggestedSubtasks}
            className="mx-1"
          />
        )}
      </AnimatePresence>

      {/* Permission Request Dialog */}
      <PermissionRequestDialog
        isOpen={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onRequestPermission={handleRequestPermission}
        permissionStatus={permissionStatus}
        isRequesting={isRequestingPermission}
      />

      {/* Smart Epic Wizard */}
      <SmartEpicWizard
        open={showEpicWizard}
        onOpenChange={setShowEpicWizard}
        onCreateEpic={handleEpicCreated}
        isCreating={isCreatingEpic}
        initialGoal={input}
        initialTargetDays={classification?.suggestedDuration}
      />
    </div>
  );
}
