import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw userErr;
    if (!user) throw new Error('Unauthorized');

    const userId = user.id;
    console.log(`Starting account deletion for user: ${userId}`);

    // Delete user data from various tables
    // Note: Tables with CASCADE DELETE on user_id will be handled automatically
    // We explicitly delete from tables that might not have cascade setup

    // Delete companion and related data
    const { data: companion } = await supabase
      .from('user_companion')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (companion) {
      // Delete companion-related data
      await supabase.from('xp_events').delete().eq('companion_id', companion.id);
      await supabase.from('companion_evolutions').delete().eq('companion_id', companion.id);
      await supabase.from('user_companion').delete().eq('id', companion.id);
    }

    // Delete user-specific data from tables
    const tablesToClear = [
      'user_daily_horoscopes',
      'user_daily_pushes',
      'user_ai_preferences',
      'user_challenges',
      'user_companion_skins',
      'adaptive_push_settings',
      'user_cosmic_deep_dives',
      'push_registrations',
      'muted_guild_users',
    ];

    for (const table of tablesToClear) {
      try {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) {
          console.warn(`Warning: Could not delete from ${table}:`, error.message);
        }
      } catch (e) {
        // Table might not exist, continue
        console.warn(`Warning: Table ${table} cleanup failed:`, e);
      }
    }

    // Clear referral relationships
    // Update any users who were referred by this user to null
    await supabase
      .from('profiles')
      .update({ referred_by: null })
      .eq('referred_by', userId);

    // Delete the profile (this should cascade to related data)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.warn('Profile deletion warning:', profileError.message);
    }

    // Finally, delete the user from auth.users using admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Auth user deletion error:', deleteError);
      throw new Error(`Failed to delete user account: ${deleteError.message}`);
    }

    console.log(`Account deletion completed for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('delete-account error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
