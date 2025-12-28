import { motion } from 'framer-motion';
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
  Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ParsedTask } from '../hooks/useNaturalLanguageParser';

interface TaskPreviewCardProps {
  parsed: ParsedTask;
  rawInput: string;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  isVoiceInput?: boolean;
  className?: string;
}

export function TaskPreviewCard({
  parsed,
  rawInput,
  onConfirm,
  onEdit,
  onDiscard,
  isVoiceInput = false,
  className
}: TaskPreviewCardProps) {
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
    parsed.difficulty !== 'medium' ||
    parsed.energyLevel !== 'medium';

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
        <Button
          size="sm"
          onClick={onConfirm}
          className="h-8 px-4 gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Task
        </Button>
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
