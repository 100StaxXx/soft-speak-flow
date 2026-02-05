 /**
  * useReactionBudget - Track per-core and daily reaction limits
  * Handles budget checking and incrementing with upsert logic
  */
 
 import { useCallback } from "react";
 import { useAuth } from "@/hooks/useAuth";
 import { supabase } from "@/integrations/supabase/client";
 import { SOURCE_LIMITS, DAILY_LIMIT, SOURCE_FIELD_MAP, type SourceSystem } from "@/config/reactionPools";
 
 interface BudgetStatus {
   canShow: boolean;
   sourceCount: number;
   totalCount: number;
   sourceLimit: number;
 }
 
 export const useReactionBudget = () => {
   const { user } = useAuth();
 
   // Get today's date in YYYY-MM-DD format
   const getToday = useCallback((): string => {
     return new Date().toISOString().split('T')[0];
   }, []);
 
   // Check if we can show a reaction for this source
   const checkBudget = useCallback(async (source: SourceSystem): Promise<BudgetStatus> => {
     if (!user?.id) {
       return { canShow: false, sourceCount: 0, totalCount: 0, sourceLimit: SOURCE_LIMITS[source] };
     }
 
     const today = getToday();
     const sourceField = SOURCE_FIELD_MAP[source];
     const sourceLimit = SOURCE_LIMITS[source];
 
     // Fetch today's budget
     const { data, error } = await supabase
       .from('user_reaction_budget')
       .select('*')
       .eq('user_id', user.id)
       .eq('budget_date', today)
       .maybeSingle();
 
     if (error) {
       console.error('Failed to check reaction budget:', error);
       return { canShow: false, sourceCount: 0, totalCount: 0, sourceLimit };
     }
 
     // No record yet = all budgets available
     if (!data) {
       return { canShow: true, sourceCount: 0, totalCount: 0, sourceLimit };
     }
 
     const sourceCount = (data as any)[sourceField] || 0;
     const totalCount = data.total_count || 0;
 
     // Check both per-source and global limits
     const canShow = sourceCount < sourceLimit && totalCount < DAILY_LIMIT;
 
     return { canShow, sourceCount, totalCount, sourceLimit };
   }, [user?.id, getToday]);
 
   // Increment the budget for a source (call after showing a reaction)
   const incrementBudget = useCallback(async (source: SourceSystem): Promise<boolean> => {
     if (!user?.id) return false;
 
     const today = getToday();
     const sourceField = SOURCE_FIELD_MAP[source];
 
     // First, try to get existing record
     const { data: existing } = await supabase
       .from('user_reaction_budget')
       .select('*')
       .eq('user_id', user.id)
       .eq('budget_date', today)
       .maybeSingle();
 
     if (existing) {
       // Update existing record
       const currentSourceCount = (existing as any)[sourceField] || 0;
       const currentTotal = existing.total_count || 0;
 
       const { error } = await supabase
         .from('user_reaction_budget')
         .update({
           [sourceField]: currentSourceCount + 1,
           total_count: currentTotal + 1,
           updated_at: new Date().toISOString(),
         })
         .eq('id', existing.id);
 
       if (error) {
         console.error('Failed to update reaction budget:', error);
         return false;
       }
     } else {
       // Insert new record
       const { error } = await supabase
         .from('user_reaction_budget')
         .insert({
           user_id: user.id,
           budget_date: today,
           [sourceField]: 1,
           total_count: 1,
           updated_at: new Date().toISOString(),
         });
 
       if (error) {
         console.error('Failed to insert reaction budget:', error);
         return false;
       }
     }
 
     return true;
   }, [user?.id, getToday]);
 
   // Get full budget status for debugging/UI
   const getBudgetStatus = useCallback(async () => {
     if (!user?.id) return null;
 
     const today = getToday();
     const { data } = await supabase
       .from('user_reaction_budget')
       .select('*')
       .eq('user_id', user.id)
       .eq('budget_date', today)
       .maybeSingle();
 
     return data;
   }, [user?.id, getToday]);
 
   return {
     checkBudget,
     incrementBudget,
     getBudgetStatus,
   };
 };