 /**
  * Reaction pools configuration
  * Static mapping of source systems and moment types for client-side reference
  */
 
 // Valid source systems that can trigger reactions
 export type SourceSystem = 'quest' | 'ritual' | 'resist' | 'pomodoro' | 'mentor';
 
 // Valid moment types for routing reactions
 export type MomentType = 
   | 'momentum_gain'      // First win today, first task after inactivity
   | 'quiet_consistency'  // Steady days, multiple rituals without drama
   | 'discipline_win'     // Rituals done on time, full ritual set completed
   | 'urge_defeated'      // Any resist victory
   | 'comeback'           // First action after 3+ day lapse
   | 'breakthrough'       // First perfect day, first perfect week, milestone
   | 'focus_proof';       // Pomodoro completion
 
 // Valid tone tags for anti-repetition
 export type ToneTag = 'hype' | 'calm' | 'proud' | 'funny' | 'soft' | 'neutral';
 
 // Context tags for special conditions
 export type ContextTag = 'late_night' | 'after_lapse' | 'rare';
 
 // Per-core budget limits
 export const SOURCE_LIMITS: Record<SourceSystem, number> = {
   quest: 1,
   ritual: 2,
   resist: 3,
   pomodoro: 1,
   mentor: 1,
 };
 
 // Global daily limit
 export const DAILY_LIMIT = 5;
 
 // Rare pool cooldown in days
 export const RARE_COOLDOWN_DAYS = 7;
 
 // Default moment type when no specific condition matches
 export const DEFAULT_MOMENT_TYPE: MomentType = 'momentum_gain';
 
 // Map source fields to database column names
 export const SOURCE_FIELD_MAP: Record<SourceSystem, string> = {
   quest: 'quest_count',
   ritual: 'ritual_count',
   resist: 'resist_count',
   pomodoro: 'pomodoro_count',
   mentor: 'mentor_count',
 };