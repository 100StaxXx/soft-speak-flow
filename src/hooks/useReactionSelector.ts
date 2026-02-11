 /**
  * useReactionSelector - Select appropriate reaction based on context
  * Handles cooldowns, tone anti-repeat, rare pool, and random selection
  */
 
 import { useCallback } from "react";
 import { useAuth } from "@/hooks/useAuth";
 import { supabase } from "@/integrations/supabase/client";
 import { 
   type SourceSystem, 
   type MomentType, 
   type ContextTag,
   RARE_COOLDOWN_DAYS 
 } from "@/config/reactionPools";
 
 interface Reaction {
   id: string;
   text: string;
   tone_tag: string;
   context_tags: string[];
   cooldown_hours: number;
 }
 
 interface SelectionResult {
   reaction: Reaction | null;
   reason?: string;
 }
 
 export const useReactionSelector = () => {
   const { user } = useAuth();
 
   // Get the last shown tone tag for anti-repeat
   const getLastToneTag = useCallback(async (): Promise<string | null> => {
     if (!user?.id) return null;
 
     const { data } = await supabase
       .from('user_reaction_history')
       .select('tone_tag')
       .eq('user_id', user.id)
       .order('shown_at', { ascending: false })
       .limit(1)
       .maybeSingle();
 
     return data?.tone_tag || null;
   }, [user?.id]);
 
   // Check if user has seen a rare reaction in the last 7 days
   const hasRecentRare = useCallback(async (): Promise<boolean> => {
     if (!user?.id) return false;
 
     const sevenDaysAgo = new Date();
     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - RARE_COOLDOWN_DAYS);
 
     // Check history for rare reactions
     const { data: history } = await supabase
       .from('user_reaction_history')
       .select('reaction_id')
       .eq('user_id', user.id)
       .gte('shown_at', sevenDaysAgo.toISOString());
 
     if (!history || history.length === 0) return false;
 
     // Check if any of these reactions are rare
     const reactionIds = history.map(h => h.reaction_id).filter(Boolean);
     if (reactionIds.length === 0) return false;
 
     const { data: rareReactions } = await supabase
       .from('companion_reactions')
       .select('id')
       .in('id', reactionIds)
       .contains('context_tags', ['rare']);
 
     return (rareReactions?.length || 0) > 0;
   }, [user?.id]);
 
   // Get reactions shown within their cooldown period
   const getRecentReactionIds = useCallback(async (): Promise<Set<string>> => {
     if (!user?.id) return new Set();
 
     // Get history from last 7 days (max cooldown period)
     const sevenDaysAgo = new Date();
     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
 
     const { data: history } = await supabase
       .from('user_reaction_history')
       .select('reaction_id, shown_at')
       .eq('user_id', user.id)
       .gte('shown_at', sevenDaysAgo.toISOString());
 
     if (!history) return new Set();
 
     // Get all reactions to check their cooldowns
     const reactionIds = history.map(h => h.reaction_id).filter(Boolean) as string[];
     if (reactionIds.length === 0) return new Set();
 
     const { data: reactions } = await supabase
       .from('companion_reactions')
       .select('id, cooldown_hours')
       .in('id', reactionIds);
 
     if (!reactions) return new Set();
 
     // Build a map of reaction ID to cooldown hours
     const cooldownMap = new Map(reactions.map(r => [r.id, r.cooldown_hours]));
 
     // Filter history to only include reactions still within cooldown
     const now = Date.now();
     const recentIds = new Set<string>();
 
     for (const h of history) {
       if (!h.reaction_id) continue;
       const cooldownHours = cooldownMap.get(h.reaction_id) || 12;
       const shownAt = new Date(h.shown_at).getTime();
       const cooldownMs = cooldownHours * 60 * 60 * 1000;
 
       if (now - shownAt < cooldownMs) {
         recentIds.add(h.reaction_id);
       }
     }
 
     return recentIds;
   }, [user?.id]);
 
   // Select a reaction based on source, moment type, and context
   const selectReaction = useCallback(async (
     source: SourceSystem,
     momentType: MomentType,
     contextTags: ContextTag[] = []
   ): Promise<SelectionResult> => {
     if (!user?.id) {
       return { reaction: null, reason: 'No user' };
     }
 
     // 1. Get all active reactions for this source
    const query = supabase
      .from('companion_reactions')
      .select('id, text, tone_tag, context_tags, cooldown_hours')
      .eq('is_active', true)
      .contains('source_systems', [source]);
 
     const { data: allReactions, error } = await query;
 
     if (error || !allReactions || allReactions.length === 0) {
       return { reaction: null, reason: 'No reactions available' };
     }
 
     // 2. Filter by moment type (reactions with empty moment_types match any)
     let filtered = allReactions;
 
     // Re-query with moment type filter
     const { data: momentFiltered } = await supabase
       .from('companion_reactions')
       .select('id, text, tone_tag, context_tags, cooldown_hours')
       .eq('is_active', true)
       .contains('source_systems', [source])
       .or(`moment_types.cs.{${momentType}},moment_types.eq.{}`);
 
     if (momentFiltered && momentFiltered.length > 0) {
       filtered = momentFiltered;
     }
 
     // 3. Exclude reactions still within cooldown
     const recentIds = await getRecentReactionIds();
     filtered = filtered.filter(r => !recentIds.has(r.id));
 
     if (filtered.length === 0) {
       return { reaction: null, reason: 'All reactions on cooldown' };
     }
 
     // 4. Handle rare pool
     const hasSeenRareRecently = await hasRecentRare();
     if (hasSeenRareRecently) {
       // Exclude rare reactions
       filtered = filtered.filter(r => !r.context_tags?.includes('rare'));
     }
 
     if (filtered.length === 0) {
       return { reaction: null, reason: 'No non-rare reactions available' };
     }
 
     // 5. Anti-repeat: exclude last tone tag (if pool would not be empty)
     const lastTone = await getLastToneTag();
     if (lastTone) {
       const withoutLastTone = filtered.filter(r => r.tone_tag !== lastTone);
       if (withoutLastTone.length > 0) {
         filtered = withoutLastTone;
       }
       // If empty, keep all (allow repeat as fallback)
     }
 
     // 6. Prefer reactions matching context tags (if any)
     if (contextTags.length > 0) {
       const withContext = filtered.filter(r => 
         contextTags.some(tag => r.context_tags?.includes(tag))
       );
       if (withContext.length > 0) {
         filtered = withContext;
       }
       // If no matches, use untagged reactions
     }
 
     // 7. Random selection
     const selected = filtered[Math.floor(Math.random() * filtered.length)];
 
     return { reaction: selected };
   }, [user?.id, getRecentReactionIds, hasRecentRare, getLastToneTag]);
 
   // Record a shown reaction to history
   const recordReaction = useCallback(async (
     reaction: Reaction,
     source: SourceSystem,
     momentType: MomentType
   ): Promise<void> => {
     if (!user?.id) return;
 
     await supabase
       .from('user_reaction_history')
       .insert({
         user_id: user.id,
         reaction_id: reaction.id,
         source_system: source,
         moment_type: momentType,
         reaction_text_snapshot: reaction.text,
         tone_tag: reaction.tone_tag,
       });
   }, [user?.id]);
 
   return {
     selectReaction,
     recordReaction,
   };
 };
