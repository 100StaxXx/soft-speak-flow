import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');

if (!internalSecret) {
  throw new Error('INTERNAL_FUNCTION_SECRET is not configured');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Checking for tasks needing reminders...');
    
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    
    const { data: tasks, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('reminder_enabled', true)
      .eq('reminder_sent', false)
      .eq('completed', false)
      .eq('task_date', today)
      .not('scheduled_time', 'is', null);
    
    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
    
    console.log(`Found ${tasks?.length || 0} tasks to check`);
    
    const tasksToRemind = tasks?.filter(task => {
      if (!task.scheduled_time || !task.reminder_minutes_before) return false;
      
      // Parse the time properly - scheduled_time is stored as TIME (HH:MM:SS) in UTC
      // Append 'Z' to ensure JavaScript treats it as UTC
      const timeStr = task.scheduled_time.split('.')[0]; // Remove microseconds if present
      const scheduledDateTime = new Date(`${task.task_date}T${timeStr}Z`);
      const reminderTime = new Date(scheduledDateTime.getTime() - task.reminder_minutes_before * 60 * 1000);
      
      const timeDiff = reminderTime.getTime() - now.getTime();
      
      console.log(`Task ${task.id}: scheduled=${scheduledDateTime.toISOString()}, reminder=${reminderTime.toISOString()}, now=${now.toISOString()}, diff=${timeDiff}ms`);
      
      // Widen the window to 60 seconds to account for cron timing
      return timeDiff >= -60000 && timeDiff <= 60000;
    }) || [];
    
    console.log(`Sending reminders for ${tasksToRemind.length} tasks`);
    
    for (const task of tasksToRemind) {
      try {
        // Check if user has global task reminders disabled
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('task_reminders_enabled')
          .eq('id', task.user_id)
          .maybeSingle();

        if (userProfile?.task_reminders_enabled === false) {
          console.log(`Task reminders disabled for user ${task.user_id}`);
          continue;
        }

        const { data: deviceTokens } = await supabase
          .from('push_device_tokens')
          .select('device_token')
          .eq('user_id', task.user_id)
          .eq('platform', 'ios');
        
        if (!deviceTokens || deviceTokens.length === 0) {
          console.log(`No iOS device tokens for user ${task.user_id}`);
          continue;
        }
        
        const { data: companion } = await supabase
          .from('user_companion')
          .select('spirit_animal')
          .eq('user_id', task.user_id)
          .maybeSingle();
        
        const companionEmoji = companion?.spirit_animal === 'Wolf' ? '🐺' :
                              companion?.spirit_animal === 'Tiger' ? '🐯' :
                              companion?.spirit_animal === 'Dragon' ? '🐉' :
                              companion?.spirit_animal === 'Phoenix' ? '🔥' :
                              companion?.spirit_animal === 'Bear' ? '🐻' :
                              companion?.spirit_animal === 'Eagle' ? '🦅' :
                              companion?.spirit_animal === 'Lion' ? '🦁' :
                              companion?.spirit_animal === 'Fox' ? '🦊' : '⚔️';
        
        for (const token of deviceTokens) {
          try {
            const { error: sendError } = await supabase.functions.invoke('send-apns-notification', {
              body: {
                deviceToken: token.device_token,
                title: `Quest Starting Soon! ${companionEmoji}`,
                body: `${task.task_text} (+${task.xp_reward} XP)`,
                data: {
                  taskId: task.id,
                  type: 'task_reminder',
                  url: '/tasks'
                }
              },
              headers: {
                'x-internal-key': internalSecret,
              }
            });

            if (sendError) {
              console.error(`Failed to send to device ${token.device_token}:`, sendError);
            } else {
              console.log(`Sent reminder to device for task ${task.id}`);
            }
          } catch (deviceError) {
            console.error(`Error sending to device:`, deviceError);
          }
        }
        
        await supabase
          .from('daily_tasks')
          .update({ reminder_sent: true })
          .eq('id', task.id);
        
        console.log(`Reminder sent for task ${task.id}`);
      } catch (taskError) {
        console.error(`Error processing task ${task.id}:`, taskError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: tasks?.length || 0,
        reminded: tasksToRemind.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-task-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
