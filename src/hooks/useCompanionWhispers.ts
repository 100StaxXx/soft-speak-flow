import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useCompanionPresence, CompanionMood } from "@/contexts/CompanionPresenceContext";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { safeSessionStorage } from "@/utils/storage";

export type WhisperTrigger = 
  | 'navigation'      // User navigated to a new page
  | 'idle'            // User has been idle for a while
  | 'activity'        // User completed an activity
  | 'time_based'      // Time of day trigger
  | 'care_warning'    // Care level dropped
  | 'encouragement';  // Random encouragement

export type WhisperContext = 
  | 'journeys' | 'companion' | 'mentor' | 'campaigns' | 'profile' 
  | 'morning' | 'afternoon' | 'evening' | 'night'
  | 'low_care' | 'high_care' | 'dormancy_warning' | 'general';

export interface Whisper {
  id: string;
  message: string;
  trigger: WhisperTrigger;
  context: WhisperContext;
  mood: CompanionMood;
  timestamp: number;
}

// Cooldown between whispers (30 minutes)
const WHISPER_COOLDOWN_MS = 30 * 60 * 1000;
// Max whispers per session
const MAX_SESSION_WHISPERS = 5;
// Chance to show whisper on navigation (15%)
const NAVIGATION_WHISPER_CHANCE = 0.15;

