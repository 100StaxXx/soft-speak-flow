import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useXPRewards } from '@/hooks/useXPRewards';
import { FOCUS_XP_REWARDS } from '@/config/xpRewards';
 import { useLivingCompanionSafe } from '@/hooks/useLivingCompanion';

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  duration_type: 'pomodoro' | 'short_break' | 'long_break' | 'custom';
  planned_duration: number; // minutes
  actual_duration: number | null;
  started_at: string;
  completed_at: string | null;
  paused_at: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  distractions_count: number;
  xp_earned: number | null;
  notes: string | null;
}

export interface FocusTimerState {
  isRunning: boolean;
  isPaused: boolean;
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  sessionType: 'pomodoro' | 'short_break' | 'long_break' | 'custom';
  currentSessionId: string | null;
  distractionsCount: number;
  isCooldown: boolean;
  cooldownTimeRemaining: number; // seconds
}

const DURATION_PRESETS = {
  pomodoro: 25,
  short_break: 5,
  long_break: 15,
  custom: 30,
};

const COOLDOWN_DURATION = 5 * 60; // 5 minutes in seconds

export function useFocusSession() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardFocusSessionComplete } = useXPRewards();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
 
   // Living companion reaction system - safe hook returns no-op when outside provider
   const { triggerPomodoroComplete } = useLivingCompanionSafe();

  const [timerState, setTimerState] = useState<FocusTimerState>({
    isRunning: false,
    isPaused: false,
    timeRemaining: DURATION_PRESETS.pomodoro * 60,
    totalTime: DURATION_PRESETS.pomodoro * 60,
    sessionType: 'pomodoro',
    currentSessionId: null,
    distractionsCount: 0,
    isCooldown: false,
    cooldownTimeRemaining: 0,
  });

  // Fetch today's sessions
  const { data: todaySessions = [], isLoading } = useQuery({
    queryKey: ['focus-sessions', user?.id, 'today'],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', `${today}T00:00:00`)
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data as FocusSession[];
    },
    enabled: !!user?.id,
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async ({ 
      taskId, 
      durationType, 
      customDuration 
    }: { 
      taskId?: string; 
      durationType: FocusTimerState['sessionType'];
      customDuration?: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const duration = customDuration || DURATION_PRESETS[durationType];
      
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: user.id,
          task_id: taskId || null,
          duration_type: durationType,
          planned_duration: duration,
          started_at: new Date().toISOString(),
          status: 'active',
          distractions_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
      setTimerState(prev => ({
        ...prev,
        isRunning: true,
        isPaused: false,
        timeRemaining: session.planned_duration * 60,
        totalTime: session.planned_duration * 60,
        sessionType: session.duration_type as FocusTimerState['sessionType'],
        currentSessionId: session.id,
        distractionsCount: 0,
        isCooldown: false,
        cooldownTimeRemaining: 0,
      }));
    },
    onError: (error) => {
      console.error('Failed to start session:', error);
      toast({
        title: "Failed to start focus session",
        variant: "destructive",
      });
    },
  });

  // Calculate completed sessions today for XP cap
  const completedSessionsToday = todaySessions.filter(s => s.status === 'completed').length;
  const isUnderDailyCap = completedSessionsToday < FOCUS_XP_REWARDS.DAILY_SESSION_CAP;
  const sessionsUntilCap = Math.max(0, FOCUS_XP_REWARDS.DAILY_SESSION_CAP - completedSessionsToday);

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      actualDuration,
      distractionsCount,
      isPerfect,
      underCap,
    }: { 
      sessionId: string; 
      actualDuration: number;
      distractionsCount: number;
      isPerfect: boolean;
      underCap: boolean;
    }) => {
      // Calculate XP for database record (centralized XP is awarded separately)
      let xpEarned: number;
      if (underCap) {
        xpEarned = FOCUS_XP_REWARDS.SESSION_COMPLETE;
        if (isPerfect) {
          xpEarned += FOCUS_XP_REWARDS.PERFECT_FOCUS_BONUS;
        }
      } else {
        xpEarned = FOCUS_XP_REWARDS.CAPPED_SESSION_XP;
      }

      const { data, error } = await supabase
        .from('focus_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration: actualDuration,
          distractions_count: distractionsCount,
          xp_earned: xpEarned,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { session: data as FocusSession, isPerfect, underCap };
    },
    onSuccess: ({ session, isPerfect, underCap }) => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
      
      // Award XP through centralized system
      awardFocusSessionComplete(isPerfect, underCap);
      
       // Trigger companion reaction for sessions >= 15 minutes
       if (session.planned_duration >= 15) {
         triggerPomodoroComplete(session.planned_duration).catch(err => 
           console.log('[LivingCompanion] Pomodoro trigger failed:', err)
         );
       }
       
      // Start cooldown
      startCooldown();
    },
  });

  // Pause session mutation
  const pauseSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    },
  });

  // Resume session mutation
  const resumeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .update({
          status: 'active',
          paused_at: null,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    },
  });

  // Cancel session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
      resetTimer();
    },
  });

  // Start cooldown after focus session completes
  const startCooldown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      isCooldown: true,
      cooldownTimeRemaining: COOLDOWN_DURATION,
      currentSessionId: null,
      distractionsCount: 0,
    }));
  }, []);

  // Skip cooldown
  const skipCooldown = useCallback(() => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }
    setTimerState(prev => ({
      ...prev,
      isCooldown: false,
      cooldownTimeRemaining: 0,
      timeRemaining: DURATION_PRESETS.pomodoro * 60,
      totalTime: DURATION_PRESETS.pomodoro * 60,
    }));
  }, []);

  // Log distraction
  const logDistraction = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      distractionsCount: prev.distractionsCount + 1,
    }));
  }, []);

  // Cooldown tick effect
  useEffect(() => {
    if (timerState.isCooldown && timerState.cooldownTimeRemaining > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.cooldownTimeRemaining <= 1) {
            // Cooldown complete
            return {
              ...prev,
              isCooldown: false,
              cooldownTimeRemaining: 0,
              timeRemaining: DURATION_PRESETS.pomodoro * 60,
              totalTime: DURATION_PRESETS.pomodoro * 60,
            };
          }
          return { ...prev, cooldownTimeRemaining: prev.cooldownTimeRemaining - 1 };
        });
      }, 1000);
    }

    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [timerState.isCooldown, timerState.cooldownTimeRemaining > 0]);

  // Timer tick effect
  useEffect(() => {
    if (timerState.isRunning && !timerState.isPaused) {
      intervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.timeRemaining <= 1) {
            // Timer complete
            if (prev.currentSessionId) {
              const actualMinutes = Math.round((prev.totalTime - prev.timeRemaining) / 60);
              const isPerfect = prev.distractionsCount === 0;
              completeSessionMutation.mutate({
                sessionId: prev.currentSessionId,
                actualDuration: actualMinutes,
                distractionsCount: prev.distractionsCount,
                isPerfect,
                underCap: isUnderDailyCap,
              });
            }
            return { ...prev, isRunning: false, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.isPaused, isUnderDailyCap]);

  const startSession = useCallback((
    taskId?: string,
    durationType: FocusTimerState['sessionType'] = 'pomodoro',
    customDuration?: number
  ) => {
    startSessionMutation.mutate({ taskId, durationType, customDuration });
  }, []);

  const pauseSession = useCallback(() => {
    if (timerState.currentSessionId) {
      pauseSessionMutation.mutate(timerState.currentSessionId);
      setTimerState(prev => ({ ...prev, isPaused: true }));
    }
  }, [timerState.currentSessionId]);

  const resumeSession = useCallback(() => {
    if (timerState.currentSessionId) {
      resumeSessionMutation.mutate(timerState.currentSessionId);
      setTimerState(prev => ({ ...prev, isPaused: false }));
    }
  }, [timerState.currentSessionId]);

  const cancelSession = useCallback(() => {
    if (timerState.currentSessionId) {
      cancelSessionMutation.mutate(timerState.currentSessionId);
    }
  }, [timerState.currentSessionId]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }
    setTimerState({
      isRunning: false,
      isPaused: false,
      timeRemaining: DURATION_PRESETS.pomodoro * 60,
      totalTime: DURATION_PRESETS.pomodoro * 60,
      sessionType: 'pomodoro',
      currentSessionId: null,
      distractionsCount: 0,
      isCooldown: false,
      cooldownTimeRemaining: 0,
    });
  }, []);

  const setSessionType = useCallback((type: FocusTimerState['sessionType'], customMinutes?: number) => {
    const duration = customMinutes || DURATION_PRESETS[type];
    setTimerState(prev => ({
      ...prev,
      sessionType: type,
      timeRemaining: duration * 60,
      totalTime: duration * 60,
    }));
  }, []);

  // Stats calculations
  const totalFocusMinutes = todaySessions
    .filter(s => s.status === 'completed' && s.duration_type === 'pomodoro')
    .reduce((acc, s) => acc + (s.actual_duration || 0), 0);
  const totalXPToday = todaySessions
    .filter(s => s.status === 'completed')
    .reduce((acc, s) => acc + (s.xp_earned || 0), 0);

  return {
    timerState,
    todaySessions,
    isLoading,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    resetTimer,
    setSessionType,
    logDistraction,
    skipCooldown,
    stats: {
      completedToday: completedSessionsToday,
      totalFocusMinutes,
      totalXPToday,
      sessionsUntilCap,
      dailyCap: FOCUS_XP_REWARDS.DAILY_SESSION_CAP,
    },
    DURATION_PRESETS,
  };
}
