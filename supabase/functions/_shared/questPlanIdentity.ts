import { activityKey } from './plannerLearning.ts';
/** Shared by response validation and the final client save check. No AI calls. */
export interface ExistingPlannerQuest {
  id: string;
  title: string;
  scheduled: boolean;
  completed?: boolean;
  editable?: boolean;
}
export function questTitleKey(title: string): string {
  return title.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(word => word && !['the', 'a', 'an', 'my', 'your'].includes(word))
    .sort().join(' ');
}
export function findExistingPlannerQuest(quest: { task_id: string | null; title: string }, existing: ExistingPlannerQuest[]): ExistingPlannerQuest | undefined {
  const key = questTitleKey(quest.title);
  const matches = existing.filter(item => (quest.task_id && item.id === quest.task_id) || (key && (questTitleKey(item.title) === key || (activityKey(item.title) === 'dog-walking' && activityKey(quest.title) === 'dog-walking'))));
  // A scheduled occurrence wins over an unscheduled template with the same title.
  return matches.find(item => item.scheduled || item.completed) ?? matches[0];
}
