import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {SupabaseClient} from '@supabase/supabase-js';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {defaultPlannerPreferences,learnPlannerPatterns,type PlannerPreferences,type PlannerEvent} from '../../../supabase/functions/_shared/plannerLearning';
const db=supabase as SupabaseClient;
export function usePlannerPreferences(){
 const {user}=useAuth(),client=useQueryClient(),key=['planner-preferences',user?.id];
 const query=useQuery({queryKey:key,enabled:!!user,queryFn:async()=>{const {data,error}=await db.from('cosmiq_planner_preferences').select('*').eq('user_id',user!.id).maybeSingle();if(error)throw error;return (data||defaultPlannerPreferences()) as PlannerPreferences;}});
 const events=useQuery({queryKey:['planner-events',user?.id],enabled:!!user&&!!query.data?.learning_enabled,queryFn:async()=>{const {data,error}=await db.from('cosmiq_planner_events').select('*').eq('user_id',user!.id).gte('created_at',query.data!.learning_since).order('created_at',{ascending:false}).limit(500);if(error)throw error;return data as PlannerEvent[];}});
 const save=useMutation({mutationFn:async(patch:Partial<PlannerPreferences>)=>{if(!user)throw Error('Sign in to save your preferences.');const {data,error}=await db.from('cosmiq_planner_preferences').upsert({user_id:user.id,...patch},{onConflict:'user_id'}).select('*').single();if(error)throw Error('Your preferences could not be saved. Please try again.');return data as PlannerPreferences;},onSuccess:data=>{client.setQueryData(key,data);void client.invalidateQueries({queryKey:['planner-events',user?.id]});}});
 const record=async(event:Omit<PlannerEvent,'created_at'>)=>{if(!user||!query.data?.learning_enabled)return;const {error}=await db.from('cosmiq_planner_events').insert({...event,user_id:user.id});if(error&&error.code!=='23505')throw Error('Your feedback could not be saved.');void client.invalidateQueries({queryKey:['planner-events',user.id]});};
 const reset=async()=>{if(!user)return;await save.mutateAsync({learning_since:new Date().toISOString(),forgotten_patterns:[]});const {error}=await db.from('cosmiq_planner_events').delete().eq('user_id',user.id);if(error)throw Error('Patterns were reset, but past feedback could not be deleted. Try again.');void client.invalidateQueries({queryKey:['planner-events',user.id]});};
 return {...query,preferences:query.data,save:save.mutateAsync,isSaving:save.isPending,record,reset,patterns:query.data?learnPlannerPatterns(query.data,events.data||[]):[],eventsError:events.error};
}
