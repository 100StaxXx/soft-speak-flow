/**
 * Epic Rewards System Types
 * Types for mystery badges and cosmetic items earned from epic completion
 */

export type RewardType = 'background' | 'frame' | 'effect' | 'artifact';
export type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface EpicReward {
  id: string;
  name: string;
  description: string;
  reward_type: RewardType;
  rarity: RewardRarity;
  css_effect: RewardCssEffect | null;
  image_url: string | null;
  story_type_slug: string | null;
  adversary_theme: string | null;
  drop_weight: number;
  created_at: string;
}

export interface UserEpicReward {
  id: string;
  user_id: string;
  reward_id: string;
  epic_id: string | null;
  unlocked_at: string;
  is_equipped: boolean;
  epic_rewards?: EpicReward;
}

export interface RewardCssEffect {
  // Background effects
  gradient?: string;
  animation?: string;
  particles?: string;
  glow?: string;
  
  // Frame effects - SMITE-inspired enhanced system
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: 'solid' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset' | string;
  borderRadius?: string;
  shimmer?: boolean;
  glowColor?: string;
  
  // Corner decoration styles
  cornerStyle?: 'ornate' | 'crystal' | 'flame' | 'circuit' | 'scale' | 'thread' | 'wisp' | 
                'aurora' | 'rift' | 'deity' | 'dimensional' | 'treasure' | 'mystery' | 
                'lotus' | 'heroic' | 'shield' | 'compass';
  cornerColor?: string;
  
  // Enhanced glow effects
  glowIntensity?: 'subtle' | 'medium' | 'intense';
  glowAnimation?: 'static' | 'pulse' | 'breathe' | 'flicker' | 'shift';
  
  // Particle effects
  particleEffect?: 'stars' | 'embers' | 'ice' | 'void' | 'divine' | 'dimensional';
  
  // Gradient borders (for legendary frames)
  gradientBorder?: string;
  animatedGradient?: boolean;
  
  // Victory effects
  effectType?: 'particles' | 'overlay';
  color?: string;
  intensity?: string;
  image?: string;
  position?: string;
  
  // Artifact effects
  icon?: string;
}

// Frame corner style to SVG path mapping
export type FrameCornerStyle = RewardCssEffect['cornerStyle'];

// Glow animation CSS class mapping
export const GLOW_ANIMATION_CLASSES: Record<string, string> = {
  static: '',
  pulse: 'animate-frame-pulse',
  breathe: 'animate-frame-breathe',
  flicker: 'animate-frame-flicker',
  shift: 'animate-frame-shift',
};

export interface RewardRevealData {
  badge: {
    title: string;
    description: string;
    icon: string;
    tier: string;
  };
  loot: EpicReward | null;
  isDuplicate: boolean;
  bonusXP?: number;
}

export interface EquippedRewards {
  background: UserEpicReward | null;
  frame: UserEpicReward | null;
  effect: UserEpicReward | null;
}

// Story type to badge mapping
export const STORY_TYPE_BADGES: Record<string, {
  achievementType: string;
  title: string;
  description: string;
  icon: string;
  tier: 'gold' | 'platinum';
}> = {
  treasure_hunt: {
    achievementType: 'story_treasure_hunt_complete',
    title: 'Fortune Seeker',
    description: 'Completed a Treasure Hunt epic',
    icon: '💎',
    tier: 'gold',
  },
  mystery: {
    achievementType: 'story_mystery_complete',
    title: 'Truth Unveiler',
    description: 'Completed a Mystery epic',
    icon: '🔮',
    tier: 'gold',
  },
  pilgrimage: {
    achievementType: 'story_pilgrimage_complete',
    title: 'Soul Pilgrim',
    description: 'Completed a Pilgrimage epic',
    icon: '🧘',
    tier: 'gold',
  },
  heroes_journey: {
    achievementType: 'story_heroes_journey_complete',
    title: 'Legendary Hero',
    description: 'Completed a Heroes Journey epic',
    icon: '⚔️',
    tier: 'platinum',
  },
  rescue_mission: {
    achievementType: 'story_rescue_mission_complete',
    title: 'Cosmic Savior',
    description: 'Completed a Rescue Mission epic',
    icon: '🛡️',
    tier: 'gold',
  },
  exploration: {
    achievementType: 'story_exploration_complete',
    title: 'Star Cartographer',
    description: 'Completed an Exploration epic',
    icon: '🌌',
    tier: 'gold',
  },
};

// Rarity display configuration
export const RARITY_CONFIG: Record<RewardRarity, {
  label: string;
  color: string;
  glowClass: string;
  bgClass: string;
}> = {
  common: {
    label: 'Common',
    color: 'hsl(220, 10%, 60%)',
    glowClass: 'shadow-gray-500/30',
    bgClass: 'from-gray-400/20 to-gray-600/20',
  },
  rare: {
    label: 'Rare',
    color: 'hsl(210, 80%, 60%)',
    glowClass: 'shadow-blue-500/40',
    bgClass: 'from-blue-400/20 to-blue-600/20',
  },
  epic: {
    label: 'Epic',
    color: 'hsl(280, 70%, 60%)',
    glowClass: 'shadow-purple-500/50',
    bgClass: 'from-purple-400/20 to-purple-600/20',
  },
  legendary: {
    label: 'Legendary',
    color: 'hsl(45, 90%, 55%)',
    glowClass: 'shadow-yellow-500/60',
    bgClass: 'from-yellow-400/30 to-orange-500/30',
  },
};
