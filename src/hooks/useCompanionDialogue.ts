import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useMemo } from "react";

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
  scar_references: string[];
  path_greetings: Record<string, string[]>;
  bond_level_dialogue: Record<string, string[]>;
}

export type DialogueMood = 'thriving' | 'content' | 'concerned' | 'desperate' | 'recovering';

export function useCompanionDialogue() {
  const { companion } = useCompanion();
  const { care, isLoading: careLoading } = useCompanionCareSignals();
  
  const species = companion?.spirit_animal?.toLowerCase() || 'wolf';
  
  // Fetch voice template for companion's species
  const { data: voiceTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ['companion-voice-template', species],
    queryFn: async (): Promise<VoiceTemplate | null> => {
      const { data, error } = await supabase
        .from('companion_voice_templates')
        .select('*')
        .eq('species', species)
        .single();
      
      if (error || !data) {
        console.error('Failed to fetch voice template:', error);
        return null;
      }
      
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
        scar_references: data.scar_references || [],
        path_greetings: (data.path_greetings as Record<string, string[]>) || {},
        bond_level_dialogue: (data.bond_level_dialogue as Record<string, string[]>) || {},
      };
    },
    enabled: !!species,
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

  // Select appropriate greeting based on care level and path
  const currentGreeting = useMemo(() => {
    if (!voiceTemplate) return "Hello, friend.";
    
    const pickRandom = (arr: string[]): string => {
      if (!arr || arr.length === 0) return "";
      return arr[Math.floor(Math.random() * arr.length)];
    };
    
    // Priority 1: Recovery-day-specific greeting (highest priority during recovery)
    if (dialogueMood === 'recovering' && recoveryGreeting) {
      return recoveryGreeting;
    }
    
    // Priority 2: Generic recovery greeting from template
    if (dialogueMood === 'recovering' && voiceTemplate.recovery_greetings?.length) {
      return pickRandom(voiceTemplate.recovery_greetings);
    }
    
    // Priority 2: Path-specific greeting (20% chance if path is locked)
    const evolutionPath = care?.evolutionPath?.path;
    if (evolutionPath && care?.evolutionPath?.isLocked) {
      const pathGreetings = voiceTemplate.path_greetings?.[evolutionPath];
      if (pathGreetings?.length && Math.random() < 0.2) {
        return pickRandom(pathGreetings as string[]);
      }
    }
    
    // Priority 3: Care level greeting
    switch (dialogueMood) {
      case 'thriving':
        return pickRandom(voiceTemplate.care_high_greetings) || pickRandom(voiceTemplate.greeting_templates);
      case 'content':
        return pickRandom(voiceTemplate.care_medium_greetings) || pickRandom(voiceTemplate.greeting_templates);
      case 'concerned':
        return pickRandom(voiceTemplate.care_low_greetings) || pickRandom(voiceTemplate.concern_templates);
      case 'desperate':
        return pickRandom(voiceTemplate.care_critical_greetings) || pickRandom(voiceTemplate.concern_templates);
      default:
        return pickRandom(voiceTemplate.greeting_templates);
    }
  }, [voiceTemplate, dialogueMood, care?.evolutionPath, recoveryGreeting]);

  // Get scar reference if companion has scars
  const scarReference = useMemo(() => {
    if (!voiceTemplate || !companion) return null;
    
    const scarHistory = (companion as any).scar_history as any[] | null;
    if (!scarHistory || scarHistory.length === 0) return null;
    
    // 15% chance to reference a scar
    if (Math.random() > 0.15) return null;
    
    const pickRandom = (arr: string[]): string => {
      if (!arr || arr.length === 0) return "";
      return arr[Math.floor(Math.random() * arr.length)];
    };
    
    return pickRandom(voiceTemplate.scar_references);
  }, [voiceTemplate, companion]);

  // Get bond-level dialogue
  const bondDialogue = useMemo(() => {
    if (!voiceTemplate || !care?.bond) return null;
    
    const bondLevel = Math.min(5, Math.max(1, care.bond.level));
    const bondLines = voiceTemplate.bond_level_dialogue?.[String(bondLevel)];
    
    if (!bondLines || bondLines.length === 0) return null;
    
    return bondLines[Math.floor(Math.random() * bondLines.length)];
  }, [voiceTemplate, care?.bond]);

  // Get encouragement based on mood
  const encouragement = useMemo(() => {
    if (!voiceTemplate) return null;
    
    const pickRandom = (arr: string[]): string => {
      if (!arr || arr.length === 0) return "";
      return arr[Math.floor(Math.random() * arr.length)];
    };
    
    return pickRandom(voiceTemplate.encouragement_templates);
  }, [voiceTemplate]);

  return {
    greeting: currentGreeting,
    scarReference,
    bondDialogue,
    encouragement,
    dialogueMood,
    voiceStyle: voiceTemplate?.voice_style || '',
    personalityTraits: voiceTemplate?.personality_traits || [],
    isLoading: templateLoading || careLoading,
  };
}
