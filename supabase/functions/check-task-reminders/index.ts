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
    
    // Query 1: Tasks needing "at time of event" notification
    const { data: startTimeTasks, error: startTimeError } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('start_notification_sent', false)
      .eq('completed', false)
      .eq('task_date', today)
      .not('scheduled_time', 'is', null);
    
    if (startTimeError) {
      console.error('Error fetching start time tasks:', startTimeError);
      throw startTimeError;
    }
    
    // Query 2: Tasks needing early reminder notification
    const { data: reminderTasks, error: reminderError } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('reminder_enabled', true)
      .eq('reminder_sent', false)
      .eq('completed', false)
      .eq('task_date', today)
      .not('scheduled_time', 'is', null);
    
    if (reminderError) {
      console.error('Error fetching reminder tasks:', reminderError);
      throw reminderError;
    }
    
    console.log(`Found ${startTimeTasks?.length || 0} tasks for start notifications, ${reminderTasks?.length || 0} tasks for early reminders`);
    
    // Filter tasks where scheduled_time is NOW (within 60 second window)
    const tasksToNotifyAtStart = startTimeTasks?.filter(task => {
      if (!task.scheduled_time) return false;
      
      const timeStr = task.scheduled_time.split('.')[0];
      const scheduledDateTime = new Date(`${task.task_date}T${timeStr}Z`);
      const timeDiff = scheduledDateTime.getTime() - now.getTime();
      
      console.log(`Start notification check - Task ${task.id}: scheduled=${scheduledDateTime.toISOString()}, now=${now.toISOString()}, diff=${timeDiff}ms`);
      
      // Notify if we're within 60 seconds of the start time
      return timeDiff >= -60000 && timeDiff <= 60000;
    }) || [];
    
    // Filter tasks where reminder time is NOW (within 60 second window)
    const tasksToRemindEarly = reminderTasks?.filter(task => {
      if (!task.scheduled_time || !task.reminder_minutes_before) return false;
      
      const timeStr = task.scheduled_time.split('.')[0];
      const scheduledDateTime = new Date(`${task.task_date}T${timeStr}Z`);
      const reminderTime = new Date(scheduledDateTime.getTime() - task.reminder_minutes_before * 60 * 1000);
      const timeDiff = reminderTime.getTime() - now.getTime();
      
      console.log(`Early reminder check - Task ${task.id}: scheduled=${scheduledDateTime.toISOString()}, reminder=${reminderTime.toISOString()}, now=${now.toISOString()}, diff=${timeDiff}ms`);
      
      return timeDiff >= -60000 && timeDiff <= 60000;
    }) || [];
    
    console.log(`Sending ${tasksToNotifyAtStart.length} start notifications, ${tasksToRemindEarly.length} early reminders`);
    
    // Helper function to get companion emoji
    const getCompanionEmoji = async (userId: string) => {
      const { data: companion } = await supabase
        .from('user_companion')
        .select('spirit_animal')
        .eq('user_id', userId)
        .maybeSingle();
      
      return companion?.spirit_animal === 'Wolf' ? '🐺' :
             companion?.spirit_animal === 'Tiger' ? '🐯' :
             companion?.spirit_animal === 'Dragon' ? '🐉' :
             companion?.spirit_animal === 'Phoenix' ? '🔥' :
             companion?.spirit_animal === 'Bear' ? '🐻' :
             companion?.spirit_animal === 'Eagle' ? '🦅' :
             companion?.spirit_animal === 'Lion' ? '🦁' :
             companion?.spirit_animal === 'Fox' ? '🦊' : '⚔️';
    };
    
    // Helper function to send notification
    const sendNotification = async (
      task: any, 
      title: string, 
      body: string, 
      notificationType: 'start' | 'reminder'
    ) => {
      // Check if user has global task reminders disabled
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('task_reminders_enabled')
        .eq('id', task.user_id)
        .maybeSingle();

      if (userProfile?.task_reminders_enabled === false) {
        console.log(`Task reminders disabled for user ${task.user_id}`);
        return false;
      }

      const { data: deviceTokens } = await supabase
        .from('push_device_tokens')
        .select('device_token')
        .eq('user_id', task.user_id)
        .eq('platform', 'ios');
      
      if (!deviceTokens || deviceTokens.length === 0) {
        console.log(`No iOS device tokens for user ${task.user_id}`);
        return false;
      }
      
      for (const token of deviceTokens) {
        try {
          const { error: sendError } = await supabase.functions.invoke('send-apns-notification', {
            body: {
              deviceToken: token.device_token,
              title,
              body,
              data: {
                taskId: task.id,
                type: notificationType === 'start' ? 'task_start' : 'task_reminder',
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
            console.log(`Sent ${notificationType} notification to device for task ${task.id}`);
          }
        } catch (deviceError) {
          console.error(`Error sending to device:`, deviceError);
        }
      }
      
      return true;
    };
    
    // Send "at time of event" notifications
    for (const task of tasksToNotifyAtStart) {
      try {
        const companionEmoji = await getCompanionEmoji(task.user_id);
        const sent = await sendNotification(
          task,
          `Quest Starting Now! ${companionEmoji}`,
          `Time for: ${task.task_text} (+${task.xp_reward} XP)`,
          'start'
        );
        
        if (sent) {
          await supabase
            .from('daily_tasks')
            .update({ start_notification_sent: true })
            .eq('id', task.id);
          
          console.log(`Start notification sent for task ${task.id}`);
        }
      } catch (taskError) {
        console.error(`Error processing start notification for task ${task.id}:`, taskError);
      }
    }
    
    // Send early reminder notifications
    for (const task of tasksToRemindEarly) {
      try {
        const companionEmoji = await getCompanionEmoji(task.user_id);
        const minutesBefore = task.reminder_minutes_before;
        
        // Format the time label
        let timeLabel = `${minutesBefore} minutes`;
        if (minutesBefore >= 10080) {
          timeLabel = `${Math.floor(minutesBefore / 10080)} week${minutesBefore >= 20160 ? 's' : ''}`;
        } else if (minutesBefore >= 1440) {
          timeLabel = `${Math.floor(minutesBefore / 1440)} day${minutesBefore >= 2880 ? 's' : ''}`;
        } else if (minutesBefore >= 60) {
          timeLabel = `${Math.floor(minutesBefore / 60)} hour${minutesBefore >= 120 ? 's' : ''}`;
        }
        
        const sent = await sendNotification(
          task,
          `Quest Starting Soon! ${companionEmoji}`,
          `${task.task_text} starts in ${timeLabel} (+${task.xp_reward} XP)`,
          'reminder'
        );
        
        if (sent) {
          await supabase
            .from('daily_tasks')
            .update({ reminder_sent: true })
            .eq('id', task.id);
          
          console.log(`Early reminder sent for task ${task.id}`);
        }
      } catch (taskError) {
        console.error(`Error processing early reminder for task ${task.id}:`, taskError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        startNotificationsSent: tasksToNotifyAtStart.length,
        earlyRemindersSent: tasksToRemindEarly.length
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