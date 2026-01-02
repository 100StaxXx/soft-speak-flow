import { useMemo } from 'react';

export interface RitualInsight {
  id: string;
  type: 'warning' | 'celebration' | 'suggestion';
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
  trend: 'improving' | 'declining' | 'stable';
  strugglingDays?: string[];
}

export interface RitualQuickAction {
  id: string;
  label: string;
  description: string;
  adjustmentText: string;
  icon: string;
  priority: 'primary' | 'secondary';
}

export interface RitualIntelligence {
  shouldShowAdvisor: boolean;
  insights: RitualInsight[];
  habitPatterns: HabitPattern[];
  overallCompletionRate: number;
  bestPerformingHabits: string[];
  strugglingHabits: string[];
  smartQuickActions: RitualQuickAction[];
  totalHabits: number;
}

interface UseRitualIntelligenceParams {
  habits: Array<{
    id: string;
    title: string;
    difficulty?: string;
    frequency?: string;
    estimated_minutes?: number | null;
  }>;
  completionData?: Array<{
    habit_id: string;
    completed_at: string;
  }>;
  daysToAnalyze?: number;
}

export function useRitualIntelligence({
  habits,
  completionData = [],
  daysToAnalyze = 14,
}: UseRitualIntelligenceParams): RitualIntelligence {
  return useMemo(() => {
    if (!habits || habits.length === 0) {
      return {
        shouldShowAdvisor: false,
        insights: [],
        habitPatterns: [],
        overallCompletionRate: 0,
        bestPerformingHabits: [],
        strugglingHabits: [],
        smartQuickActions: [],
        totalHabits: 0,
      };
    }

    // Calculate completion rates per habit
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000);
    
    const recentCompletions = completionData.filter(
      c => new Date(c.completed_at) >= cutoffDate
    );

    const habitPatterns: HabitPattern[] = habits.map(habit => {
      const habitCompletions = recentCompletions.filter(c => c.habit_id === habit.id);
      const completionRate = Math.min(100, (habitCompletions.length / daysToAnalyze) * 100);
      
      // Determine trend (simple: compare first half vs second half)
      const midpoint = new Date(now.getTime() - (daysToAnalyze / 2) * 24 * 60 * 60 * 1000);
      const firstHalf = habitCompletions.filter(c => new Date(c.completed_at) < midpoint).length;
      const secondHalf = habitCompletions.filter(c => new Date(c.completed_at) >= midpoint).length;
      
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (secondHalf > firstHalf + 1) trend = 'improving';
      if (secondHalf < firstHalf - 1) trend = 'declining';

      return {
        habitId: habit.id,
        habitTitle: habit.title,
        completionRate,
        trend,
      };
    });

    const overallCompletionRate = habitPatterns.length > 0
      ? habitPatterns.reduce((sum, p) => sum + p.completionRate, 0) / habitPatterns.length
      : 0;

    const bestPerformingHabits = habitPatterns
      .filter(p => p.completionRate >= 70)
      .map(p => p.habitTitle);

    const strugglingHabits = habitPatterns
      .filter(p => p.completionRate < 40)
      .map(p => p.habitTitle);

    const decliningHabits = habitPatterns.filter(p => p.trend === 'declining');

    // Generate insights
    const insights: RitualInsight[] = [];

    if (overallCompletionRate >= 80) {
      insights.push({
        id: 'high-performer',
        type: 'celebration',
        title: 'Amazing consistency!',
        description: `You're completing ${Math.round(overallCompletionRate)}% of your rituals. Keep up the stellar work!`,
      });
    }

    if (strugglingHabits.length > 0 && strugglingHabits.length <= 2) {
      insights.push({
        id: 'struggling-habits',
        type: 'warning',
        title: `${strugglingHabits.length} ritual${strugglingHabits.length > 1 ? 's' : ''} needs attention`,
        description: `"${strugglingHabits[0]}" has low completion. Consider simplifying or removing it.`,
        action: {
          label: 'Simplify',
          adjustmentText: `I'm struggling with "${strugglingHabits[0]}". Please suggest an easier alternative or remove it.`,
        },
      });
    }

    if (decliningHabits.length >= 2) {
      insights.push({
        id: 'declining-trend',
        type: 'warning',
        title: 'Declining completion trend',
        description: 'Multiple rituals are showing decreased completion. Time to adjust your plan.',
        action: {
          label: 'Adjust',
          adjustmentText: 'My ritual completion is declining. Please simplify my routine.',
        },
      });
    }

    if (habits.length >= 5 && overallCompletionRate < 50) {
      insights.push({
        id: 'too-many-habits',
        type: 'suggestion',
        title: 'Consider fewer rituals',
        description: 'With many rituals, it can be hard to stay consistent. Try focusing on 2-3 key ones.',
        action: {
          label: 'Simplify',
          adjustmentText: 'I have too many habits and struggle to complete them. Please help me reduce to 2-3 key rituals.',
        },
      });
    }

    // Generate smart quick actions
    const smartQuickActions: RitualQuickAction[] = [];

    if (strugglingHabits.length > 0) {
      smartQuickActions.push({
        id: 'simplify-routine',
        label: 'Simplify Routine',
        description: 'Make struggling habits easier',
        adjustmentText: `I'm having trouble with some habits. Please make them easier or suggest simpler alternatives.`,
        icon: 'Minus',
        priority: 'primary',
      });
    }

    if (overallCompletionRate >= 70 && habits.length < 5) {
      smartQuickActions.push({
        id: 'add-habit',
        label: 'Level Up',
        description: 'Add a new challenge',
        adjustmentText: "I'm doing well with my current habits. Please suggest one new habit to add.",
        icon: 'Plus',
        priority: 'secondary',
      });
    }

    if (habits.some(h => h.difficulty === 'hard') && overallCompletionRate < 60) {
      smartQuickActions.push({
        id: 'reduce-difficulty',
        label: 'Ease Up',
        description: 'Lower difficulty levels',
        adjustmentText: 'My habits are too difficult. Please suggest easier versions of my current rituals.',
        icon: 'TrendingDown',
        priority: 'primary',
      });
    }

    if (decliningHabits.length > 0) {
      smartQuickActions.push({
        id: 'swap-habits',
        label: 'Fresh Start',
        description: 'Replace declining habits',
        adjustmentText: 'Some of my habits are declining in completion. Please suggest replacements that better fit my lifestyle.',
        icon: 'RefreshCw',
        priority: 'primary',
      });
    }

    // Always provide at least one action
    if (smartQuickActions.length === 0) {
      smartQuickActions.push({
        id: 'optimize',
        label: 'Optimize',
        description: 'Fine-tune your routine',
        adjustmentText: 'Please review my habits and suggest any optimizations to improve my consistency.',
        icon: 'Sparkles',
        priority: 'secondary',
      });
    }

    const shouldShowAdvisor = insights.length > 0 || 
      strugglingHabits.length > 0 || 
      overallCompletionRate < 50 ||
      decliningHabits.length > 0;

    return {
      shouldShowAdvisor,
      insights,
      habitPatterns,
      overallCompletionRate,
      bestPerformingHabits,
      strugglingHabits,
      smartQuickActions,
      totalHabits: habits.length,
    };
  }, [habits, completionData, daysToAnalyze]);
}
