import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useMemo, useCallback } from "react";

// Stable random based on seed - ensures consistency within a session
const getStableRandom = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
};

interface VoiceTemplate {
  species: string;
  voice_style: string;
  personality_traits: string[];
  greeting_templates: string[];
  encouragement_templates: string[];
  concern_templates: string[];
  care_high_greetings: string[];
  care_medium_greetings: string[];
  care_low_greetings: string[];
  care_critical_greetings: string[];
  recovery_greetings: string[];
  path_greetings: Record<string, string[]>;
  bond_level_dialogue: Record<string, string[]>;
}

export type DialogueMood = 'thriving' | 'content' | 'concerned' | 'desperate' | 'recovering';

export function useCompanionDialogue() {
  const { companion } = useCompanion();
  const { care, isLoading: careLoading } = useCompanionCareSignals();
  
  // Fetch universal voice template (same for all species)
  const { data: voiceTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ['companion-voice-template'],
    queryFn: async (): Promise<VoiceTemplate | null> => {
      const { data, error } = await supabase
        .from('companion_voice_templates')
        .select('*')
        .eq('species', 'universal')
        .maybeSingle();
      
      if (error) {
        console.error('Failed to fetch voice template:', error);
        return null;
      }
      
      if (!data) return null;
      
      return {
        species: data.species,
        voice_style: data.voice_style,
        personality_traits: data.personality_traits || [],
        greeting_templates: data.greeting_templates || [],
        encouragement_templates: data.encouragement_templates || [],
        concern_templates: data.concern_templates || [],
        care_high_greetings: data.care_high_greetings || [],
        care_medium_greetings: data.care_medium_greetings || [],
        care_low_greetings: data.care_low_greetings || [],
        care_critical_greetings: data.care_critical_greetings || [],
        recovery_greetings: data.recovery_greetings || [],
        path_greetings: (data.path_greetings as Record<string, string[]>) || {},
        bond_level_dialogue: (data.bond_level_dialogue as Record<string, string[]>) || {},
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Recovery-day-specific dialogue lines
  const recoveryDayDialogue: Record<number, string> = {
    1: "...is someone there?",
    2: "I can feel you... don't leave...",
    3: "Your warmth... it's bringing me back...",
    4: "I remember now... we had so many days together...",
    5: "I'm almost ready... thank you for not giving up on me...",
  };

  // Determine dialogue mood based on care signals
  const dialogueMood = useMemo((): DialogueMood => {
    if (!care) return 'content';
    
    // Check for recovery state first (dormant but with recovery days > 0)
    if (care.dormancy?.isDormant && care.dormancy.recoveryDays > 0) return 'recovering';
    if (care.dormancy?.isDormant) return 'desperate';
    
    // Note: overallCare is 0-1, not 0-100
    const overallCare = care.overallCare;
    if (overallCare >= 0.8) return 'thriving';
    if (overallCare >= 0.5) return 'content';
    if (overallCare >= 0.25) return 'concerned';
    return 'desperate';
  }, [care]);

  // Get recovery-specific greeting based on recovery day
  const recoveryGreeting = useMemo(() => {
    if (!care?.dormancy?.isDormant || care.dormancy.recoveryDays === 0) return null;
    
    const day = Math.min(care.dormancy.recoveryDays, 5);
    return recoveryDayDialogue[day] || null;
  }, [care?.dormancy]);

  // Stable random picker that varies by day but is consistent within a session
  // Uses spirit_animal for variety even though template is universal
  const spiritAnimal = companion?.spirit_animal || 'companion';
  const pickRandom = useCallback((arr: string[], contextKey: string): string => {
    if (!arr || arr.length === 0) return "";
    const seed = `${new Date().toDateString()}-${contextKey}-${spiritAnimal}`;
    const index = Math.floor(getStableRandom(seed) * arr.length);
    return arr[index];
  }, [spiritAnimal]);

  // Select appropriate greeting based on care level and path
  const currentGreeting = useMemo(() => {
    if (!voiceTemplate) return "Hello, friend.";
    
    // Priority 1: Recovery-day-specific greeting (highest priority during recovery)
    if (dialogueMood === 'recovering' && recoveryGreeting) {
      return recoveryGreeting;
    }
    
    // Priority 2: Generic recovery greeting from template
    if (dialogueMood === 'recovering' && voiceTemplate.recovery_greetings?.length) {
      return pickRandom(voiceTemplate.recovery_greetings, 'recovery');
    }
    
    // Priority 2: Path-specific greeting (20% chance if path is locked)
    const evolutionPath = care?.evolutionPath?.path;
    if (evolutionPath && care?.evolutionPath?.isLocked) {
      const pathGreetings = voiceTemplate.path_greetings?.[evolutionPath];
      // Use stable random for path chance too
      if (pathGreetings?.length && getStableRandom(`${new Date().toDateString()}-path-chance`) < 0.2) {
        return pickRandom(pathGreetings as string[], `path-${evolutionPath}`);
      }
    }
    
    // Priority 3: Care level greeting
    switch (dialogueMood) {
      case 'thriving':
        return pickRandom(voiceTemplate.care_high_greetings, 'thriving') || pickRandom(voiceTemplate.greeting_templates, 'default');
      case 'content':
        return pickRandom(voiceTemplate.care_medium_greetings, 'content') || pickRandom(voiceTemplate.greeting_templates, 'default');
      case 'concerned':
        return pickRandom(voiceTemplate.care_low_greetings, 'concerned') || pickRandom(voiceTemplate.concern_templates, 'concern');
      case 'desperate':
        return pickRandom(voiceTemplate.care_critical_greetings, 'desperate') || pickRandom(voiceTemplate.concern_templates, 'concern');
      default:
        return pickRandom(voiceTemplate.greeting_templates, 'default');
    }
  }, [voiceTemplate, dialogueMood, care?.evolutionPath, recoveryGreeting, pickRandom]);

  // Get bond-level dialogue
  const bondDialogue = useMemo(() => {
    if (!voiceTemplate || !care?.bond) return null;
    
    const bondLevel = Math.min(5, Math.max(1, care.bond.level));
    const bondLines = voiceTemplate.bond_level_dialogue?.[String(bondLevel)];
    
    if (!bondLines || bondLines.length === 0) return null;
    
    return pickRandom(bondLines, `bond-${bondLevel}`);
  }, [voiceTemplate, care?.bond, pickRandom]);

  // Get encouragement based on mood
  const encouragement = useMemo(() => {
    if (!voiceTemplate) return null;
    
    return pickRandom(voiceTemplate.encouragement_templates, 'encouragement');
  }, [voiceTemplate, pickRandom]);

  return {
    greeting: currentGreeting,
    bondDialogue,
    encouragement,
    dialogueMood,
    voiceStyle: voiceTemplate?.voice_style || '',
    personalityTraits: voiceTemplate?.personality_traits || [],
    isLoading: templateLoading || careLoading,
  };
}
