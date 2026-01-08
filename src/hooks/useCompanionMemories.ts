import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCompanion } from "./useCompanion";
import { useMemo, useCallback } from "react";

export type MemoryType = 
  | 'first_meeting'       // When companion was created
  | 'first_evolution'     // First evolution milestone
  | 'evolution'           // Any evolution
  | 'milestone'           // XP/progress milestones
  | 'streak'              // Streak achievements
  | 'recovery'            // Woke from dormancy
  | 'challenge_complete'  // Completed a challenge
  | 'epic_complete'       // Completed an epic/campaign
  | 'special_moment'      // Special interactions
  | 'bond_milestone';     // Bond level increased

export interface CompanionMemory {
  id: string;
  user_id: string;
  companion_id: string;
  memory_type: MemoryType;
  memory_date: string;
  memory_context: {
    title?: string;
    description?: string;
    emotion?: 'joy' | 'pride' | 'gratitude' | 'wonder' | 'relief';
    details?: Record<string, unknown>;
  } | null;
  referenced_count: number;
  last_referenced_at: string | null;
  created_at: string;
}

export interface BondMilestone {
  level: number;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

// Bond level names and descriptions
const BOND_MILESTONES: Omit<BondMilestone, 'unlockedAt'>[] = [
  { level: 1, name: 'Acquaintance', description: 'A new journey begins...', icon: '🌱' },
  { level: 2, name: 'Companion', description: 'Trust is forming between you.', icon: '🤝' },
  { level: 3, name: 'Friend', description: 'Your bond grows stronger each day.', icon: '💫' },
  { level: 4, name: 'Close Friend', description: 'A deep understanding develops.', icon: '✨' },
  { level: 5, name: 'Soul Bond', description: 'An unbreakable connection.', icon: '💎' },
  { level: 6, name: 'Eternal Partner', description: 'Together through all realms.', icon: '🌟' },
  { level: 7, name: 'Legendary Bond', description: 'A bond that transcends time.', icon: '👑' },
];

// Memory emotion to dialogue mapping
const MEMORY_EMOTIONS: Record<string, string[]> = {
  joy: ["That was such a happy day!", "I still feel warm thinking about it.", "One of our best moments!"],
  pride: ["You worked so hard for that.", "I was so proud of you!", "Look how far we've come."],
  gratitude: ["Thank you for that moment.", "I treasure that memory.", "You've given me so much."],
  wonder: ["That was magical!", "I still can't believe it happened.", "What an adventure!"],
  relief: ["We made it through together.", "I'm so glad you came back.", "Everything is okay now."],
};

export function useCompanionMemories() {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  // Fetch all memories for the companion
  const { data: memories, isLoading: memoriesLoading } = useQuery({
    queryKey: ['companion-memories', companion?.id],
    queryFn: async (): Promise<CompanionMemory[]> => {
      if (!companion?.id) return [];

      const { data, error } = await supabase
        .from('companion_memories')
        .select('*')
        .eq('companion_id', companion.id)
        .order('memory_date', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch memories:', error);
        throw error;
      }

      return (data || []) as CompanionMemory[];
    },
    enabled: !!companion?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current bond level
  const { data: bondData, isLoading: bondLoading } = useQuery({
    queryKey: ['companion-bond', companion?.id],
    queryFn: async () => {
      if (!companion?.id || !user?.id) return null;

      const { data, error } = await supabase
        .from('user_companion')
        .select('bond_level, total_interactions, last_interaction_at')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Failed to fetch bond data:', error);
        return null;
      }

      return data;
    },
    enabled: !!companion?.id && !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Create a new memory
  const createMemoryMutation = useMutation({
    mutationFn: async (params: {
      memoryType: MemoryType;
      context?: CompanionMemory['memory_context'];
    }) => {
      if (!user?.id || !companion?.id) throw new Error('No user or companion');

      const insertData = {
        user_id: user.id,
        companion_id: companion.id,
        memory_type: params.memoryType,
        memory_context: params.context || null,
        memory_date: new Date().toISOString().split('T')[0],
        referenced_count: 0,
      };

      const { data, error } = await supabase
        .from('companion_memories')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companion-memories', companion?.id] });
    },
  });

  // Reference a memory (companion "remembers" it in dialogue)
  const referenceMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      // First get current count
      const { data: current } = await supabase
        .from('companion_memories')
        .select('referenced_count')
        .eq('id', memoryId)
        .single();
      
      const newCount = (current?.referenced_count || 0) + 1;
      
      const { error } = await supabase
        .from('companion_memories')
        .update({
          referenced_count: newCount,
          last_referenced_at: new Date().toISOString(),
        })
        .eq('id', memoryId);

      if (error) throw error;
    },
  });

  // Get bond milestones with unlock status
  const bondMilestones = useMemo((): BondMilestone[] => {
    const currentLevel = bondData?.bond_level || 1;
    
    return BOND_MILESTONES.map((milestone) => ({
      ...milestone,
      unlockedAt: milestone.level <= currentLevel 
        ? (milestone.level === currentLevel ? 'now' : 'past') 
        : null,
    }));
  }, [bondData?.bond_level]);

  // Get current bond info
  const currentBond = useMemo(() => {
    const level = bondData?.bond_level || 1;
    const milestone = BOND_MILESTONES.find(m => m.level === level) || BOND_MILESTONES[0];
    const nextMilestone = BOND_MILESTONES.find(m => m.level === level + 1);
    
    return {
      level,
      ...milestone,
      nextMilestone,
      totalInteractions: bondData?.total_interactions || 0,
      lastInteractionAt: bondData?.last_interaction_at,
    };
  }, [bondData]);

  // Get a random memory for dialogue (prioritizes less-referenced memories)
  const getRandomMemory = useCallback((): CompanionMemory | null => {
    if (!memories || memories.length === 0) return null;

    // Weight memories by how rarely they've been referenced
    const maxRefs = Math.max(...memories.map(m => m.referenced_count || 0), 1);
    const weighted = memories.map(m => ({
      memory: m,
      weight: (maxRefs - (m.referenced_count || 0)) + 1,
    }));

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { memory, weight } of weighted) {
      random -= weight;
      if (random <= 0) return memory;
    }

    return memories[0];
  }, [memories]);

