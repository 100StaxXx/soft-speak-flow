import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscordEventPayload {
  epicId: string;
  eventType: 'member_joined' | 'milestone_reached' | 'epic_completed' | 'daily_update';
  data: {
    epicTitle?: string;
    userName?: string;
    memberCount?: number;
    progressPercentage?: number;
    milestone?: string;
    topContributors?: Array<{ name: string; contribution: number }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');

    if (!webhookUrl) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Discord webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload: DiscordEventPayload = await req.json();

    console.log('Processing Discord event:', payload.eventType);

    // Build Discord message based on event type
    let discordMessage = '';
    
    switch (payload.eventType) {
      case 'member_joined':
        discordMessage = `🎉 **${payload.data.userName}** just joined the epic: **${payload.data.epicTitle}**!\n` +
          `Total members: ${payload.data.memberCount} 💪`;
        break;

      case 'milestone_reached':
        discordMessage = `🏆 **Milestone Alert!** Epic **${payload.data.epicTitle}** reached ${payload.data.progressPercentage}% completion!\n` +
          `Milestone: ${payload.data.milestone} ✨`;
        break;

      case 'epic_completed':
        discordMessage = `🎊 **EPIC COMPLETED!** 🎊\n` +
          `**${payload.data.epicTitle}** has been conquered!\n\n` +
          `🌟 **Top Contributors:**\n` +
          (payload.data.topContributors || [])
            .map((c, i) => `${i + 1}. ${c.name} - ${c.contribution} habits completed`)
            .join('\n');
        break;

      case 'daily_update':
        discordMessage = `📊 **Daily Progress Update** for **${payload.data.epicTitle}**\n` +
          `Progress: ${payload.data.progressPercentage}% complete 📈\n` +
          `Keep crushing it! 💪`;
        break;

      default:
        discordMessage = `📢 Update from **${payload.data.epicTitle}**`;
    }

    // Post to Discord
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: discordMessage,
        username: 'Cosmiq Bot',
        avatar_url: 'https://tffrgsaawvletgiztfry.supabase.co/storage/v1/object/public/mentors-avatars/revolution-bot.png',
      }),
    });

    const responseText = await discordResponse.text();
    console.log('Discord response:', discordResponse.status, responseText);

    // Log the event
    await supabase.from('epic_discord_events').insert({
      epic_id: payload.epicId,
      event_type: payload.eventType,
      event_data: payload.data,
      webhook_response: `${discordResponse.status}: ${responseText}`,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Discord notification sent',
        status: discordResponse.status 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error posting to Discord:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
