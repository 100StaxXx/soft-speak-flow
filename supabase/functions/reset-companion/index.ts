import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { resolveUserProductMode } from "../_shared/productBoundary.ts";

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
    const productMode = await resolveUserProductMode(supabase, user.id);

    // Find companion
    const { data: companion, error: compErr } = await supabase
      .from('user_companion')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_mode', productMode)
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

    const [{ data: evolutionRows, error: evolutionLookupError }, {
      data: cinemaRows,
      error: cinemaLookupError,
    }] = await Promise.all([
      supabase.from('companion_evolutions').select('id').eq('companion_id', compId),
      supabase.from('companion_cinema_events').select('id').eq('companion_id', compId),
    ]);
    if (evolutionLookupError) throw evolutionLookupError;
    if (cinemaLookupError) throw cinemaLookupError;

    const evolutionIds = new Set((evolutionRows ?? []).map((row) => row.id));
    const cinemaIds = new Set((cinemaRows ?? []).map((row) => row.id));
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('user_storage_assets')
      .select('id, bucket_id, storage_path, source_record_table, source_record_id')
      .eq('user_id', user.id);
    if (ledgerError) throw ledgerError;

    const companionAssets = (ledgerRows ?? []).filter((asset) => {
      if (
        asset.source_record_table === 'companion_evolutions' &&
        asset.source_record_id &&
        evolutionIds.has(asset.source_record_id)
      ) return true;
      if (
        asset.source_record_table === 'companion_cinema_events' &&
        asset.source_record_id &&
        cinemaIds.has(asset.source_record_id)
      ) return true;
      return typeof asset.storage_path === 'string' && asset.storage_path.includes(compId);
    });

    const pathsByBucket = new Map<string, string[]>();
    for (const asset of companionAssets) {
      const paths = pathsByBucket.get(asset.bucket_id) ?? [];
      paths.push(asset.storage_path);
      pathsByBucket.set(asset.bucket_id, paths);
    }
    for (const [bucketId, paths] of pathsByBucket) {
      const { error: removeError } = await supabase.storage
        .from(bucketId)
        .remove(Array.from(new Set(paths)));
      if (removeError) throw removeError;
    }
    if (companionAssets.length > 0) {
      const { error: ledgerDeleteError } = await supabase
        .from('user_storage_assets')
        .delete()
        .in('id', companionAssets.map((asset) => asset.id));
      if (ledgerDeleteError) throw ledgerDeleteError;
    }

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
