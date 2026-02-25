import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[check-contact-reminders] Starting reminder check...');

    // Get pending reminders that are due
    const now = new Date().toISOString();
    const { data: dueReminders, error: fetchError } = await supabase
      .from('contact_reminders')
      .select(`
        id,
        user_id,
        reason,
        reminder_at,
        contacts:contact_id (
          id,
          name
        )
      `)
      .eq('sent', false)
      .lte('reminder_at', now);

    if (fetchError) {
      console.error('[check-contact-reminders] Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log('[check-contact-reminders] No due reminders found');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[check-contact-reminders] Found ${dueReminders.length} due reminders`);

    let processedCount = 0;

    for (const reminder of dueReminders) {
      try {
        const contactData = reminder.contacts as unknown;
        const contact = contactData as { id: string; name: string } | null;
        if (!contact) {
          console.warn(`[check-contact-reminders] No contact found for reminder ${reminder.id}`);
          continue;
        }

        // Get user's device tokens
        const { data: deviceTokens, error: tokenError } = await supabase
          .from('push_device_tokens')
          .select('device_token, platform')
          .eq('user_id', reminder.user_id);

        if (tokenError) {
          console.error(`[check-contact-reminders] Error fetching device tokens for user ${reminder.user_id}:`, tokenError);
          continue;
        }

        // Send notification to each device
        const iosTokens = deviceTokens?.filter(t => t.platform === 'ios') ?? [];
        
        for (const token of iosTokens) {
          try {
            const notificationPayload = {
              deviceToken: token.device_token,
              title: "Time to Reach Out! 🗣️",
              body: reminder.reason 
                ? `Connect with ${contact.name}: ${reminder.reason}`
                : `It's time to connect with ${contact.name}`,
              data: {
                type: 'contact_reminder',
                contactId: contact.id,
                reminderId: reminder.id,
                url: '/contacts',
              },
            };

            console.log(`[check-contact-reminders] Sending notification for reminder ${reminder.id} to device`);

            const response = await supabase.functions.invoke('send-apns-notification', {
              body: notificationPayload,
              headers: internalSecret ? {
                'x-internal-key': internalSecret,
              } : undefined,
            });

            if (response.error) {
              console.error(`[check-contact-reminders] Error sending notification:`, response.error);
            } else {
              console.log(`[check-contact-reminders] Notification sent successfully`);
            }
          } catch (notifError) {
            console.error(`[check-contact-reminders] Error sending to device:`, notifError);
          }
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('contact_reminders')
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`[check-contact-reminders] Error marking reminder ${reminder.id} as sent:`, updateError);
        } else {
          processedCount++;
          console.log(`[check-contact-reminders] Reminder ${reminder.id} marked as sent`);
        }
      } catch (reminderError) {
        console.error(`[check-contact-reminders] Error processing reminder ${reminder.id}:`, reminderError);
      }
    }

    console.log(`[check-contact-reminders] Processed ${processedCount} reminders`);

    return new Response(JSON.stringify({ processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[check-contact-reminders] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
