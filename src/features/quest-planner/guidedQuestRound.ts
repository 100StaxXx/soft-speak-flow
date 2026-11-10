import type { PlanningReply } from '../../../supabase/functions/cosmiq-quest-planner/planning';

const questions = [
  'What goal would you like this next quest to support?',
  'Which activity would you like to do for that goal?',
  'How much time would you like to spend on this quest?',
  'When would you like to begin?',
];
export function guidedQuestInstruction(step: number): string {
  return step < 4
    ? `This is a new guided quest, separate from saved quests. Ask only this question now: ${questions[step]} Return no quests, phase ${step === 0 ? 'goals' : 'details'}, and relevant answer choices. Use earlier answers from THIS round only. Do not assume the previous saved quest's activity, duration or time. For activity choices suggest concrete activities tied to the chosen goal. For clock times include validated time_choices with the duration just chosen.`
    : 'Review only this new quest using the goal, activity, duration and start time explicitly chosen in this guided round. If an answer is missing, ambiguous or conflicts with a booking, ask for clarification rather than guessing. Keep all saved quests in Agenda unchanged.';
}
/** A model shortcut cannot skip the questions or expose a saveable proposal early. */
export function guidedQuestReply(plan: PlanningReply, step: number): PlanningReply {
  if (step >= 4) return plan;
  const choices = step === 0
    ? (plan.phase === 'goals' && plan.choices.length ? plan.choices : ['Build my mind', 'Care for my body', 'Nourish my soul'])
    : step === 1
      ? (plan.phase === 'review' ? plan.quests.map(quest => quest.title).slice(0,3) : plan.choices)
      : step === 2 ? ['15 minutes', '30 minutes', '45 minutes']
      : (plan.time_choices ?? []).map(choice => choice.choice);
  return { ...plan, phase: step === 0 ? 'goals' : 'details', reply: questions[step],
    input_hint: ['Tell me the goal you want to work toward…', 'Choose an activity or name your own…', 'For example, 20 minutes…', 'For example, 7 PM…'][step],
    choices, quests: [], memory_suggestion: null, time_choices: step === 3 ? plan.time_choices : [] };
}
