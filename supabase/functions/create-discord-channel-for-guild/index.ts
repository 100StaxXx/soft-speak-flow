import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateChannelRequest {
  epicId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const discordBotToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const discordGuildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!discordBotToken || !discordGuildId) {
      console.error('Missing Discord configuration');
      return new Response(
        JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get JWT from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { epicId }: CreateChannelRequest = await req.json();

    // Fetch epic and verify ownership
    const { data: epic, error: epicError } = await supabase
      .from('epics')
      .select('id, title, invite_code, user_id, discord_channel_id, discord_invite_url, discord_ready')
      .eq('id', epicId)
      .single();

    if (epicError || !epic) {
      console.error('Epic not found:', epicError);
      return new Response(
        JSON.stringify({ error: 'Epic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is the epic owner
    if (epic.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the epic owner can create a Discord channel' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already created
    if (epic.discord_channel_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Discord channel already exists for this epic',
          channelId: epic.discord_channel_id,
          inviteUrl: epic.discord_invite_url
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if eligible (discord_ready means 3+ members)
    if (!epic.discord_ready) {
      return new Response(
        JSON.stringify({ error: 'Epic needs 3+ members to unlock Discord channel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create channel name: use invite code for uniqueness
    const channelName = `guild-${epic.invite_code.toLowerCase().replace('EPIC-', '')}`;

    console.log(`Creating Discord channel: ${channelName}`);

    // Step 1: Create Discord channel
    const createChannelResponse = await fetch(
      `https://discord.com/api/v10/guilds/${discordGuildId}/channels`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: channelName,
          type: 0, // Text channel
          topic: `🎯 Guild channel for epic: ${epic.title} | Code: ${epic.invite_code}`,
          // Uncomment below if you want channels in a category
          // parent_id: 'YOUR_CATEGORY_ID',
        }),
      }
    );

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text();
      console.error('Discord API error:', createChannelResponse.status, errorText);
      throw new Error(`Failed to create Discord channel: ${createChannelResponse.status} - ${errorText}`);
    }

    const channel = await createChannelResponse.json();
    console.log('Channel created successfully:', channel.id);

    // Step 2: Create permanent invite
    let inviteUrl = '';
    try {
      const createInviteResponse = await fetch(
        `https://discord.com/api/v10/channels/${channel.id}/invites`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${discordBotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            max_age: 0,    // Never expires
            max_uses: 0,   // Unlimited uses
            unique: false, // Reuse existing invite if available
          }),
        }
      );

      if (createInviteResponse.ok) {
        const invite = await createInviteResponse.json();
        inviteUrl = `https://discord.gg/${invite.code}`;
        console.log('Invite created:', inviteUrl);
      } else {
        console.warn('Failed to create invite, continuing without it');
      }
    } catch (inviteError) {
      console.warn('Error creating invite:', inviteError);
      // Continue anyway - channel exists
    }

    // Step 3: Post welcome message
    try {
      const welcomeMessage = `🎉 **Welcome to the ${epic.title} Guild!** 🎉\n\n` +
        `This is your private space to coordinate, encourage each other, and celebrate victories together.\n\n` +
        `📋 **Epic Code:** \`${epic.invite_code}\`\n` +
        `🌐 **Share:** Invite others using the code in the Cosmiq app!\n\n` +
        `Let's crush this epic together! 💪`;

      await fetch(
        `https://discord.com/api/v10/channels/${channel.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${discordBotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: welcomeMessage }),
        }
      );
    } catch (messageError) {
      console.warn('Error posting welcome message:', messageError);
      // Non-critical error
    }

    // Step 4: Update epic record
    const { error: updateError } = await supabase
      .from('epics')
      .update({
        discord_channel_id: channel.id,
        discord_invite_url: inviteUrl || null,
      })
      .eq('id', epicId);

    if (updateError) {
      console.error('Failed to update epic:', updateError);
      throw updateError;
    }

    // Step 5: Log event
    await supabase.from('epic_discord_events').insert({
      epic_id: epicId,
      event_type: 'channel_created',
      event_data: {
        channel_id: channel.id,
        channel_name: channelName,
        invite_url: inviteUrl,
        epic_title: epic.title,
      },
    });

    console.log('Discord channel setup complete!');

    return new Response(
      JSON.stringify({ 
        success: true,
        channelId: channel.id,
        inviteUrl: inviteUrl,
        message: 'Discord channel created successfully!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating Discord channel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