  // Get dialogue line for a memory
  const getMemoryDialogue = useCallback((memory: CompanionMemory): string | null => {
    const context = memory.memory_context;
    if (!context) return null;

    const emotion = context.emotion || 'joy';
    const emotionLines = MEMORY_EMOTIONS[emotion] || MEMORY_EMOTIONS.joy;
    const line = emotionLines[Math.floor(Math.random() * emotionLines.length)];

    if (context.title) {
      return `Remember when ${context.title.toLowerCase()}? ${line}`;
    }

    return line;
  }, []);

  // Create memory helper
  const createMemory = useCallback((
    memoryType: MemoryType,
    context?: CompanionMemory['memory_context']
  ) => {
    return createMemoryMutation.mutateAsync({ memoryType, context });
  }, [createMemoryMutation]);

  // Reference memory helper
  const referenceMemory = useCallback((memoryId: string) => {
    return referenceMemoryMutation.mutate(memoryId);
  }, [referenceMemoryMutation]);

  // Get memories grouped by type
  const memoriesByType = useMemo(() => {
    if (!memories) return {};
    
    return memories.reduce((acc, memory) => {
      const type = memory.memory_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(memory);
      return acc;
    }, {} as Record<MemoryType, CompanionMemory[]>);
  }, [memories]);

  // Get special memories (evolutions, milestones, etc.)
  const specialMemories = useMemo(() => {
    if (!memories) return [];
    
    return memories.filter(m => 
      ['first_meeting', 'first_evolution', 'evolution', 'bond_milestone', 'recovery'].includes(m.memory_type)
    );
  }, [memories]);

  return {
    memories: memories || [],
    memoriesByType,
    specialMemories,
    isLoading: memoriesLoading || bondLoading,
    
    // Bond info
    currentBond,
    bondMilestones,
    
    // Actions
    createMemory,
    referenceMemory,
    getRandomMemory,
    getMemoryDialogue,
  };
}
