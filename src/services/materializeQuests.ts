import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { shiftCommitmentDate } from '../../supabase/functions/_shared/commitmentSchedule';
export async function materializeQuests(from:string,through=from) {
 const {error}=await (supabase as SupabaseClient).rpc('cosmiq_materialize_quests',{
  p_from:shiftCommitmentDate(from,-1),p_through:shiftCommitmentDate(through,1),
 }).abortSignal(AbortSignal.timeout(15000));
 if(error)throw error;
}
