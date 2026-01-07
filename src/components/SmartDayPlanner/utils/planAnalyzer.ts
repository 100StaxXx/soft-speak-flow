import { GeneratedTask } from '@/hooks/useSmartDayPlanner';

export interface TimeConflict {
  taskAId: string;
  taskBId: string;
  taskATitle: string;
  taskBTitle: string;
  overlapMinutes: number;
  suggestedFix: string;
}

export interface PlanAnalysis {
  hasWorkout: boolean;
  hasLunchBreak: boolean;
  hasDeepFocus: boolean;
  hasRelationshipTask: boolean;
  isOverloaded: boolean;
  needsMoreBreaks: boolean;
  totalTasks: number;
  averageGapMinutes: number;
  highPriorityCount: number;
  conflicts: TimeConflict[];
  hasConflicts: boolean;
}

export interface SmartAdjustment {
  label: string;
  prompt: string;
  priority?: 'high' | 'medium' | 'low';
  icon?: string;
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function calculateAverageGap(tasks: GeneratedTask[]): number {
  if (tasks.length < 2) return 60;
  
  const sortedTasks = [...tasks].sort((a, b) => 
    parseTimeToMinutes(a.scheduledTime) - parseTimeToMinutes(b.scheduledTime)
  );
  
  let totalGap = 0;
  let gapCount = 0;
  
  for (let i = 0; i < sortedTasks.length - 1; i++) {
    const endOfCurrent = parseTimeToMinutes(sortedTasks[i].scheduledTime) + sortedTasks[i].estimatedDuration;
    const startOfNext = parseTimeToMinutes(sortedTasks[i + 1].scheduledTime);
    const gap = startOfNext - endOfCurrent;
    if (gap > 0) {
      totalGap += gap;
      gapCount++;
    }
  }
  
  return gapCount > 0 ? totalGap / gapCount : 60;
}

export function detectTimeConflicts(tasks: GeneratedTask[]): TimeConflict[] {
  if (tasks.length < 2) return [];
  
  const sortedTasks = [...tasks].sort((a, b) => 
    parseTimeToMinutes(a.scheduledTime) - parseTimeToMinutes(b.scheduledTime)
  );
  
  const conflicts: TimeConflict[] = [];
  
  for (let i = 0; i < sortedTasks.length - 1; i++) {
    const taskA = sortedTasks[i];
    const taskB = sortedTasks[i + 1];
    
    const endOfA = parseTimeToMinutes(taskA.scheduledTime) + taskA.estimatedDuration;
    const startOfB = parseTimeToMinutes(taskB.scheduledTime);
    
    if (endOfA > startOfB) {
      const overlapMinutes = endOfA - startOfB;
      conflicts.push({
        taskAId: taskA.id,
        taskBId: taskB.id,
        taskATitle: taskA.title,
        taskBTitle: taskB.title,
        overlapMinutes,
        suggestedFix: overlapMinutes < 30 
          ? `Push "${taskB.title}" back by ${overlapMinutes} minutes`
          : `Shorten "${taskA.title}" or reschedule "${taskB.title}"`,
      });
    }
  }
  
  return conflicts;
}

export function getConflictingTaskIds(conflicts: TimeConflict[]): Set<string> {
  const ids = new Set<string>();
  conflicts.forEach(c => {
    ids.add(c.taskAId);
    ids.add(c.taskBId);
  });
  return ids;
}

export function analyzePlan(tasks: GeneratedTask[]): PlanAnalysis {
  const hasWorkout = tasks.some(t => 
    t.blockType === 'health' || 
    t.category?.toLowerCase().includes('workout') ||
    t.category?.toLowerCase().includes('exercise') ||
    t.title.toLowerCase().match(/workout|exercise|gym|run|yoga|stretch|fitness/)
  );
  
  const hasLunchBreak = tasks.some(t => {
    const hour = parseInt(t.scheduledTime.split(':')[0]);
    return hour >= 11 && hour <= 14 && 
      (t.title.toLowerCase().includes('lunch') || 
       t.title.toLowerCase().includes('eat') ||
       t.blockType === 'break');
  });
  
  const hasDeepFocus = tasks.some(t => 
    t.estimatedDuration >= 90 && 
    (t.blockType === 'focus' || t.priority === 'high')
  );
  
  const hasRelationshipTask = tasks.some(t => 
    t.blockType === 'relationship' ||
    t.category?.toLowerCase().includes('relationship') ||
    t.title.toLowerCase().match(/call|meet|chat|catch up|coffee with|dinner with/)
  );
  
  const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
  const averageGapMinutes = calculateAverageGap(tasks);
  const conflicts = detectTimeConflicts(tasks);
  
  return {
    hasWorkout,
    hasLunchBreak,
    hasDeepFocus,
    hasRelationshipTask,
    isOverloaded: highPriorityCount > 4 || tasks.length > 10,
    needsMoreBreaks: averageGapMinutes < 15,
    totalTasks: tasks.length,
    averageGapMinutes,
    highPriorityCount,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}

export function getSmartAdjustments(
  analysis: PlanAnalysis, 
  hasContacts: boolean = false
): SmartAdjustment[] {
  const suggestions: SmartAdjustment[] = [];
  
  // High priority suggestions first - conflicts are most critical
  if (analysis.hasConflicts) {
    suggestions.push({
      label: 'Fix conflicts',
      prompt: 'Fix all time conflicts - adjust task times so nothing overlaps. Maintain task order but add gaps between overlapping tasks.',
      priority: 'high',
      icon: '⚠️'
    });
  }
  
  if (analysis.isOverloaded) {
    suggestions.push({
      label: 'Lighten load',
      prompt: 'Reduce the number of tasks - move lower priority items to tomorrow or remove them. Focus on what truly matters today.',
      priority: 'high',
      icon: '🎯'
    });
  }
  
  if (!analysis.hasLunchBreak && analysis.totalTasks > 3) {
    suggestions.push({
      label: 'Add lunch break',
      prompt: 'Add a 45-minute lunch break around noon or 1pm',
      priority: 'high',
      icon: '🍽️'
    });
  }
  
  if (analysis.needsMoreBreaks) {
    suggestions.push({
      label: 'More breaks',
      prompt: 'Add more buffer time between tasks - at least 15-20 minutes between each',
      priority: 'medium',
      icon: '☕'
    });
  }
  
  // Medium priority suggestions
  if (!analysis.hasWorkout) {
    suggestions.push({
      label: 'Add workout',
      prompt: 'Add a 30-minute workout or exercise block',
      icon: '💪'
    });
  }
  
  if (!analysis.hasDeepFocus && analysis.highPriorityCount > 0) {
    suggestions.push({
      label: 'Add focus time',
      prompt: 'Add a 90-minute deep focus block for important work without interruptions',
      icon: '🎯'
    });
  }
  
  if (!analysis.hasRelationshipTask && hasContacts) {
    suggestions.push({
      label: 'Add catch-up',
      prompt: 'Add a quick 15-minute catch-up call with a friend or family member',
      icon: '👋'
    });
  }
  
  // Always available adjustments as fallbacks
  if (suggestions.length < 3) {
    suggestions.push({
      label: 'Shuffle times',
      prompt: 'Rearrange the schedule to optimize energy levels - put high-priority tasks during peak hours',
      icon: '🔄'
    });
  }
  
  if (suggestions.length < 4) {
    suggestions.push({
      label: 'Push 1 hour',
      prompt: 'Push all tasks back by 1 hour to give more morning flexibility',
      icon: '⏰'
    });
  }
  
  return suggestions.slice(0, 4);
}
