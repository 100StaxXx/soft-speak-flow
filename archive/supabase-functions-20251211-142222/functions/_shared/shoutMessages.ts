export type ShoutType = 'hype' | 'challenge' | 'support' | 'taunt';

interface ShoutMessage {
  key: string;
  type: ShoutType;
  text: string;
  emoji: string;
}

const SHOUT_MESSAGES: ShoutMessage[] = [
  { key: 'hype_fire', type: 'hype', text: "You're on FIRE today!", emoji: '🔥' },
  { key: 'hype_energy', type: 'hype', text: "Let's GO! The guild needs your energy!", emoji: '⚡' },
  { key: 'hype_unstoppable', type: 'hype', text: "Unstoppable mode: ACTIVATED", emoji: '🚀' },
  { key: 'hype_companion', type: 'hype', text: "Your companion is proud of you!", emoji: '💜' },
  { key: 'hype_main_character', type: 'hype', text: "Main character energy right there", emoji: '✨' },
  { key: 'hype_beast', type: 'hype', text: "Absolute BEAST mode!", emoji: '🦁' },
  { key: 'hype_legend', type: 'hype', text: "This is legendary stuff!", emoji: '👑' },
  { key: 'challenge_race', type: 'challenge', text: "Race you to the top! First one there gets bragging rights", emoji: '🏁' },
  { key: 'challenge_catch', type: 'challenge', text: "Catch me if you can!", emoji: '💨' },
  { key: 'challenge_accepted', type: 'challenge', text: "Challenge accepted? Let's see what you've got", emoji: '⚔️' },
  { key: 'challenge_crown', type: 'challenge', text: "The crown is mine this week", emoji: '👑' },
  { key: 'challenge_move', type: 'challenge', text: "Your move. No pressure...", emoji: '♟️' },
  { key: 'challenge_spot', type: 'challenge', text: "Coming for that #1 spot!", emoji: '🎯' },
  { key: 'challenge_step_up', type: 'challenge', text: "Time to step it up!", emoji: '📈' },
  { key: 'support_proud', type: 'support', text: "I see you putting in the work. Proud of you!", emoji: '💜' },
  { key: 'support_every_step', type: 'support', text: "Every step counts. You've got this!", emoji: '👣' },
  { key: 'support_inspiring', type: 'support', text: "Your consistency is inspiring the whole guild", emoji: '🌟' },
  { key: 'support_together', type: 'support', text: "We're in this together", emoji: '🤝' },
  { key: 'support_bad_day', type: 'support', text: "Bad day? That's okay. Tomorrow we rise!", emoji: '🌅' },
  { key: 'support_keep_going', type: 'support', text: "Keep going, you're doing amazing!", emoji: '💪' },
  { key: 'support_believe', type: 'support', text: "I believe in you!", emoji: '🙌' },
  { key: 'taunt_all', type: 'taunt', text: "Is that all you've got?", emoji: '😏' },
  { key: 'taunt_second', type: 'taunt', text: "Second place is just first loser... jk jk", emoji: '💀' },
  { key: 'taunt_companion', type: 'taunt', text: "My companion could beat yours with its eyes closed", emoji: '😎' },
  { key: 'taunt_sleeping', type: 'taunt', text: "Sleeping on the job? I'm coming for that #1 spot!", emoji: '😴' },
  { key: 'taunt_nice_try', type: 'taunt', text: "Nice try, but not today", emoji: '🙅' },
  { key: 'taunt_cute', type: 'taunt', text: "That's cute. Watch and learn!", emoji: '📚' },
  { key: 'taunt_warm_up', type: 'taunt', text: "Was that your warm-up?", emoji: '🏋️' },
];

export const getShoutByKey = (key: string) => SHOUT_MESSAGES.find((msg) => msg.key === key);