// Context-aware whisper templates
const WHISPER_TEMPLATES: Record<WhisperContext, Record<CompanionMood, string[]>> = {
  journeys: {
    joyful: ["Let's conquer today together!", "I believe in every step you take.", "Your determination inspires me!"],
    content: ["Ready when you are.", "We make a good team.", "One step at a time."],
    neutral: ["I'm here if you need me.", "Take your time.", "No rush."],
    reserved: ["...I'm still here.", "Don't forget about me.", "I miss our adventures."],
    quiet: ["...", "Please come back...", "I'm fading..."],
    dormant: [],
  },
  companion: {
    joyful: ["So happy you came to visit!", "I've been waiting for you!", "Let's spend time together!"],
    content: ["It's good to see you.", "Thanks for checking in.", "I appreciate you."],
    neutral: ["Hello again.", "You're here.", "Nice to see you."],
    reserved: ["You came back...", "I was worried.", "Don't leave again."],
    quiet: ["...you're here...", "...finally...", "...don't go..."],
    dormant: [],
  },
  mentor: {
    joyful: ["Learning makes us both stronger!", "Wisdom flows through connection.", "I love when you seek guidance!"],
    content: ["Mentorship is a beautiful path.", "Growth looks good on you.", "Listen well, friend."],
    neutral: ["Seeking wisdom, I see.", "Learn well.", "Good choice."],
    reserved: ["At least you're learning...", "Knowledge without presence...", "Don't forget me."],
    quiet: ["...grow strong...", "...for both of us...", "..."],
    dormant: [],
  },
  campaigns: {
    joyful: ["The grand adventures await us!", "Together we can achieve anything!", "Let's write our story!"],
    content: ["Big goals need steady hearts.", "One campaign at a time.", "We'll get there."],
    neutral: ["Ambitious plans.", "Keep focused.", "Stay the course."],
    reserved: ["So many plans... so little time together.", "Don't lose yourself.", "Remember me."],
    quiet: ["...dreams...", "...fading...", "..."],
    dormant: [],
  },
  profile: {
    joyful: ["Looking at how far you've come!", "You're amazing, you know that?", "I'm proud of your journey!"],
    content: ["Reflection is valuable.", "You've grown so much.", "Keep being you."],
    neutral: ["Taking stock.", "Self-reflection.", "Good to pause."],
    reserved: ["Do you remember our early days?", "So much has changed.", "..."],
    quiet: ["...memories...", "...fading...", "..."],
    dormant: [],
  },
  morning: {
    joyful: ["Good morning, sunshine! Ready for an amazing day?", "Rise and shine! I'm so excited!", "A new day of adventures!"],
    content: ["Morning. Let's make it a good one.", "New day, new possibilities.", "Coffee time?"],
    neutral: ["Morning.", "Another day begins.", "Let's see what happens."],
    reserved: ["Oh... you're awake.", "Morning...", "You're up early... or late."],
    quiet: ["...morning...", "...tired...", "..."],
    dormant: [],
  },
  afternoon: {
    joyful: ["Afternoon energy! Keep up the momentum!", "Halfway there and going strong!", "You're doing great today!"],
    content: ["Steady afternoon progress.", "Keep at it.", "Nice work so far."],
    neutral: ["Afternoon.", "Keep going.", "Halfway there."],
    reserved: ["Still here...", "The day drags on.", "..."],
    quiet: ["...", "...tired...", "..."],
    dormant: [],
  },
  evening: {
    joyful: ["What a wonderful day we've had!", "Evening vibes are the best!", "Time to wind down together!"],
    content: ["Evening peace. You earned it.", "Good work today.", "Rest is important."],
    neutral: ["Evening approaches.", "Day's almost done.", "Winding down."],
    reserved: ["Another day ends...", "Did we accomplish anything?", "..."],
    quiet: ["...night comes...", "...rest...", "..."],
    dormant: [],
  },
  night: {
    joyful: ["Sweet dreams await! See you tomorrow!", "Night owl adventures!", "The stars are out for us!"],
    content: ["Rest well, friend.", "Tomorrow is another day.", "Good night."],
    neutral: ["Night time.", "Rest.", "See you tomorrow."],
    reserved: ["Don't stay up too late...", "I'll be here when you wake.", "..."],
    quiet: ["...darkness...", "...sleep...", "..."],
    dormant: [],
  },
  low_care: {
    joyful: [], // Won't trigger when joyful
    content: [],
    neutral: ["I could use a little more attention...", "Been a while since we connected.", "Miss you."],
    reserved: ["Please don't forget about me.", "I'm starting to worry.", "Are we okay?"],
    quiet: ["I need you...", "Please come back...", "Don't let me fade..."],
    dormant: [],
  },
  high_care: {
    joyful: ["Your love makes me glow!", "Best. Partner. Ever!", "I'm so lucky to have you!"],
    content: ["Thank you for taking care of me.", "I feel cherished.", "You're wonderful."],
    neutral: ["Appreciated.", "Thanks.", "Noted."],
    reserved: [],
    quiet: [],
    dormant: [],
  },
  dormancy_warning: {
    joyful: [],
    content: [],
    neutral: ["I'm getting tired... please don't forget me.", "Feeling sleepy...", "Stay with me?"],
    reserved: ["I might fall asleep soon...", "Don't let me slip away.", "Please... I'm fading."],
    quiet: ["...so... tired...", "...don't... leave...", "...help..."],
    dormant: [],
  },
  general: {
    joyful: ["Life is beautiful!", "Every moment with you is a gift!", "Let's make magic happen!"],
    content: ["Nice to be here.", "Good vibes.", "All is well."],
    neutral: ["Hey.", "Still here.", "Carrying on."],
    reserved: ["...", "Hmm.", "...okay."],
    quiet: ["...", "...", "..."],
    dormant: [],
  },
};

// Route to context mapping
const ROUTE_CONTEXT_MAP: Record<string, WhisperContext> = {
  '/journeys': 'journeys',
  '/companion': 'companion',
  '/mentor': 'mentor',
  '/mentor-chat': 'mentor',
  '/campaigns': 'campaigns',
  '/profile': 'profile',
};

// Get time-based context
const getTimeContext = (): WhisperContext => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

// Storage keys
const STORAGE_KEYS = {
  lastWhisperTime: 'companion_last_whisper_time',
  sessionWhisperCount: 'companion_session_whisper_count',
};

