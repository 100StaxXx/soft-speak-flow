import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Zap, Brain, Coffee, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFocusSession } from '../hooks/useFocusSession';

interface FocusTimerProps {
  taskId?: string;
  taskName?: string;
  compact?: boolean;
  onComplete?: () => void;
}

export function FocusTimer({ taskId, taskName, compact = false, onComplete: _onComplete }: FocusTimerProps) {
  const {
    timerState,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    logDistraction,
    skipCooldown,
    stats,
  } = useFocusSession();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress for focus or cooldown
  const progress = timerState.isCooldown
    ? ((300 - timerState.cooldownTimeRemaining) / 300) * 100 // 5 min cooldown
    : timerState.totalTime > 0 
      ? ((timerState.totalTime - timerState.timeRemaining) / timerState.totalTime) * 100 
      : 0;

  const displayTime = timerState.isCooldown 
    ? timerState.cooldownTimeRemaining 
    : timerState.timeRemaining;

  const handleStart = () => {
    startSession(taskId, 'pomodoro');
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
          {formatTime(displayTime)}
        </div>
        {!timerState.isRunning && !timerState.isCooldown ? (
          <Button size="sm" variant="ghost" onClick={handleStart}>
            <Play className="w-4 h-4" />
          </Button>
        ) : timerState.isCooldown ? (
          <Button size="sm" variant="ghost" onClick={skipCooldown}>
            <SkipForward className="w-4 h-4" />
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
        {/* Pomodoro Explanation - Show when not running and not in cooldown */}
        {!timerState.isRunning && !timerState.isCooldown && (
          <div className="flex items-start gap-3 mb-6 p-3 rounded-lg bg-muted/50">
            <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Pomodoro Technique:</span>{' '}
              Focus for 25 minutes, then take a 5-minute break. This helps maintain concentration and avoid burnout.
            </p>
          </div>
        )}

        {/* Cooldown Message */}
        {timerState.isCooldown && (
          <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-lg bg-green-500/10">
            <Coffee className="w-5 h-5 text-green-500" />
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Take a break! Stretch, hydrate, rest your eyes.
            </p>
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
                  timerState.isCooldown ? 'text-green-500' : 'text-primary'
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
                  key={displayTime}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-4xl font-mono font-bold text-foreground"
                >
                  {formatTime(displayTime)}
                </motion.div>
              </AnimatePresence>
              <span className={cn(
                "text-sm mt-1",
                timerState.isCooldown ? "text-green-500 font-medium" : "text-muted-foreground"
              )}>
                {timerState.isCooldown ? 'Cooldown' : 'Focus Time'}
              </span>
            </div>
          </div>
        </div>

        {/* Task Name */}
        {taskName && !timerState.isCooldown && (
          <div className="text-center mb-4">
            <span className="text-sm text-muted-foreground">Working on:</span>
            <p className="font-medium text-foreground truncate">{taskName}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {timerState.isCooldown ? (
            <Button onClick={skipCooldown} variant="outline" size="lg" className="gap-2">
              <SkipForward className="w-5 h-5" />
              Skip Break
            </Button>
          ) : !timerState.isRunning ? (
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

        {/* Daily XP Cap Indicator */}
        {stats.sessionsUntilCap > 0 ? (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-primary">{stats.sessionsUntilCap}</span> full XP session{stats.sessionsUntilCap !== 1 ? 's' : ''} remaining today
          </div>
        ) : (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Daily cap reached — sessions now award <span className="font-medium">3 XP</span>
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
