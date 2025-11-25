import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendToMultipleSubscriptions, PushSubscription, PushNotificationPayload } from "../_shared/webPush.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Load VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@revolution.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'Push notification system not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Checking for tasks needing reminders...');
    
    // Get current date and time for comparison
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    
    // Find tasks that need reminders sent
    // We need to find tasks where scheduled_time today is coming up
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
      
      // Combine task_date and scheduled_time to get full datetime
      const scheduledDateTime = new Date(`${task.task_date}T${task.scheduled_time}`);
      const reminderTime = new Date(scheduledDateTime.getTime() - task.reminder_minutes_before * 60 * 1000);
      
      // Check if it's time to send reminder (within 1 minute window)
      const timeDiff = reminderTime.getTime() - now.getTime();
      return timeDiff >= -30000 && timeDiff <= 30000; // 30 second window on either side
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
          .maybeSingle();
        
        const companionEmoji = companion?.spirit_animal === 'Wolf' ? '🐺' :
                              companion?.spirit_animal === 'Tiger' ? '🐯' :
                              companion?.spirit_animal === 'Dragon' ? '🐉' :
                              companion?.spirit_animal === 'Phoenix' ? '🔥' :
                              companion?.spirit_animal === 'Bear' ? '🐻' :
                              companion?.spirit_animal === 'Eagle' ? '🦅' :
                              companion?.spirit_animal === 'Lion' ? '🦁' :
                              companion?.spirit_animal === 'Fox' ? '🦊' : '⚔️';
        
        const payload: PushNotificationPayload = {
          title: `Quest Starting Soon! ${companionEmoji}`,
          body: `${task.task_text} (+${task.xp_reward} XP)`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `task-${task.id}`,
          data: {
            taskId: task.id,
            type: 'task_reminder',
            url: '/tasks'
          },
          actions: [
            { action: 'open', title: 'View Task' },
            { action: 'snooze', title: 'Snooze 5min' }
          ]
        };
        
        // Send to all user's devices
        const pushSubscriptions: PushSubscription[] = subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        }));

        const results = await sendToMultipleSubscriptions(
          pushSubscriptions,
          payload,
          {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: vapidSubject
          }
        );

        // Remove expired subscriptions
        const expiredSubs = results
          .filter(r => r.result.error === 'SUBSCRIPTION_EXPIRED')
          .map(r => r.subscription.endpoint);

        if (expiredSubs.length > 0) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .in('endpoint', expiredSubs);
        }

        const successCount = results.filter(r => r.result.success).length;
        console.log(`Sent reminder to ${successCount}/${results.length} devices for task ${task.id}`);
        
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
