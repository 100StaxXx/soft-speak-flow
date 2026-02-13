import { useMemo } from 'react';
import { useMilestones, PhaseStats } from './useMilestones';
import { differenceInDays, subDays } from 'date-fns';

export interface RescheduleInsight {
  type: 'warning' | 'suggestion' | 'celebration';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: {
    label: string;
    adjustmentText: string;
  };
}

export interface HabitPattern {
  habitId: string;
  habitTitle: string;
  completionRate: number;
  weekdayRates: Record<string, number>; // 0-6 for Sun-Sat
  trend: 'improving' | 'declining' | 'stable';
  suggestion?: string;
}

export interface RescheduleIntelligence {
  shouldShowAdvisor: boolean;
  advisorTrigger: string | null;
  insights: RescheduleInsight[];
  habitPatterns: HabitPattern[];
  velocityPerDay: number;
  estimatedCompletionDate: Date | null;
  daysAheadOrBehind: number;
  smartQuickActions: Array<{
    label: string;
    description: string;
    adjustmentText: string;
    icon: 'rocket' | 'clock' | 'target' | 'sparkles' | 'shield';
    priority: 'primary' | 'secondary';
  }>;
}

interface HabitCompletion {
  habit_id: string;
  completed_at: string;
  habit?: {
    title: string;
  };
}

