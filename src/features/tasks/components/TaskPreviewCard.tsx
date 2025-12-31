import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Timer,
  Zap, 
  Flame, 
  Mountain,
  Battery,
  BatteryLow,
  BatteryFull,
  AlertTriangle,
  Star,
  MapPin,
  Repeat,
  Sparkles,
  Pencil,
  Plus,
  X,
  Mic,
  ChevronDown,
  Loader2,
  Wand2,
  Target,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ParsedTask } from '../hooks/useNaturalLanguageParser';
import { SuggestedSubtask } from '@/hooks/useTaskDecomposition';
import { SubtaskPreviewList } from './SubtaskPreviewList';
import { useIntentClassifier } from '@/hooks/useIntentClassifier';

interface TaskPreviewCardProps {
  parsed: ParsedTask;
  rawInput: string;
  onConfirm: () => void;
  onConfirmWithSubtasks?: (subtasks: SuggestedSubtask[]) => void;
  onEdit: () => void;
  onDiscard: () => void;
  isVoiceInput?: boolean;
  // Breakdown-related props
  onBreakdown?: () => void;
  isBreakingDown?: boolean;
  suggestedSubtasks?: SuggestedSubtask[];
  onSubtasksChange?: (subtasks: SuggestedSubtask[]) => void;
  // Epic flow props
  onCreateAsEpic?: (answers?: Record<string, string | number>) => void;
  className?: string;
}

// Detection logic for "big goals" that could benefit from breakdown
function looksLikeBigGoal(
  text: string, 
  estimatedDuration?: number,
  scheduledDate?: string | null
): boolean {
  if (!text) return false;
  
  const cleanText = text.toLowerCase().trim();
  
  // 1. Action verbs
  const actionKeywords = [
    'launch', 'build', 'create', 'develop', 'design', 'implement',
    'plan', 'organize', 'set up', 'setup', 'finish', 'complete', 
    'start', 'begin', 'make', 'write', 'research', 'learn', 'master',
    'study', 'pass', 'get', 'achieve', 'earn', 'become'
  ];
  
  // 2. Preparation phrases (strongest signal)
  const preparationPhrases = [
    'prepare for', 'get ready for', 'study for', 'practice for',
    'train for', 'prep for', 'preparing for', 'ready for',
    'work toward', 'working toward', 'aim for', 'aiming for',
    'for the'  // catches "For the bar exam"
  ];
  
  // 3. Goal subjects
  const goalSubjects = [
    'exam', 'certification', 'degree', 'license', 'marathon', 
    'wedding', 'business', 'company', 'app', 'website', 'project',
    'move', 'house', 'career', 'job', 'promotion', 'interview',
    'presentation', 'launch', 'renovation', 'trip', 'vacation'
  ];
  
  // 4. Future date pattern (by Month Year / by Year / next year / this year)
  const hasFutureDatePhrase = /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})/i.test(cleanText)
    || /\b(this year|next year|end of year|by end of|by the end)\b/i.test(cleanText);
  
  // 5. Check if scheduled date is >14 days out (far future = likely needs breakdown)
  const isFarOut = scheduledDate 
    ? (new Date(scheduledDate).getTime() - Date.now()) > 14 * 24 * 60 * 60 * 1000
    : false;
    
  const hasActionKeyword = actionKeywords.some(kw => cleanText.includes(kw));
  const hasPreparationPhrase = preparationPhrases.some(p => cleanText.includes(p));
  const hasGoalSubject = goalSubjects.some(s => cleanText.includes(s));
  const isLongText = cleanText.length > 35;
  const hasNoDuration = !estimatedDuration;
  
  // Trigger breakdown suggestion if ANY of these conditions are met:
  return (
    // Has preparation phrase (strongest signal)
    hasPreparationPhrase ||
    // Goal subject + (future date OR far out OR long text)
    (hasGoalSubject && (hasFutureDatePhrase || isFarOut || isLongText)) ||
    // Action keyword + (no duration OR long text)
    (hasActionKeyword && (hasNoDuration || isLongText)) ||
    // Far out date (>2 weeks) + no specific duration
    (isFarOut && hasNoDuration) ||
    // Future date phrase + no duration
    (hasFutureDatePhrase && hasNoDuration)
  );
}

