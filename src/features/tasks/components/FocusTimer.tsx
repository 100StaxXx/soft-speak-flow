import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Zap, Coffee, Brain, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFocusSession, FocusTimerState } from '../hooks/useFocusSession';

interface FocusTimerProps {
  taskId?: string;
  taskName?: string;
  compact?: boolean;
  onComplete?: () => void;
}

const SESSION_TYPES: { 
  type: FocusTimerState['sessionType']; 
  label: string; 
  icon: React.ReactNode;
  color: string;
}[] = [
  { type: 'pomodoro', label: 'Focus', icon: <Brain className="w-4 h-4" />, color: 'text-primary' },
  { type: 'short_break', label: 'Short Break', icon: <Coffee className="w-4 h-4" />, color: 'text-green-500' },
  { type: 'long_break', label: 'Long Break', icon: <Zap className="w-4 h-4" />, color: 'text-blue-500' },
];

export function FocusTimer({ taskId, taskName, compact = false, onComplete }: FocusTimerProps) {
  const {
    timerState,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    resetTimer,
    setSessionType,
    logDistraction,
    stats,
    DURATION_PRESETS,
  } = useFocusSession();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = timerState.totalTime > 0 
    ? ((timerState.totalTime - timerState.timeRemaining) / timerState.totalTime) * 100 
    : 0;

  const handleStart = () => {
    startSession(taskId, timerState.sessionType);
  };

  const handleToggle = () => {
    if (timerState.isPaused) {
      resumeSession();
    } else {
      pauseSession();
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-lg font-mono font-bold text-foreground">
          {formatTime(timerState.timeRemaining)}
        </div>
        {!timerState.isRunning ? (
          <Button size="sm" variant="ghost" onClick={handleStart}>
            <Play className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={handleToggle}>
            {timerState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        {/* Session Type Selector */}
        {!timerState.isRunning && (
          <div className="flex justify-start gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2">
            {SESSION_TYPES.map(({ type, label, icon, color }) => (
              <Button
                key={type}
                variant={timerState.sessionType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSessionType(type)}
                className="gap-2 flex-shrink-0 uppercase text-xs font-semibold"
              >
                <span className={cn(timerState.sessionType !== type && color)}>
                  {icon}
                </span>
                {label}
              </Button>
            ))}
          </div>
        )}

        {/* Timer Display */}
        <div className="relative flex justify-center mb-6">
          <div className="relative w-48 h-48">
            {/* Progress Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              <motion.circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                className={cn(
                  timerState.sessionType === 'pomodoro' && 'text-primary',
                  timerState.sessionType === 'short_break' && 'text-green-500',
                  timerState.sessionType === 'long_break' && 'text-blue-500'
                )}
                strokeDasharray={553}
                strokeDashoffset={553 - (553 * progress) / 100}
                initial={false}
                animate={{ strokeDashoffset: 553 - (553 * progress) / 100 }}
                transition={{ duration: 0.5 }}
              />
            </svg>

            {/* Time Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={timerState.timeRemaining}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-4xl font-mono font-bold text-foreground"
                >
                  {formatTime(timerState.timeRemaining)}
                </motion.div>
              </AnimatePresence>
              <span className="text-sm text-muted-foreground mt-1">
                {timerState.sessionType === 'pomodoro' ? 'Focus Time' : 
                 timerState.sessionType === 'short_break' ? 'Short Break' : 'Long Break'}
              </span>
            </div>
          </div>
        </div>

        {/* Task Name */}
        {taskName && (
          <div className="text-center mb-4">
            <span className="text-sm text-muted-foreground">Working on:</span>
            <p className="font-medium text-foreground truncate">{taskName}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!timerState.isRunning ? (
            <Button onClick={handleStart} size="lg" className="gap-2">
              <Play className="w-5 h-5" />
              Start Focus
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={cancelSession}
                className="h-12 w-12"
              >
                <Square className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                onClick={handleToggle}
                className="gap-2 px-8"
              >
                {timerState.isPaused ? (
                  <>
                    <Play className="w-5 h-5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={logDistraction}
                className="h-12 w-12"
                title="Log distraction"
              >
                <Zap className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Distractions Counter */}
        {timerState.isRunning && timerState.distractionsCount > 0 && (
          <div className="text-center mt-4">
            <span className="text-sm text-muted-foreground">
              Distractions: {timerState.distractionsCount}
            </span>
          </div>
        )}

        {/* Today's Stats */}
        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.completedToday}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.totalFocusMinutes}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalXPToday}</div>
            <div className="text-xs text-muted-foreground">XP</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
