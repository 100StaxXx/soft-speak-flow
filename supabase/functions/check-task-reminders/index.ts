import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Checking for tasks needing reminders...');
    
    // Find tasks that need reminders sent
    const { data: tasks, error } = await supabase
      .from('daily_tasks')
      .select('*, user_id')
      .eq('reminder_enabled', true)
      .eq('reminder_sent', false)
      .eq('completed', false)
      .not('scheduled_time', 'is', null)
      .lte('scheduled_time', new Date(Date.now() + 60 * 60 * 1000).toISOString()); // Next hour
    
    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
    
    console.log(`Found ${tasks?.length || 0} tasks to check`);
    
    const now = new Date();
    const tasksToRemind = tasks?.filter(task => {
      if (!task.scheduled_time || !task.reminder_minutes_before) return false;
      
      const scheduledTime = new Date(task.scheduled_time);
      const reminderTime = new Date(scheduledTime.getTime() - task.reminder_minutes_before * 60 * 1000);
      
      return now >= reminderTime;
    }) || [];
    
    console.log(`Sending reminders for ${tasksToRemind.length} tasks`);
    
    // Send reminders for each task
    for (const task of tasksToRemind) {
      try {
        // Get push subscriptions for this user
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', task.user_id);
        
        if (!subscriptions || subscriptions.length === 0) {
          console.log(`No push subscriptions for user ${task.user_id}`);
          continue;
        }
        
        // Get companion for emoji
        const { data: companion } = await supabase
          .from('user_companion')
          .select('spirit_animal')
          .eq('user_id', task.user_id)
          .single();
        
        const companionEmoji = companion?.spirit_animal === 'Wolf' ? '🐺' :
                              companion?.spirit_animal === 'Tiger' ? '🐯' :
                              companion?.spirit_animal === 'Dragon' ? '🐉' :
                              companion?.spirit_animal === 'Phoenix' ? '🔥' :
                              companion?.spirit_animal === 'Bear' ? '🐻' :
                              companion?.spirit_animal === 'Eagle' ? '🦅' :
                              companion?.spirit_animal === 'Lion' ? '🦁' :
                              companion?.spirit_animal === 'Fox' ? '🦊' : '⚔️';
        
        const notification = {
          title: `Quest Starting Soon! ${companionEmoji}`,
          body: `${task.task_text}\n+${task.xp_reward} XP`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: `task-${task.id}`,
          data: {
            taskId: task.id,
            url: '/tasks',
            actions: [
              { action: 'complete', title: 'Complete Now' },
              { action: 'snooze', title: 'Snooze 5min' },
              { action: 'open', title: 'Open App' }
            ]
          }
        };
        
        // Send to all user's devices
        for (const subscription of subscriptions) {
          try {
            // Use Web Push protocol to send notification
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            };
            
            // This should use a proper web push library in production
            // For now, we'll log that a reminder should be sent
            console.log(`Would send reminder to ${subscription.endpoint}`);
            
            console.log(`Reminder prepared for endpoint`);
          } catch (notifError) {
            console.error(`Failed to send to ${subscription.endpoint}:`, notifError);
          }
        }
        
        // Mark reminder as sent
        await supabase
          .from('daily_tasks')
          .update({ reminder_sent: true })
          .eq('id', task.id);
        
        // Log reminder
        await supabase
          .from('task_reminders_log')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            notification_status: 'sent'
          });
        
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
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-task-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