export function TaskPreviewCard({
  parsed,
  rawInput,
  onConfirm,
  onConfirmWithSubtasks,
  onEdit,
  onDiscard,
  isVoiceInput = false,
  onBreakdown,
  isBreakingDown = false,
  suggestedSubtasks,
  onSubtasksChange,
  onCreateAsEpic,
  className
}: TaskPreviewCardProps) {
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);
  
  // Epic detection for big goals
  const {
    classify,
    isClassifying: isCheckingEpic,
    needsEpicClarification,
    epicClarifyingQuestions,
    isEpicDetected,
    reset: resetClassification
  } = useIntentClassifier({ debounceMs: 0, minInputLength: 10 });
  
  const [hasCheckedEpic, setHasCheckedEpic] = useState(false);
  const [showEpicPrompt, setShowEpicPrompt] = useState(false);
  
  // Check for epic on mount
  useEffect(() => {
    const textToCheck = parsed.text || rawInput;
    if (textToCheck && !hasCheckedEpic && looksLikeBigGoal(textToCheck, parsed.estimatedDuration, parsed.scheduledDate)) {
      classify(textToCheck);
      setHasCheckedEpic(true);
    }
  }, [parsed.text, rawInput, hasCheckedEpic, classify, parsed.estimatedDuration, parsed.scheduledDate]);
  
  // Show epic prompt when detection completes
  useEffect(() => {
    if (hasCheckedEpic && !isCheckingEpic && (isEpicDetected || needsEpicClarification)) {
      setShowEpicPrompt(true);
    }
  }, [hasCheckedEpic, isCheckingEpic, isEpicDetected, needsEpicClarification]);
  
  const handleCreateAsEpic = () => {
    if (onCreateAsEpic) {
      onCreateAsEpic();
    }
  };
  
  const difficultyConfig = {
    easy: { icon: Zap, label: 'Easy', color: 'text-green-500 bg-green-500/10' },
    medium: { icon: Flame, label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10' },
    hard: { icon: Mountain, label: 'Hard', color: 'text-red-500 bg-red-500/10' },
  };

  const energyConfig = {
    low: { icon: BatteryLow, label: 'Low Energy', color: 'text-blue-400 bg-blue-400/10' },
    medium: { icon: Battery, label: 'Medium Energy', color: 'text-blue-500 bg-blue-500/10' },
    high: { icon: BatteryFull, label: 'High Energy', color: 'text-blue-600 bg-blue-600/10' },
  };

  const hasMetadata = parsed.scheduledDate || 
    parsed.scheduledTime || 
    parsed.estimatedDuration || 
    parsed.context || 
    parsed.priority || 
    parsed.isTopThree || 
    parsed.recurrencePattern ||
    parsed.reminderEnabled ||
    parsed.difficulty !== 'medium' ||
    parsed.energyLevel !== 'medium';

  const showBreakdownPrompt = onBreakdown && 
    !suggestedSubtasks?.length && 
    !isBreakingDown &&
    looksLikeBigGoal(parsed.text || rawInput, parsed.estimatedDuration, parsed.scheduledDate);

  const hasSubtasks = suggestedSubtasks && suggestedSubtasks.length > 0;
  const selectedSubtasks = suggestedSubtasks?.filter(s => s.selected) || [];

  const handleConfirmWithSteps = () => {
    if (onConfirmWithSubtasks && selectedSubtasks.length > 0) {
      onConfirmWithSubtasks(selectedSubtasks);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        "rounded-xl border bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden",
        isVoiceInput && "border-primary/30",
        className
      )}
    >
      {/* Header with task text */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "mt-0.5 p-2 rounded-lg shrink-0",
            isVoiceInput ? "bg-primary/10" : "bg-muted"
          )}>
            {isVoiceInput ? (
              <Mic className="w-4 h-4 text-primary" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {parsed.text || rawInput}
            </p>
            {parsed.text !== rawInput && parsed.text && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                from: "{rawInput}"
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metadata badges */}
      {hasMetadata && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {parsed.scheduledDate && (
              <MetaBadge 
                icon={Calendar} 
                label={format(parseISO(parsed.scheduledDate), 'EEE, MMM d')} 
                colorClass="text-blue-500 bg-blue-500/10"
              />
            )}
            {parsed.scheduledTime && (
              <MetaBadge 
                icon={Clock} 
                label={formatTime(parsed.scheduledTime)} 
                colorClass="text-purple-500 bg-purple-500/10"
              />
            )}
            {parsed.estimatedDuration && (
              <MetaBadge 
                icon={Timer} 
                label={formatDuration(parsed.estimatedDuration)} 
                colorClass="text-cyan-500 bg-cyan-500/10"
              />
            )}
            {parsed.difficulty !== 'medium' && (
              <MetaBadge 
                icon={difficultyConfig[parsed.difficulty].icon} 
                label={difficultyConfig[parsed.difficulty].label} 
                colorClass={difficultyConfig[parsed.difficulty].color}
              />
            )}
            {parsed.priority && (
              <MetaBadge 
                icon={AlertTriangle} 
                label={formatPriority(parsed.priority)} 
                colorClass="text-orange-500 bg-orange-500/10"
              />
            )}
            {parsed.isTopThree && (
              <MetaBadge 
                icon={Star} 
                label="Top 3" 
                colorClass="text-stardust-gold bg-stardust-gold/20"
              />
            )}
            {parsed.context && (
              <MetaBadge 
                icon={MapPin} 
                label={`@${parsed.context}`} 
                colorClass="text-emerald-500 bg-emerald-500/10"
              />
            )}
            {parsed.recurrencePattern && (
              <MetaBadge 
                icon={Repeat} 
                label={parsed.recurrencePattern} 
                colorClass="text-indigo-500 bg-indigo-500/10"
              />
            )}
            {parsed.reminderEnabled && parsed.reminderMinutesBefore && (
              <MetaBadge 
                icon={Bell} 
                label={formatReminderTime(parsed.reminderMinutesBefore)} 
                colorClass="text-amber-500 bg-amber-500/10"
              />
            )}
            {parsed.energyLevel !== 'medium' && (
              <MetaBadge 
                icon={energyConfig[parsed.energyLevel].icon} 
                label={energyConfig[parsed.energyLevel].label} 
                colorClass={energyConfig[parsed.energyLevel].color}
              />
            )}
          </div>
        </div>
      )}

      {/* Epic Detection Prompt */}
      <AnimatePresence>
        {showEpicPrompt && onCreateAsEpic && !hasSubtasks && !isBreakingDown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  This looks like a bigger goal!
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Create as an Epic to track progress with habits and milestones
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="sm"
                  onClick={handleCreateAsEpic}
                  className="h-7 text-xs gap-1.5"
                >
                  <Target className="w-3 h-3" />
                  Create as Epic
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowEpicPrompt(false)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Just a task
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breakdown Prompt - Only show if not showing epic prompt */}
      <AnimatePresence>
        {showBreakdownPrompt && !showEpicPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  Break into steps?
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onBreakdown}
                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                Break it down →
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {isBreakingDown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-muted/30">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Breaking down your goal...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtasks Section */}
      <AnimatePresence>
        {hasSubtasks && !isBreakingDown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            {/* Collapsible header */}
            <button
              onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
              className="flex items-center justify-between w-full mb-2 group"
            >
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Suggested steps ({selectedSubtasks.length} selected)
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                isSubtasksExpanded && "rotate-180"
              )} />
            </button>

            {/* Subtask list */}
            <AnimatePresence>
              {isSubtasksExpanded && onSubtasksChange && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <SubtaskPreviewList
                    subtasks={suggestedSubtasks!}
                    onChange={onSubtasksChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/30 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 px-3 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
        
        <div className="flex items-center gap-2">
          {hasSubtasks && selectedSubtasks.length > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onConfirm}
                className="h-8 px-3 text-muted-foreground"
              >
                Just the task
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmWithSteps}
                className="h-8 px-4 gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Create with {selectedSubtasks.length} steps
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onConfirm}
              className="h-8 px-4 gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Task
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Helper component for metadata badges
function MetaBadge({ 
  icon: Icon, 
  label, 
  colorClass 
}: { 
  icon: typeof Calendar; 
  label: string; 
  colorClass: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
      colorClass
    )}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Format time from 24h to 12h
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format duration
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Format priority
function formatPriority(priority: string): string {
  switch (priority) {
    case 'urgent-important': return 'Urgent & Important';
    case 'urgent-not-important': return 'Urgent';
    case 'not-urgent-important': return 'Important';
    default: return '';
  }
}

// Format reminder time
function formatReminderTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m before` : `${hours}h before`;
  }
  return `${minutes}m before`;
}
