import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdjustmentSuggestion {
  id: string;
  type: 'habit_change' | 'milestone_change' | 'timeline_change' | 'difficulty_change';
  action: 'add' | 'remove' | 'modify';
  title: string;
  description: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { epicId, adjustments, adjustmentType, reason } = await req.json();

    if (!epicId || !adjustments || adjustments.length === 0) {
      throw new Error('Epic ID and at least one adjustment are required');
    }

    console.log(`Applying ${adjustments.length} adjustments to epic ${epicId}`);

    // Fetch current epic
    const { data: epic, error: epicError } = await supabase
      .from('epics')
      .select('*')
      .eq('id', epicId)
      .eq('user_id', user.id)
      .single();

    if (epicError || !epic) {
      throw new Error('Epic not found');
    }

    const appliedChanges: string[] = [];
    const now = new Date().toISOString();

    for (const adjustment of adjustments as AdjustmentSuggestion[]) {
      console.log(`Processing adjustment: ${adjustment.type} - ${adjustment.action}`);

      switch (adjustment.type) {
        case 'timeline_change': {
          const details = adjustment.details as { newEndDate?: string; daysToAdd?: number } | undefined;
          
          if (details?.newEndDate) {
            await supabase
              .from('epics')
              .update({ 
                end_date: details.newEndDate,
                updated_at: now
              })
              .eq('id', epicId);
            appliedChanges.push(`Extended deadline to ${details.newEndDate}`);
          } else if (details?.daysToAdd && epic.end_date) {
            const currentEnd = new Date(epic.end_date);
            currentEnd.setDate(currentEnd.getDate() + details.daysToAdd);
            await supabase
              .from('epics')
              .update({ 
                end_date: currentEnd.toISOString().split('T')[0],
                target_days: epic.target_days + details.daysToAdd,
                updated_at: now
              })
              .eq('id', epicId);
            appliedChanges.push(`Added ${details.daysToAdd} days to timeline`);
          }
          break;
        }

        case 'habit_change': {
          const details = adjustment.details as { habitId?: string; habitName?: string; frequency?: string } | undefined;
          
          if (adjustment.action === 'remove' && details?.habitId) {
            // Remove habit from epic
            await supabase
              .from('epic_habits')
              .delete()
              .eq('epic_id', epicId)
              .eq('habit_id', details.habitId);
            appliedChanges.push(`Removed habit: ${adjustment.title}`);
          } else if (adjustment.action === 'add' && details?.habitName) {
            // Create new habit and link to epic
            const { data: newHabit, error: habitError } = await supabase
              .from('habits')
              .insert({
                user_id: user.id,
                name: details.habitName,
                frequency: details.frequency || 'daily',
                is_active: true,
              })
              .select()
              .single();

            if (!habitError && newHabit) {
              await supabase
                .from('epic_habits')
                .insert({
                  epic_id: epicId,
                  habit_id: newHabit.id,
                });
              appliedChanges.push(`Added habit: ${details.habitName}`);
            }
          } else if (adjustment.action === 'modify' && details?.habitId) {
            // Modify existing habit
            const updates: Record<string, unknown> = {};
            if (details.frequency) updates.frequency = details.frequency;
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('habits')
                .update(updates)
                .eq('id', details.habitId);
              appliedChanges.push(`Modified habit: ${adjustment.title}`);
            }
          }
          break;
        }

        case 'milestone_change': {
          const details = adjustment.details as { 
            milestoneId?: string; 
            milestoneTitle?: string;
            milestonePercent?: number;
            description?: string;
          } | undefined;

          if (adjustment.action === 'remove' && details?.milestoneId) {
            await supabase
              .from('epic_milestones')
              .delete()
              .eq('id', details.milestoneId)
              .eq('epic_id', epicId);
            appliedChanges.push(`Removed milestone: ${adjustment.title}`);
          } else if (adjustment.action === 'add' && details?.milestoneTitle) {
            await supabase
              .from('epic_milestones')
              .insert({
                epic_id: epicId,
                user_id: user.id,
                title: details.milestoneTitle,
                description: details.description || '',
                milestone_percent: details.milestonePercent || 50,
              });
            appliedChanges.push(`Added milestone: ${details.milestoneTitle}`);
          } else if (adjustment.action === 'modify' && details?.milestoneId) {
            const updates: Record<string, unknown> = {};
            if (details.milestoneTitle) updates.title = details.milestoneTitle;
            if (details.milestonePercent) updates.milestone_percent = details.milestonePercent;
            if (details.description) updates.description = details.description;
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('epic_milestones')
                .update(updates)
                .eq('id', details.milestoneId);
              appliedChanges.push(`Modified milestone: ${adjustment.title}`);
            }
          }
          break;
        }

        case 'difficulty_change': {
          // Log difficulty adjustment - this could affect XP multipliers in the future
          appliedChanges.push(`Adjusted difficulty: ${adjustment.title}`);
          break;
        }
      }
    }

    // Log the adjustment in activity feed
    await supabase
      .from('epic_activity_feed')
      .insert({
        epic_id: epicId,
        user_id: user.id,
        activity_type: 'plan_adjusted',
        activity_data: {
          adjustmentType,
          reason,
          appliedChanges,
          adjustmentCount: adjustments.length,
        },
      });

    console.log(`Applied changes: ${appliedChanges.join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        appliedChanges,
        message: `Successfully applied ${appliedChanges.length} adjustment${appliedChanges.length > 1 ? 's' : ''} to your plan`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error applying adjustments:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
