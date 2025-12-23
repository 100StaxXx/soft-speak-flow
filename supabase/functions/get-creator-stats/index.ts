import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 5 requests per IP per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5;

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

async function checkRateLimit(supabaseClient: any, ip: string): Promise<{ allowed: boolean; message?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Query recent requests from this IP using influencer_creation_log (reusing existing table)
  const { data: recentRequests, error } = await supabaseClient
    .from('influencer_creation_log')
    .select('id')
    .eq('ip_address', ip)
    .eq('request_type', 'stats_lookup')
    .gte('created_at', windowStart);
  
  if (error) {
    console.error('Rate limit check error:', error);
    // Allow on error to not block legitimate requests
    return { allowed: true };
  }
  
  if (recentRequests && recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { 
      allowed: false, 
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per hour.` 
    };
  }
  
  return { allowed: true };
}

async function logRequest(supabaseClient: any, ip: string, email: string | null) {
  try {
    await supabaseClient
      .from('influencer_creation_log')
      .insert({
        ip_address: ip,
        email: email || 'stats-lookup',
        request_type: 'stats_lookup'
      });
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const clientIP = getClientIP(req);
    
    // Check rate limit
    const rateLimitCheck = await checkRateLimit(supabaseClient, clientIP);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateLimitCheck.message }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { email, referral_code } = await req.json();

    // Validate input - need either email or referral_code
    if (!email && !referral_code) {
      return new Response(
        JSON.stringify({ error: 'Either email or referral_code is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (email && !validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log this request for rate limiting
    await logRequest(supabaseClient, clientIP, email);

    // Build query to find the referral code
    let query = supabaseClient
      .from('referral_codes')
      .select('*')
      .eq('owner_type', 'influencer')
      .eq('is_active', true);

    if (email) {
      query = query.eq('email', email.toLowerCase());
    } else if (referral_code) {
      query = query.ilike('code', referral_code);
    }

    const { data: codeData, error: codeError } = await query.single();

    if (codeError || !codeData) {
      console.log('Code lookup result:', { codeError, codeData });
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch payout history for this referral code
    const { data: payouts, error: payoutsError } = await supabaseClient
      .from('referral_payouts')
      .select('amount, status, created_at, paid_at, plan')
      .eq('referral_code_id', codeData.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (payoutsError) {
      console.error('Error fetching payouts:', payoutsError);
    }

    // Calculate earnings by status
    const payoutsList = payouts || [];
    const pendingEarnings = payoutsList
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const requestedEarnings = payoutsList
      .filter(p => p.status === 'requested')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const paidEarnings = payoutsList
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalEarnings = pendingEarnings + requestedEarnings + paidEarnings;

    // Build response
    const response = {
      code: codeData.code,
      name: codeData.name || null,
      handle: codeData.handle || null,
      tier: codeData.tier || 'bronze',
      created_at: codeData.created_at,
      stats: {
        total_signups: codeData.total_signups || 0,
        total_conversions: codeData.total_conversions || 0,
        pending_earnings: Math.round(pendingEarnings * 100) / 100,
        requested_earnings: Math.round(requestedEarnings * 100) / 100,
        paid_earnings: Math.round(paidEarnings * 100) / 100,
        total_earnings: Math.round(totalEarnings * 100) / 100,
      },
      payout_history: payoutsList.slice(0, 10).map(p => ({
        amount: p.amount,
        status: p.status,
        plan: p.plan,
        created_at: p.created_at,
        paid_at: p.paid_at
      }))
    };

    console.log('Returning stats for creator:', codeData.code);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-creator-stats:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