export function useRescheduleIntelligence(
  epicId: string,
  habitCompletions?: HabitCompletion[],
  lastCheckInDate?: Date,
  epicStartDate?: string,
  epicEndDate?: string
): RescheduleIntelligence {
  const { 
    milestones, 
    completedCount, 
    totalCount,
    getPhaseStats,
    getCurrentPhase,
    getJourneyHealth,
  } = useMilestones(epicId);

  return useMemo(() => {
    const now = new Date();
    const currentPhaseName = getCurrentPhase();
    const phaseStats = getPhaseStats();
    const journeyHealth = getJourneyHealth(epicStartDate, epicEndDate);
    
    const insights: RescheduleInsight[] = [];
    const smartQuickActions: RescheduleIntelligence['smartQuickActions'] = [];
    
    // Calculate velocity and projections
    const completedMilestones = milestones.filter(m => m.completed_at);
    const totalMilestones = totalCount;
    
    // Get epic dates from milestones or props
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.target_date || 0).getTime() - new Date(b.target_date || 0).getTime()
    );
    const epicStart = epicStartDate ? new Date(epicStartDate) :
      (sortedMilestones[0]?.target_date ? new Date(sortedMilestones[0].target_date) : now);
    const epicEnd = epicEndDate ? new Date(epicEndDate) :
      (sortedMilestones[sortedMilestones.length - 1]?.target_date
        ? new Date(sortedMilestones[sortedMilestones.length - 1].target_date)
        : now);
    
    const daysElapsed = Math.max(1, differenceInDays(now, epicStart));
    const totalDays = Math.max(1, differenceInDays(epicEnd, epicStart));
    const daysRemaining = Math.max(0, differenceInDays(epicEnd, now));
    
    // Velocity calculation
    const velocityPerDay = completedCount / daysElapsed;
    const remainingMilestones = totalMilestones - completedCount;
    const daysNeededAtCurrentPace = velocityPerDay > 0 
      ? remainingMilestones / velocityPerDay 
      : Infinity;
    
    const estimatedCompletionDate = velocityPerDay > 0
      ? new Date(now.getTime() + daysNeededAtCurrentPace * 24 * 60 * 60 * 1000)
      : null;
    
    const daysAheadOrBehind = estimatedCompletionDate 
      ? differenceInDays(epicEnd, estimatedCompletionDate)
      : -999;
    
    // Analyze habit patterns
    const habitPatterns: HabitPattern[] = [];
    if (habitCompletions && habitCompletions.length > 0) {
      const habitMap = new Map<string, { completions: Date[]; title: string }>();
      
      habitCompletions.forEach(hc => {
        const existing = habitMap.get(hc.habit_id) || { completions: [], title: hc.habit?.title || 'Unknown' };
        existing.completions.push(new Date(hc.completed_at));
        habitMap.set(hc.habit_id, existing);
      });
      
      habitMap.forEach((data, habitId) => {
        const last30Days = 30;
        const recentCompletions = data.completions.filter(d => 
          differenceInDays(now, d) <= last30Days
        );
        
        // Calculate weekday rates
        const weekdayRates: Record<string, number> = {};
        const weekdayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const weekdayTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        
        // Count completions per weekday
        recentCompletions.forEach(d => {
          weekdayCounts[d.getDay()]++;
        });
        
        // Count how many of each weekday in last 30 days
        for (let i = 0; i < 30; i++) {
          const day = subDays(now, i);
          weekdayTotals[day.getDay()]++;
        }
        
        // Calculate rates
        for (let i = 0; i < 7; i++) {
          weekdayRates[i.toString()] = weekdayTotals[i] > 0 
            ? weekdayCounts[i] / weekdayTotals[i] 
            : 0;
        }
        
        // Determine trend (compare first half vs second half of completions)
        const midpoint = Math.floor(recentCompletions.length / 2);
        const firstHalf = recentCompletions.slice(0, midpoint).length;
        const secondHalf = recentCompletions.slice(midpoint).length;
        
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (secondHalf > firstHalf * 1.2) trend = 'improving';
        else if (secondHalf < firstHalf * 0.8) trend = 'declining';
        
        const completionRate = recentCompletions.length / last30Days;
        
        // Find weakest days
        const sortedDays = Object.entries(weekdayRates)
          .sort((a, b) => a[1] - b[1]);
        const weakestDays = sortedDays.slice(0, 2)
          .filter(([, rate]) => rate < 0.3)
          .map(([day]) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(day)]);
        
        let suggestion: string | undefined;
        if (weakestDays.length > 0) {
          suggestion = `You often skip this on ${weakestDays.join(' and ')}. Consider a lighter version for those days.`;
        } else if (trend === 'declining') {
          suggestion = `Your completion rate is declining. Maybe simplify or reschedule?`;
        }
        
        habitPatterns.push({
          habitId,
          habitTitle: data.title,
          completionRate,
          weekdayRates,
          trend,
          suggestion,
        });
      });
    }
    
    // Generate insights based on analysis
    let advisorTrigger: string | null = null;
    let shouldShowAdvisor = false;
    
    // Check for various trigger conditions
    const daysSinceLastCheckIn = lastCheckInDate 
      ? differenceInDays(now, lastCheckInDate) 
      : 0;
    
    // Trigger: Behind schedule
    if (daysAheadOrBehind < -7) {
      shouldShowAdvisor = true;
      advisorTrigger = 'behind_schedule';
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'You\'re falling behind',
        description: `At your current pace, you'll finish ${Math.abs(daysAheadOrBehind)} days late. Let's adjust your plan.`,
        action: {
          label: 'Get back on track',
          adjustmentText: 'I\'m behind schedule. Please help me get back on track by redistributing milestones or simplifying the plan.',
        }
      });
      
      smartQuickActions.push({
        label: 'Get Back on Track',
        description: 'We will redistribute milestones to match your pace',
        adjustmentText: 'I\'m behind schedule. Redistribute milestones realistically based on my current pace, prioritizing the most important ones.',
        icon: 'target',
        priority: 'primary',
      });
    }
    
    // Trigger: Ahead of schedule
    if (daysAheadOrBehind > 7) {
      insights.push({
        type: 'celebration',
        priority: 'low',
        title: 'You\'re ahead of schedule!',
        description: `You're on track to finish ${daysAheadOrBehind} days early. Consider accelerating or adding depth.`,
        action: {
          label: 'Accelerate journey',
          adjustmentText: 'I\'m ahead of schedule! Please compress my timeline or add more challenging milestones.',
        }
      });
      
      smartQuickActions.push({
        label: 'Accelerate Journey',
        description: 'Compress timeline since you\'re ahead',
        adjustmentText: 'I\'m ahead of schedule. Compress my timeline or add more challenging milestones to maximize growth.',
        icon: 'rocket',
        priority: 'secondary',
      });
    }
    
    // Trigger: Health score is poor
    if (journeyHealth && (journeyHealth.score === 'D' || journeyHealth.score === 'F')) {
      shouldShowAdvisor = true;
      advisorTrigger = advisorTrigger || 'poor_health';
      const healthMessage = journeyHealth.progressDelta < -20 
        ? 'You\'re significantly behind expected progress'
        : 'Your journey needs attention to stay on track';
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Journey needs attention',
        description: healthMessage,
        action: {
          label: 'Review & adjust',
          adjustmentText: `My journey health is poor. ${healthMessage}. Please suggest adjustments to get back on track.`,
        }
      });
    }
    
    // Trigger: No activity for a while
    if (daysSinceLastCheckIn > 5) {
      shouldShowAdvisor = true;
      advisorTrigger = advisorTrigger || 'inactive';
      insights.push({
        type: 'suggestion',
        priority: 'medium',
        title: 'Welcome back!',
        description: `It's been ${daysSinceLastCheckIn} days since your last activity. Let's reassess your timeline.`,
        action: {
          label: 'Adjust for break',
          adjustmentText: `I took a ${daysSinceLastCheckIn}-day break. Please adjust my milestones to account for this time away.`,
        }
      });
      
      smartQuickActions.push({
        label: 'Adjust for Break',
        description: `Account for your ${daysSinceLastCheckIn}-day break`,
        adjustmentText: `I took a ${daysSinceLastCheckIn}-day break. Shift my remaining milestones forward while keeping the overall pace realistic.`,
        icon: 'clock',
        priority: 'primary',
      });
    }
    
    // Trigger: Struggling habits
    const strugglingHabits = habitPatterns.filter(h => h.completionRate < 0.3);
    if (strugglingHabits.length > 0) {
      insights.push({
        type: 'suggestion',
        priority: 'medium',
        title: 'Some habits need attention',
        description: `${strugglingHabits.map(h => h.habitTitle).join(', ')} have low completion rates.`,
        action: {
          label: 'Simplify routine',
          adjustmentText: `I'm struggling with these habits: ${strugglingHabits.map(h => h.habitTitle).join(', ')}. Please suggest easier alternatives or reduced frequency.`,
        }
      });
      
      smartQuickActions.push({
        label: 'Simplify Routine',
        description: 'Make struggling habits more achievable',
        adjustmentText: `These habits are hard to maintain: ${strugglingHabits.map(h => h.habitTitle).join(', ')}. Suggest simpler versions or reduced frequency.`,
        icon: 'shield',
        priority: 'secondary',
      });
    }
    
    // Trigger: Phase at risk
    const currentPhaseStats = phaseStats.find((p: PhaseStats) => p.phaseName === currentPhaseName);
    if (currentPhaseStats && !currentPhaseStats.isOnTrack && currentPhaseStats.daysUntilEnd !== null && currentPhaseStats.daysUntilEnd < 7) {
      const remainingInPhase = currentPhaseStats.total - currentPhaseStats.completed;
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Phase deadline approaching',
        description: `Only ${currentPhaseStats.daysUntilEnd} days left in "${currentPhaseStats.phaseName}" with ${remainingInPhase} milestones to go.`,
        action: {
          label: 'Redistribute phase',
          adjustmentText: `I'm running out of time in the "${currentPhaseStats.phaseName}" phase. Please redistribute remaining milestones.`,
        }
      });
    }
    
    // Add default smart actions if none were added
    if (smartQuickActions.length === 0) {
      smartQuickActions.push(
        {
          label: 'Optimize Timeline',
          description: 'Get guidance to improve your schedule',
          adjustmentText: 'Analyze my current progress and optimize the remaining timeline for best results.',
          icon: 'sparkles',
          priority: 'primary',
        },
        {
          label: 'Add Buffer Time',
          description: 'Extend deadline by 2 weeks',
          adjustmentText: 'Add 2 weeks of buffer time to my journey and redistribute milestones accordingly.',
          icon: 'clock',
          priority: 'secondary',
        }
      );
    }
    
    // Always add the general "simplify" option
    if (!smartQuickActions.find(a => a.label === 'Simplify Routine')) {
      smartQuickActions.push({
        label: 'Focus on Essentials',
        description: 'Keep only the most impactful milestones',
        adjustmentText: 'Simplify my journey to focus on the most essential milestones. Remove or combine less critical ones.',
        icon: 'target',
        priority: 'secondary',
      });
    }
    
    return {
      shouldShowAdvisor,
      advisorTrigger,
      insights,
      habitPatterns,
      velocityPerDay,
      estimatedCompletionDate,
      daysAheadOrBehind,
      smartQuickActions: smartQuickActions.slice(0, 4), // Max 4 actions
    };
  }, [
    milestones,
    completedCount,
    totalCount,
    habitCompletions, 
    lastCheckInDate,
    epicStartDate,
    epicEndDate,
    getPhaseStats,
    getCurrentPhase,
    getJourneyHealth,
  ]);
}
