# Discord Integration - Final Setup Steps

**Status:** Bot & Secrets ✅ | Migrations ⚠️ | Deployment ⚠️

---

## Step 3: Apply Database Migration (5 minutes)

### Option A: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Left sidebar → Click "SQL Editor"
   - Click "New query"

3. **Run Migration SQL**
   - Copy the SQL below and paste into the editor:

```sql
-- Add Discord Guild Channel support to epics table
ALTER TABLE epics 
  ADD COLUMN IF NOT EXISTS discord_channel_id text,
  ADD COLUMN IF NOT EXISTS discord_invite_url text,
  ADD COLUMN IF NOT EXISTS discord_ready boolean DEFAULT false;

-- Add index for efficient queries on discord_ready status
CREATE INDEX IF NOT EXISTS idx_epics_discord_ready 
  ON epics(discord_ready) 
  WHERE discord_ready = true;

-- Add comments for documentation
COMMENT ON COLUMN epics.discord_channel_id IS 'Discord channel ID when guild channel is created';
COMMENT ON COLUMN epics.discord_invite_url IS 'Permanent invite URL for the guild Discord channel';
COMMENT ON COLUMN epics.discord_ready IS 'True when epic has 3+ members and is eligible for Discord channel';
```

4. **Execute the Query**
   - Click "Run" (or press Ctrl/Cmd + Enter)
   - Should see: "Success. No rows returned"

5. **Verify Migration Worked**
   - Run this verification query:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'epics' 
  AND column_name IN ('discord_channel_id', 'discord_invite_url', 'discord_ready');
```

   - Should return 3 rows showing the new columns

### Option B: Check if Already Applied

The migration uses `IF NOT EXISTS` so it's safe to run multiple times. If columns already exist, it will just skip them.

To check if already applied:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'epics' 
  AND column_name LIKE 'discord%';
```

If you see 3 rows (`discord_channel_id`, `discord_invite_url`, `discord_ready`), the migration is already applied! ✅

---

## Step 4: Deploy Edge Function (10 minutes)

### Manual Deployment via Dashboard

1. **Open Edge Functions**
   - Supabase Dashboard → Left sidebar → "Edge Functions"

2. **Create New Function**
   - Click "Create a new function"
   - Function name: `create-discord-channel-for-guild`
   - Click "Create function"

3. **Paste Function Code**
   - Delete any template code
   - Copy the ENTIRE code from below:

```typescript
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { epicId }: CreateChannelRequest = await req.json();

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

    if (epic.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the epic owner can create a Discord channel' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    if (!epic.discord_ready) {
      return new Response(
        JSON.stringify({ error: 'Epic needs 3+ members to unlock Discord channel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channelName = `guild-${epic.invite_code.toLowerCase().replace('EPIC-', '')}`;

    console.log(`Creating Discord channel: ${channelName}`);

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
          type: 0,
          topic: `🎯 Guild channel for epic: ${epic.title} | Code: ${epic.invite_code}`,
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
            max_age: 0,
            max_uses: 0,
            unique: false,
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
    }

    try {
      const welcomeMessage = `🎉 **Welcome to the ${epic.title} Guild!** 🎉\n\n` +
        `This is your private space to coordinate, encourage each other, and celebrate victories together.\n\n` +
        `📋 **Epic Code:** \`${epic.invite_code}\`\n` +
        `🌐 **Share:** Invite others using the code in the R-Evolution app!\n\n` +
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
    }

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
```

4. **Deploy the Function**
   - Click "Deploy" button
   - Wait for deployment to complete (should see green checkmark)

5. **Verify Deployment**
   - Go to Edge Functions list
   - Should see `create-discord-channel-for-guild` with status "Active"

---

## Step 5: Test the Integration (15 minutes)

### Test Flow

1. **Create a Public Epic**
   - In your app, create a new epic
   - Make it public (shareable)
   - Note the invite code

2. **Join with 2nd User**
   - Use another account or have friend join
   - Enter the invite code
   - Should see "Discord: 2/3 🔒" message

3. **Join with 3rd User**
   - Add one more member
   - Epic should auto-mark as `discord_ready = true`
   - Owner should see green "Create Channel ✨" button

4. **Create Discord Channel**
   - As the epic owner, click "Create Channel"
   - Should see loading state
   - Success toast: "Discord channel created! 🎮"
   - Button changes to "Open Chat →"

5. **Verify in Discord**
   - Check your Discord server
   - Should see new channel: `guild-[code]`
   - Channel should have welcome message
   - Topic should show epic title

6. **Test Member Access**
   - All 3 users should see "Open Chat →" button
   - Clicking opens Discord in new tab
   - Invite link should work
   - Members can join and chat

### Debugging

If something doesn't work:

**Check Function Logs:**
- Supabase Dashboard → Edge Functions → `create-discord-channel-for-guild` → Logs
- Look for error messages

**Check Discord Bot:**
- Verify bot is in your server
- Check bot has these permissions:
  - Manage Channels ✅
  - Send Messages ✅
  - Create Instant Invite ✅
  - View Channels ✅

**Check Secrets:**
- Dashboard → Settings → Edge Functions → Secrets
- Verify `DISCORD_BOT_TOKEN` is set
- Verify `DISCORD_GUILD_ID` is set (should be `1442580219285471364`)

**Check Database:**
```sql
-- Check if epic is marked as ready
SELECT id, title, discord_ready, discord_channel_id 
FROM epics 
WHERE is_public = true;

-- Check member count
SELECT epic_id, COUNT(*) as member_count 
FROM epic_members 
GROUP BY epic_id;
```

---

## Quick Verification Script

Run this in Supabase SQL Editor to verify everything:

```sql
-- 1. Check columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'epics' 
  AND column_name LIKE 'discord%';
-- Should return 3 rows

-- 2. Check epic_discord_events table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'epic_discord_events';
-- Should return 1 row

-- 3. Check existing epics
SELECT id, title, discord_ready, discord_channel_id, discord_invite_url 
FROM epics 
WHERE is_public = true 
LIMIT 5;
-- Shows current state of public epics
```

---

## Success Criteria ✅

You'll know everything is working when:

- [ ] Migration shows 3 new columns in epics table
- [ ] Edge function shows "Active" status
- [ ] Creating epic shows no errors
- [ ] 3rd member join shows unlock message
- [ ] Owner can click "Create Channel"
- [ ] Discord channel appears in server
- [ ] All members can access chat
- [ ] No errors in function logs

---

## Next Steps After Setup

Once everything works:

1. **Test edge cases:**
   - Try creating channel with < 3 members (should fail)
   - Try creating twice (should fail gracefully)
   - Test with bot offline (should show error)

2. **Monitor usage:**
   - Check `epic_discord_events` table for logs
   - Monitor function invocation count
   - Watch for error patterns

3. **Optional enhancements:**
   - Add webhook URL for automated updates
   - Set up Discord role assignment
   - Add channel cleanup on epic delete

---

**Need Help?**

If you get stuck:
1. Check function logs in Supabase Dashboard
2. Verify secrets are set correctly
3. Check Discord bot permissions
4. Review `epic_discord_events` table for error details
5. Check browser console for client-side errors

**Report Generated:** November 27, 2025
