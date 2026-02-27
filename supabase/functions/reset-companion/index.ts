import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw userErr;
    if (!user) throw new Error('Unauthorized');

    // Find companion
    const { data: companion, error: compErr } = await supabase
      .from('user_companion')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (compErr) throw compErr;

    if (!companion) {
      return new Response(JSON.stringify({ success: true, message: 'No companion to reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete related data (bypass RLS with service role)
    const compId = companion.id;

    const { error: delXpErr } = await supabase
      .from('xp_events')
      .delete()
      .eq('companion_id', compId);
    if (delXpErr) throw delXpErr;

    const { error: delEvoErr } = await supabase
      .from('companion_evolutions')
      .delete()
      .eq('companion_id', compId);
    if (delEvoErr) throw delEvoErr;

    const { error: delCompErr } = await supabase
      .from('user_companion')
      .delete()
      .eq('id', compId);
    if (delCompErr) throw delCompErr;

    // SECURITY FIX: Do NOT clear referral relationship on companion reset
    // Referral relationships must be permanent after stage 3 completion to prevent gaming
    // The referral_completions table tracks completed referrals and should be authoritative
    // Clearing referred_by would allow users to repeatedly apply codes and farm payouts

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('reset-companion error:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