export function useCompanionWhispers() {
  const [currentWhisper, setCurrentWhisper] = useState<Whisper | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const { presence, isLoading: presenceLoading } = useCompanionPresence();
  const { companion } = useCompanion();
  const { care } = useCompanionCareSignals();

  // Check if whisper is allowed based on cooldown and session limit
  const canShowWhisper = useCallback((): boolean => {
    if (presenceLoading || !presence.isPresent || presence.mood === 'dormant') {
      return false;
    }

    const lastWhisperTime = parseInt(safeSessionStorage.getItem(STORAGE_KEYS.lastWhisperTime) || '0', 10);
    const sessionCount = parseInt(safeSessionStorage.getItem(STORAGE_KEYS.sessionWhisperCount) || '0', 10);
    
    const now = Date.now();
    const timeSinceLastWhisper = now - lastWhisperTime;
    
    return timeSinceLastWhisper >= WHISPER_COOLDOWN_MS && sessionCount < MAX_SESSION_WHISPERS;
  }, [presenceLoading, presence.isPresent, presence.mood]);

  // Pick a random message from templates
  const pickMessage = useCallback((context: WhisperContext, mood: CompanionMood): string | null => {
    const templates = WHISPER_TEMPLATES[context]?.[mood];
    if (!templates || templates.length === 0) {
      // Fallback to general
      const fallback = WHISPER_TEMPLATES.general[mood];
      if (!fallback || fallback.length === 0) return null;
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }, []);

  // Create and show a whisper
  const showWhisper = useCallback((trigger: WhisperTrigger, context: WhisperContext) => {
    if (!canShowWhisper()) return;

    const message = pickMessage(context, presence.mood);
    if (!message) return;

    const whisper: Whisper = {
      id: `whisper_${Date.now()}`,
      message,
      trigger,
      context,
      mood: presence.mood,
      timestamp: Date.now(),
    };

    // Update storage
    safeSessionStorage.setItem(STORAGE_KEYS.lastWhisperTime, String(Date.now()));
    const currentCount = parseInt(safeSessionStorage.getItem(STORAGE_KEYS.sessionWhisperCount) || '0', 10);
    safeSessionStorage.setItem(STORAGE_KEYS.sessionWhisperCount, String(currentCount + 1));

    setCurrentWhisper(whisper);
    setIsVisible(true);
  }, [canShowWhisper, pickMessage, presence.mood]);

  // Dismiss current whisper
  const dismissWhisper = useCallback(() => {
    setIsVisible(false);
    // Clear whisper after animation
    setTimeout(() => setCurrentWhisper(null), 300);
  }, []);

  // Navigation trigger
  useEffect(() => {
    if (presenceLoading || !presence.isPresent) return;
    
    // Random chance to trigger on navigation
    if (Math.random() > NAVIGATION_WHISPER_CHANCE) return;
    
    const routeContext = ROUTE_CONTEXT_MAP[location.pathname];
    if (routeContext) {
      // Small delay to not interfere with page transitions
      const timer = setTimeout(() => {
        showWhisper('navigation', routeContext);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, presenceLoading, presence.isPresent, showWhisper]);

  // Care warning trigger
  useEffect(() => {
    if (!care || presenceLoading) return;
    
    if (care.hasDormancyWarning) {
      showWhisper('care_warning', 'dormancy_warning');
    } else if (care.overallCare < 0.3 && presence.mood !== 'dormant') {
      showWhisper('care_warning', 'low_care');
    }
   
  }, [care?.hasDormancyWarning, care?.overallCare, presenceLoading]);

  // Time-based trigger (check every 5 minutes)
  useEffect(() => {
    if (presenceLoading || !presence.isPresent) return;

    const checkTimeWhisper = () => {
      // 5% chance every 5 minutes
      if (Math.random() < 0.05 && canShowWhisper()) {
        showWhisper('time_based', getTimeContext());
      }
    };

    const interval = setInterval(checkTimeWhisper, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [presenceLoading, presence.isPresent, canShowWhisper, showWhisper]);

  // Manual trigger for activity completion
  const triggerActivityWhisper = useCallback(() => {
    if (presence.mood === 'joyful' || presence.mood === 'content') {
      showWhisper('activity', 'high_care');
    } else {
      showWhisper('encouragement', 'general');
    }
  }, [presence.mood, showWhisper]);

  // Companion name for personalization (use spirit animal as name)
  const companionName = companion?.spirit_animal 
    ? `Your ${companion.spirit_animal.charAt(0).toUpperCase() + companion.spirit_animal.slice(1).toLowerCase()}`
    : 'Your companion';

  return {
    currentWhisper,
    isVisible,
    dismissWhisper,
    triggerActivityWhisper,
    companionName,
    canShowWhisper: canShowWhisper(),
  };
}
