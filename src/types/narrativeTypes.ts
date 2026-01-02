// Narrative Star Path System Types

import { AdversaryTheme } from './astralEncounters';

// Story Types
export type StoryTypeSlug = 
  | 'treasure_hunt' 
  | 'mystery' 
  | 'pilgrimage' 
  | 'heroes_journey' 
  | 'rescue_mission' 
  | 'exploration';

export interface StoryType {
  id: string;
  slug: StoryTypeSlug;
  name: string;
  description: string;
  base_chapters: number;
  boss_name_template: string;
  boss_theme: string;
  boss_lore_template: string | null;
  icon: string | null;
}

// Character Archetypes
export type CharacterArchetype = 
  | 'wanderer'   // Mysterious guide seeking redemption
  | 'rival'      // Competitive spirit who challenges user
  | 'lost_one'   // Broken soul user helps heal
  | 'trickster'  // Comic relief with hidden depths
  | 'guardian'   // Protective figure who must let go
  | 'echo';      // Reflection of user's potential dark path

export type CharacterArcStage = 
  | 'introduction' 
  | 'conflict' 
  | 'growth' 
  | 'resolution';

export type CharacterFate = 
  | 'alive' 
  | 'departed' 
  | 'transformed' 
  | 'sacrificed';

export interface StoryCharacter {
  id: string;
  user_id: string;
  name: string;
  species: string | null;
  archetype: CharacterArchetype;
  visual_description: string | null;
  signature_feature: string | null;
  speech_pattern: string | null;
  catchphrase: string | null;
  core_motivation: string | null;
  greatest_fear: string | null;
  secret_shame: string | null;
  backstory: string | null;
  current_goal: string | null;
  arc_stage: CharacterArcStage;
  relationship_to_user: string | null;
  relationship_history: string[];
  first_appeared_epic_id: string | null;
  first_appeared_chapter: number | null;
  last_seen_epic_id: string | null;
  last_seen_chapter: number | null;
  times_encountered: number;
  is_active: boolean;
  fate: CharacterFate;
  created_at: string;
  updated_at: string;
}

// Story Universe
export interface StoryUniverse {
  id: string;
  user_id: string;
  world_name: string | null;
  world_era: string | null;
  prophecy_fragments: string[];
  active_mysteries: string[];
  resolved_mysteries: string[];
  foreshadowing_seeds: string[];
  memorable_moments: string[];
  running_callbacks: string[];
  created_at: string;
  updated_at: string;
}

// Mentor Story Relationship
export interface MentorStoryRelationship {
  id: string;
  user_id: string;
  mentor_id: string | null;
  trust_level: number;
  key_moments: string[];
  wisdom_shared: string[];
  mentor_transitions: MentorTransition[];
  current_since: string;
  created_at: string;
  updated_at: string;
}

export interface MentorTransition {
  from_mentor_id: string;
  from_mentor_name: string;
  to_mentor_id: string;
  to_mentor_name: string;
  transitioned_at: string;
  farewell_narrative?: string;
}

// Story Seed (generated at epic creation)
export interface StorySeed {
  book_title: string;
  
  the_great_mystery: {
    question: string;
    false_answer: string;
    true_answer: string;
    why_it_matters: string;
  };
  
  the_prophecy: {
    full_text: string;
    line_meanings: string[];
    when_revealed: number[];
  };
  
  the_recurring_symbol: {
    object: string;
    first_appearance: string;
    growing_significance: string;
    final_revelation: string;
  };
  
  the_ensemble_cast: CharacterBlueprint[];
  
  chapter_blueprints: ChapterBlueprint[];
  
  emotional_beats: {
    wonder_moments: string[];
    heartbreak_moments: string[];
    triumph_moments: string[];
    laughter_moments: string[];
    growth_mirrors: string[];
  };
  
  mentor_arc: {
    mentor_id: string;
    mentor_name: string;
    introduction_scene: string;
    wisdom_moments: string[];
    finale_role: string;
  };
  
  finale_architecture: {
    boss_name: string;
    boss_theme: AdversaryTheme;
    boss_lore: string;
    boss_weakness_hint: string;
    the_cost: string;
    the_twist: string;
    the_callback: string;
    the_resolution: string;
    the_new_beginning: string;
  };
}

export interface CharacterBlueprint {
  name: string;
  archetype: CharacterArchetype;
  species_and_appearance: string;
  speech_pattern: string;
  catchphrase: string;
  their_secret: string;
  arc: {
    introduction: string;
    conflict: string;
    growth: string;
    resolution: string;
  };
  relationship_to_user: string;
  appears_in_chapters: number[];
}

export interface ChapterBlueprint {
  chapter: number;
  title: string;
  narrative_purpose: string;
  opening_hook: string;
  featured_characters: string[];
  plot_advancement: string;
  character_moment: string;
  symbol_appearance: string;
  prophecy_seed: string;
  mystery_seed: string;
  cliffhanger: string;
  mentor_wisdom?: string;
}

// Chapter Output (from generation)
export interface ChapterOutput {
  chapter_title: string;
  cold_open: string;
  main_story: string;
  the_turn: string;
  cliffhanger: string;
  
  character_tracking: {
    characters_present: string[];
    relationship_developments: string[];
    new_information_revealed: string[];
  };
  
  continuity_tracking: {
    threads_advanced: string[];
    seeds_planted: string[];
    callbacks_used: string[];
    symbol_appearance: string;
  };
  
  memorable_lines: {
    best_dialogue: string;
    emotional_peak: string;
    foreshadowing: string;
  };
  
  next_chapter_setup: {
    dangling_thread: string;
    emotional_promise: string;
  };
  
  mentor_moment?: {
    wisdom_shared: string;
    mentor_dialogue: string;
  };
}

// Enhanced Postcard (chapter)
export interface NarrativePostcard {
  id: string;
  user_id: string;
  companion_id: string;
  epic_id: string | null;
  milestone_percent: number;
  chapter_number: number | null;
  chapter_title: string | null;
  location_name: string;
  location_description: string;
  image_url: string;
  caption: string | null;
  clue_text: string | null;
  story_content: string | null;
  location_revealed: boolean | null;
  is_finale: boolean | null;
  characters_featured: string[] | null;
  prophecy_line: string | null;
  seeds_planted: string[] | null;
  generated_at: string;
  created_at: string;
}

// Epic with narrative fields
export interface NarrativeEpic {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_days: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'abandoned';
  progress_percentage: number;
  theme_color: string | null;
  story_type_slug: StoryTypeSlug | null;
  story_seed: StorySeed | null;
  book_title: string | null;
  total_chapters: number | null;
  xp_reward: number;
  invite_code: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Milestone checkpoint for UI
export interface NarrativeCheckpoint {
  chapter: number;
  progressPercent: number;
  locationName: string | null;
  locationRevealed: boolean;
  isReached: boolean;
  isCurrent: boolean;
  isFinale: boolean;
  clueText: string | null;
}

// Boss battle context
export interface BossBattleContext {
  bossName: string;
  bossTheme: AdversaryTheme;
  bossLore: string;
  weaknessHints: string[];
  prophecyLines: string[];
  epicTitle: string;
  bookTitle: string;
}
