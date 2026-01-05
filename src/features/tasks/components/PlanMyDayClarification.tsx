import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Battery, BatteryLow, BatteryFull, 
  Briefcase, Coffee, Shuffle,
  TrendingUp, Home, Heart, Users, Shield,
  ChevronRight, X, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanMyDayAnswers {
  energyLevel: 'low' | 'medium' | 'high';
  dayType: 'workday' | 'dayoff' | 'mixed';
  focusArea: 'progress' | 'order' | 'health' | 'connection' | 'survival';
}

interface PlanMyDayClarificationProps {
  onComplete: (answers: PlanMyDayAnswers) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

type QuestionStep = 'energy' | 'dayType' | 'focus';

export function PlanMyDayClarification({
  onComplete,
  onSkip,
  isLoading = false,
}: PlanMyDayClarificationProps) {
  const [step, setStep] = useState<QuestionStep>('energy');
  const [answers, setAnswers] = useState<Partial<PlanMyDayAnswers>>({});

  const handleEnergySelect = (level: 'low' | 'medium' | 'high') => {
    setAnswers({ ...answers, energyLevel: level });
    setStep('dayType');
  };

  const handleDayTypeSelect = (dayType: 'workday' | 'dayoff' | 'mixed') => {
    setAnswers({ ...answers, dayType });
    setStep('focus');
  };

  const handleFocusSelect = (focus: 'progress' | 'order' | 'health' | 'connection' | 'survival') => {
    const finalAnswers: PlanMyDayAnswers = {
      energyLevel: answers.energyLevel || 'medium',
      dayType: answers.dayType || 'mixed',
      focusArea: focus,
    };
    onComplete(finalAnswers);
  };

  const energyOptions = [
    { value: 'low' as const, icon: BatteryLow, label: 'Low', desc: 'Keep it light' },
    { value: 'medium' as const, icon: Battery, label: 'Medium', desc: 'Balanced day' },
    { value: 'high' as const, icon: BatteryFull, label: 'High', desc: 'Bring it on' },
  ];

  const dayTypeOptions = [
    { value: 'workday' as const, icon: Briefcase, label: 'Workday', desc: 'Full schedule' },
    { value: 'dayoff' as const, icon: Coffee, label: 'Day Off', desc: 'Relaxed pace' },
    { value: 'mixed' as const, icon: Shuffle, label: 'Mixed', desc: 'Bit of both' },
  ];

  const focusOptions = [
    { value: 'progress' as const, icon: TrendingUp, label: 'Progress', desc: 'Work & goals' },
    { value: 'order' as const, icon: Home, label: 'Order', desc: 'Cleaning & admin' },
    { value: 'health' as const, icon: Heart, label: 'Health', desc: 'Body & mind' },
    { value: 'connection' as const, icon: Users, label: 'Connection', desc: 'Relationships' },
    { value: 'survival' as const, icon: Shield, label: 'Survival', desc: 'Bare minimum' },
  ];

  const getStepNumber = () => {
    if (step === 'energy') return 1;
    if (step === 'dayType') return 2;
    return 3;
  };

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
        <span className="ml-auto text-xs text-muted-foreground">{getStepNumber()}/3</span>
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

        {/* Day Type Question */}
        {step === 'dayType' && (
          <motion.div
            key="dayType"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">What kind of day is this?</p>
            <div className="flex gap-2">
              {dayTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDayTypeSelect(opt.value)}
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

        {/* Focus Area Question */}
        {step === 'focus' && (
          <motion.div
            key="focus"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">What do you want more of today?</p>
            <div className="grid grid-cols-3 gap-2">
              {focusOptions.slice(0, 3).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFocusSelect(opt.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
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
            <div className="grid grid-cols-2 gap-2">
              {focusOptions.slice(3).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFocusSelect(opt.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
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
