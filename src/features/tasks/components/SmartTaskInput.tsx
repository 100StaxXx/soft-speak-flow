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
  StickyNote,
  Loader2,
  List
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNaturalLanguageParser, ParsedTask } from '../hooks/useNaturalLanguageParser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useIntentClassifier, ExtractedTask } from '@/hooks/useIntentClassifier';
import { useTaskDecomposition, SuggestedSubtask } from '@/hooks/useTaskDecomposition';
import { PermissionRequestDialog } from '@/components/PermissionRequestDialog';
import { AudioReactiveWaveform } from '@/components/AudioReactiveWaveform';
import { TypewriterPlaceholder } from '@/components/TypewriterPlaceholder';
import { QuickSuggestionChips } from './QuickSuggestionChips';
import { ParsedBadge } from './ParsedBadge';
import { TaskPreviewCard } from './TaskPreviewCard';
import { ClarificationBubble } from './ClarificationBubble';
import { TaskBatchPreview } from './TaskBatchPreview';
import { EpicClarificationFlow } from './EpicClarificationFlow';
import { Pathfinder } from '@/components/Pathfinder/Pathfinder';
import { CapacityWarningBanner } from '@/components/CapacityWarningBanner';
import { useEpics } from '@/hooks/useEpics';
import { useHabits } from '@/features/habits';
import { useAIInteractionTracker } from '@/hooks/useAIInteractionTracker';
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
  
  // Brain dump state
  const [showClarification, setShowClarification] = useState(false);
  const [originalBrainDump, setOriginalBrainDump] = useState('');
  const [showBatchPreview, setShowBatchPreview] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  
  // Breakdown state
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<SuggestedSubtask[]>([]);
  const { decompose, isLoading: isBreakingDown } = useTaskDecomposition();

  const { medium, success, light, tap } = useHapticFeedback();
  const { createEpic, isCreating: isCreatingEpic } = useEpics();
  const { addHabit, isAddingHabit, habits } = useHabits();
  
  // Intent classification for detecting epics/habits/brain-dumps
  // Enable orchestrator for centralized AI handling
  const { 
    classification, 
    isClassifying, 
    classifyDebounced, 
    reset: resetClassification,
    clarify,
    clarifyEpic,
    isEpicDetected,
    isHabitDetected,
    isBrainDumpDetected,
    needsClarification,
    clarifyingQuestion,
    extractedTasks,
    suggestedTasks,
    detectedContext,
    needsEpicClarification,
    epicClarifyingQuestions,
    epicContext,
    epicDetails,
    capacityWarnings,
  } = useIntentClassifier({ debounceMs: 600, minInputLength: 15, useOrchestrator: true });
  
  // Epic clarification state
  const [showEpicClarification, setShowEpicClarification] = useState(false);
  const [epicClarificationAnswers, setEpicClarificationAnswers] = useState<Record<string, string | number> | null>(null);

  // Trigger classification when input changes
  useEffect(() => {
    if (input.trim()) {
      classifyDebounced(input);
    }
  }, [input, classifyDebounced]);

  // Handle brain dump with clarification
  useEffect(() => {
    if (isBrainDumpDetected && needsClarification && !showClarification) {
      setOriginalBrainDump(input);
      setShowClarification(true);
    } else if (isBrainDumpDetected && !needsClarification && extractedTasks.length >= 2) {
      // Ready to show preview
      setShowClarification(false);
    }
  }, [isBrainDumpDetected, needsClarification, showClarification, input, extractedTasks.length]);

  // Handle epic clarification detection
  useEffect(() => {
    if (needsEpicClarification && !showEpicClarification && epicClarifyingQuestions.length > 0) {
      setShowEpicClarification(true);
    }
  }, [needsEpicClarification, showEpicClarification, epicClarifyingQuestions.length]);

  // Handle epic clarification submission
  const handleEpicClarificationSubmit = async (answers: Record<string, string | number>) => {
    setEpicClarificationAnswers(answers);
    await clarifyEpic(input, answers);
    setShowEpicClarification(false);
    setShowEpicWizard(true);
  };

  // Handle skipping epic clarification  
  const handleSkipEpicClarification = () => {
    setShowEpicClarification(false);
    setShowEpicWizard(true);
  };
  
  // AI interaction tracking for learning from user actions
  const { trackInteraction } = useAIInteractionTracker();
  
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
    // If brain dump detected, open batch preview instead
    if (isBrainDumpDetected && extractedTasks.length >= 2) {
      setShowBatchPreview(true);
      return;
    }
    
    if (!parsed || !parsed.text.trim()) return;
    
    // Show preview for confirmation instead of creating immediately
    success(); // Haptic feedback
    setPreviewSource('typed');
    setShowPreviewCard(true);
  };

  const handleClear = () => {
    light();
    reset();
    resetClassification();
    setInterimText('');
    setVoicePreview(null);
    setShowPreviewCard(false);
    setSuggestedSubtasks([]);
    setShowClarification(false);
    setOriginalBrainDump('');
  };

  // Handle clarification answer
  const handleClarificationAnswer = async (answer: string) => {
    await clarify(originalBrainDump, answer);
    setShowClarification(false);
  };

  // Handle skipping clarification
  const handleSkipClarification = () => {
    setShowClarification(false);
    if (extractedTasks.length >= 2) {
      setShowBatchPreview(true);
    }
  };

  // Handle batch task creation
  const handleBatchConfirm = async (tasks: ExtractedTask[]) => {
    if (tasks.length === 0) return;
    
    setIsCreatingBatch(true);
    try {
      // Create tasks one by one with parsed data
      for (const task of tasks) {
        const parsedTask = parseNaturalLanguage(task.title);
        // Apply detected context
        if (detectedContext?.targetDate && !parsedTask.scheduledDate) {
          parsedTask.scheduledDate = detectedContext.targetDate;
        }
        if (task.estimatedDuration && !parsedTask.estimatedDuration) {
          parsedTask.estimatedDuration = task.estimatedDuration;
        }
        if (task.energyLevel && parsedTask.energyLevel === 'medium') {
          parsedTask.energyLevel = task.energyLevel;
        }
        onSubmit(parsedTask);
      }
      
      // Track AI interaction - user accepted brain-dump suggestions
      trackInteraction({
        interactionType: 'brain-dump',
        inputText: originalBrainDump,
        aiResponse: { extractedTasks: tasks },
        userAction: 'accepted',
        detectedIntent: 'brain-dump',
      });
      
      success();
      toast.success(`Created ${tasks.length} tasks!`);
      setShowBatchPreview(false);
      reset();
      resetClassification();
      setOriginalBrainDump('');
    } catch (error) {
      toast.error('Failed to create tasks');
    } finally {
      setIsCreatingBatch(false);
    }
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
    // Track AI interaction - user accepted epic suggestion
    trackInteraction({
      interactionType: 'classify',
      inputText: input,
      aiResponse: classification ? { ...classification } : undefined,
      userAction: 'accepted',
      detectedIntent: 'epic',
    });
    setShowEpicWizard(true);
  };

  const handleCreateAsHabit = () => {
    if (!parsed?.text.trim()) return;
    medium();
    
    // Track AI interaction - user accepted habit suggestion
    trackInteraction({
      interactionType: 'classify',
      inputText: input,
      aiResponse: classification ? { ...classification } : undefined,
      userAction: 'accepted',
      detectedIntent: 'habit',
    });
    
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
    // Track AI interaction - user rejected/discarded suggestion
    if (classification) {
      trackInteraction({
        interactionType: 'classify',
        inputText: voicePreview || input,
        aiResponse: { ...classification },
        userAction: 'rejected',
        detectedIntent: classification.type,
      });
    }
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

  const clearNotes = () => {
    tap();
    const notePatterns = [
      /\bnotes?:\s*(.+?)(?=\s*(?:!{1,4}|p[1-4]|\bat\s+\d|@|\bremind|\btomorrow|\btoday|$))/gi,
      /\/\/\s*(.+?)$/gi,
      /\(([^)]+)\)\s*$/gi,
      /\s+-\s+(.+?)$/gi,
    ];
    let newInput = input;
    notePatterns.forEach(p => newInput = newInput.replace(p, ''));
    setInput(newInput.replace(/\s+/g, ' ').trim());
  };

  const showPreview = isFocused && parsed && (
    parsed.scheduledTime ||
    parsed.scheduledDate ||
    parsed.estimatedDuration ||
    parsed.difficulty !== 'medium' ||
    parsed.notes ||
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
    const priorityConfig: Record<'low' | 'medium' | 'high' | 'urgent', { label: string; color: string }> = {
      urgent: { label: 'Urgent', color: 'text-red-500 bg-red-500/10 border-red-500/30' },
      high: { label: 'High Priority', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
      medium: { label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
      low: { label: 'Low Priority', color: 'text-muted-foreground bg-muted/10 border-muted/30' },
    };
    badges.push({
      key: 'priority',
      icon: AlertTriangle,
      label: priorityConfig[parsed.priority].label,
      color: priorityConfig[parsed.priority].color,
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

  if (parsed?.notes) {
    badges.push({
      key: 'notes',
      icon: StickyNote,
      label: parsed.notes.length > 20 ? parsed.notes.substring(0, 20) + '...' : parsed.notes,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      onRemove: clearNotes,
    });
  }

  const showTypewriter = isFocused && !input && !isRecording;

  return (
    <div className="space-y-2">
      {/* Capacity Warning Banner */}
      <CapacityWarningBanner
        isAtEpicLimit={capacityWarnings?.atEpicLimit}
        isOverloaded={capacityWarnings?.overloaded}
        suggestedWorkload={capacityWarnings?.suggestedWorkload}
        isLoading={isClassifying}
      />
      
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

      {/* Brain Dump Detection Badge */}
      <AnimatePresence>
        {isBrainDumpDetected && !isRecording && input.trim() && !showClarification && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-1"
          >
            <Badge 
              variant="outline" 
              className="bg-cyan-500/10 border-cyan-500/30 text-cyan-600 gap-1.5 cursor-pointer hover:bg-cyan-500/20 transition-colors"
              onClick={() => setShowBatchPreview(true)}
            >
              {isClassifying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <List className="w-3 h-3" />
              )}
              {extractedTasks.length} tasks detected
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowBatchPreview(true)}
              className="h-7 text-xs text-cyan-600 hover:text-cyan-600"
            >
              Review & Create →
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Epic Clarification Flow */}
      <AnimatePresence>
        {showEpicClarification && epicClarifyingQuestions.length > 0 && (
          <EpicClarificationFlow
            goal={input}
            questions={epicClarifyingQuestions}
            onSubmit={handleEpicClarificationSubmit}
            onSkip={handleSkipEpicClarification}
            isLoading={isClassifying}
          />
        )}
      </AnimatePresence>

      {/* Clarification Bubble */}
      <AnimatePresence>
        {showClarification && clarifyingQuestion && (
          <ClarificationBubble
            question={clarifyingQuestion}
            onAnswer={handleClarificationAnswer}
            onSkip={handleSkipClarification}
            isLoading={isClassifying}
          />
        )}
      </AnimatePresence>

      {/* Epic Detection Badge */}
      <AnimatePresence>
        {isEpicDetected && !isBrainDumpDetected && !isRecording && input.trim() && (
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
        {isHabitDetected && !isEpicDetected && !isBrainDumpDetected && !isRecording && input.trim() && habits.length < 2 && (
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
        {isFocused && !isRecording && !isEpicDetected && !isBrainDumpDetected && (
          <QuickSuggestionChips 
            onSuggestionClick={handleSuggestionClick}
            currentInput={input}
            className="px-1"
          />
        )}
      </AnimatePresence>

      {/* Smart Preview with staggered badges */}
      <AnimatePresence>
        {showPreview && badges.length > 0 && !isBrainDumpDetected && (
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

      {/* Task Preview Card - shown for voice input or typed input confirmation */}
      <AnimatePresence>
        {showPreviewCard && !isRecording && (voicePreview || parsed?.text.trim()) && (
          <TaskPreviewCard
            parsed={voicePreview ? parseNaturalLanguage(voicePreview) : parsed!}
            rawInput={voicePreview || input}
            onConfirm={() => handlePreviewConfirm()}
            onConfirmWithSubtasks={handleConfirmWithSubtasks}
            onEdit={handlePreviewEdit}
            onDiscard={handlePreviewDiscard}
            isVoiceInput={previewSource === 'voice'}
            onBreakdown={handleBreakdown}
            isBreakingDown={isBreakingDown}
            suggestedSubtasks={suggestedSubtasks}
            onSubtasksChange={setSuggestedSubtasks}
            onCreateAsEpic={() => {
              setShowPreviewCard(false);
              if (voicePreview) {
                setInput(voicePreview);
                setVoicePreview(null);
              }
              setShowEpicWizard(true);
            }}
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

      {/* Pathfinder */}
      <Pathfinder
        open={showEpicWizard}
        onOpenChange={setShowEpicWizard}
        onCreateEpic={handleEpicCreated}
        isCreating={isCreatingEpic}
        initialGoal={input}
        initialTargetDays={epicDetails?.suggestedTargetDays || classification?.suggestedDuration}
        clarificationAnswers={epicClarificationAnswers || undefined}
        epicContext={epicContext}
      />

      {/* Task Batch Preview Modal */}
      <TaskBatchPreview
        open={showBatchPreview}
        onOpenChange={setShowBatchPreview}
        extractedTasks={extractedTasks}
        suggestedTasks={suggestedTasks}
        detectedContext={detectedContext}
        onConfirm={handleBatchConfirm}
        isCreating={isCreatingBatch}
      />
    </div>
  );
}
