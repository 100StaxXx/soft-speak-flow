import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Battery, BatteryLow, BatteryFull, Target, Shield, 
  Clock, ChevronRight, X, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PlanMyDayAnswers {
  energyLevel: 'low' | 'medium' | 'high';
  prioritizedEpicId?: string;
  protectStreaks?: boolean;
  availableHours?: number;
  constraints?: string;
}

interface Epic {
  id: string;
  title: string;
  progress_percentage?: number | null;
}

interface HabitAtRisk {
  id: string;
  title: string;
  current_streak: number;
}

interface PlanMyDayClarificationProps {
  onComplete: (answers: PlanMyDayAnswers) => void;
  onSkip: () => void;
  isLoading?: boolean;
  activeEpics?: Epic[];
  habitsAtRisk?: HabitAtRisk[];
}

type QuestionStep = 'energy' | 'epic' | 'streaks' | 'time';

export function PlanMyDayClarification({
  onComplete,
  onSkip,
  isLoading = false,
  activeEpics = [],
  habitsAtRisk = [],
}: PlanMyDayClarificationProps) {
  const [step, setStep] = useState<QuestionStep>('energy');
  const [answers, setAnswers] = useState<Partial<PlanMyDayAnswers>>({});

  // Determine which questions to show
  const hasMultipleEpics = activeEpics.length > 1;
  const hasStreaksAtRisk = habitsAtRisk.length > 0;

  const getNextStep = (current: QuestionStep): QuestionStep | 'done' => {
    if (current === 'energy') {
      if (hasMultipleEpics) return 'epic';
      if (hasStreaksAtRisk) return 'streaks';
      return 'time';
    }
    if (current === 'epic') {
      if (hasStreaksAtRisk) return 'streaks';
      return 'time';
    }
    if (current === 'streaks') return 'time';
    return 'done';
  };

  const handleEnergySelect = (level: 'low' | 'medium' | 'high') => {
    const newAnswers = { ...answers, energyLevel: level };
    setAnswers(newAnswers);
    
    const next = getNextStep('energy');
    if (next === 'done' || next === 'time') {
      // Skip time question for now, complete
      onComplete({ energyLevel: level, ...newAnswers });
    } else {
      setStep(next);
    }
  };

  const handleEpicSelect = (epicId: string | 'balanced') => {
    const newAnswers = { 
      ...answers, 
      prioritizedEpicId: epicId === 'balanced' ? undefined : epicId 
    };
    setAnswers(newAnswers);
    
    const next = getNextStep('epic');
    if (next === 'done' || next === 'time') {
      onComplete({ energyLevel: answers.energyLevel || 'medium', ...newAnswers });
    } else {
      setStep(next);
    }
  };

  const handleStreakProtect = (protect: boolean) => {
    const newAnswers = { ...answers, protectStreaks: protect };
    setAnswers(newAnswers);
    onComplete({ energyLevel: answers.energyLevel || 'medium', ...newAnswers });
  };

  const energyOptions = [
    { value: 'low' as const, icon: BatteryLow, label: 'Low', desc: 'Keep it light' },
    { value: 'medium' as const, icon: Battery, label: 'Medium', desc: 'Balanced' },
    { value: 'high' as const, icon: BatteryFull, label: 'High', desc: 'Bring it on' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="relative bg-gradient-to-br from-violet-500/10 to-purple-500/5 
                 border border-violet-500/20 rounded-xl p-4 shadow-lg"
    >
      {/* Close button */}
      <button
        onClick={onSkip}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 
                   text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-violet-500/20">
          <Sparkles className="h-4 w-4 text-violet-400" />
        </div>
        <span className="text-sm font-medium text-violet-300">Plan My Day</span>
      </div>

      <AnimatePresence mode="wait">
        {/* Energy Question */}
        {step === 'energy' && (
          <motion.div
            key="energy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">How's your energy today?</p>
            <div className="flex gap-2">
              {energyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleEnergySelect(opt.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                    "bg-background/50 hover:bg-background/80 border-border/50 hover:border-violet-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <opt.icon className="h-5 w-5 text-violet-400" />
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Epic Priority Question */}
        {step === 'epic' && (
          <motion.div
            key="epic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">Which goal should we focus on?</p>
            <div className="flex flex-col gap-2">
              {activeEpics.slice(0, 3).map((epic) => (
                <button
                  key={epic.id}
                  onClick={() => handleEpicSelect(epic.id)}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    "bg-background/50 hover:bg-background/80 border-border/50 hover:border-violet-500/50",
                    "disabled:opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-violet-400" />
                    <span className="text-sm">{epic.title}</span>
                  </div>
                  {epic.progress_percentage !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(epic.progress_percentage || 0)}%
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => handleEpicSelect('balanced')}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border transition-all",
                  "bg-background/30 hover:bg-background/50 border-border/30 hover:border-violet-500/30",
                  "text-muted-foreground hover:text-foreground disabled:opacity-50"
                )}
              >
                <span className="text-sm">Balance all goals</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Streak Protection Question */}
        {step === 'streaks' && (
          <motion.div
            key="streaks"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">
              Protect your {habitsAtRisk.length > 1 ? 'streaks' : 'streak'}?
            </p>
            <div className="text-xs text-muted-foreground mb-2">
              {habitsAtRisk.slice(0, 2).map((h, i) => (
                <span key={h.id}>
                  {i > 0 && ', '}
                  {h.title} ({h.current_streak}d)
                </span>
              ))}
              {habitsAtRisk.length > 2 && ` +${habitsAtRisk.length - 2} more`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStreakProtect(true)}
                disabled={isLoading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                  "bg-green-500/10 hover:bg-green-500/20 border-green-500/30 hover:border-green-500/50",
                  "text-green-400 disabled:opacity-50"
                )}
              >
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Protect</span>
              </button>
              <button
                onClick={() => handleStreakProtect(false)}
                disabled={isLoading}
                className={cn(
                  "flex-1 p-3 rounded-lg border transition-all",
                  "bg-background/30 hover:bg-background/50 border-border/30",
                  "text-muted-foreground hover:text-foreground disabled:opacity-50"
                )}
              >
                <span className="text-sm">Skip today</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip link */}
      <div className="flex justify-end mt-4">
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Planning...</span>
            </>
          ) : (
            <>
              <span>Use defaults</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
