import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createCreatorAccessToken } from "../_shared/influencerAuth.ts";

/**
 * Create Influencer Referral Code
 * 
 * Public endpoint (no auth required) for influencers to generate referral codes.
 * Creates a code and stores payout information for future reward payments.
 * Sends a confirmation email with the code and dashboard link.
 * 
 * SECURITY: Rate limited to 3 requests per IP+email per hour
 * 
 * Request body:
 * {
 *   name: string - Influencer's name
 *   email: string - Contact email
 *   handle: string - Social media handle (e.g., @username)
 *   paypal_email: string - PayPal email for payouts
 *   promotion_channel?: string - Where they'll promote (optional)
 * }
 */

// Rate limit: 3 requests per IP per hour
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function generateCodeFromHandle(handle: string): string {
  // Remove @ and special chars, uppercase
  const clean = handle.replace(/[@\s-]/g, "").toUpperCase();
  // Take first 8 chars and add random suffix
  const base = clean.substring(0, 8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COSMIQ-${base}${random}`;
}

/**
 * Get client IP address securely
 * Only trusts cf-connecting-ip as Supabase Edge Functions run behind Cloudflare
 * Falls back to combined hash for rate limiting when IP unavailable
 */
function getClientIP(req: Request): string {
  // Supabase Edge Functions run behind Cloudflare, so cf-connecting-ip is reliable
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // For non-Cloudflare environments (dev/test), fall back but log warning
  console.warn("cf-connecting-ip not available, rate limiting may be less effective");
  return "unknown";
}

/**
 * Sanitize error messages for client responses
 * Logs full error server-side, returns generic message to client
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Log full error server-side for debugging
    console.error("Full error details:", error.message, error.stack);
    
    // Return generic messages for known error types
    if (error.message.includes("violates foreign key")) {
      return "Invalid reference provided";
    }
    if (error.message.includes("duplicate key")) {
      return "This code already exists";
    }
    if (error.message.includes("permission denied")) {
      return "Access denied";
    }
  }
  return "An error occurred. Please try again.";
}

async function checkRateLimit(
  supabaseClient: any,
  ip: string,
  email: string
): Promise<{ allowed: boolean; message?: string }> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Check requests from this IP OR this email in the last hour (combined protection)
  const { count: ipCount, error: ipError } = await supabaseClient
    .from("influencer_creation_log")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", oneHourAgo);
  
  if (ipError) {
    console.error("Rate limit check (IP) failed:", ipError);
  }
  
  // Also check by email to prevent bypass via IP spoofing
  const { count: emailCount, error: emailError } = await supabaseClient
    .from("influencer_creation_log")
    .select("*", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .gte("created_at", oneHourAgo);
  
  if (emailError) {
    console.error("Rate limit check (email) failed:", emailError);
  }
  
  // Block if either IP or email exceeds limit
  const effectiveIpCount = ipCount ?? 0;
  const effectiveEmailCount = emailCount ?? 0;
  
  if (effectiveIpCount >= RATE_LIMIT_MAX || effectiveEmailCount >= RATE_LIMIT_MAX) {
    console.warn(`Rate limit exceeded - IP: ${ip} (${effectiveIpCount}), Email: ${email} (${effectiveEmailCount})`);
    return { 
      allowed: false, 
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} code requests per hour.` 
    };
  }
  
  // Log this request for future rate limiting
  await supabaseClient.from("influencer_creation_log").insert({
    ip_address: ip,
    email: email.toLowerCase(),
  });
  
  return { allowed: true };
}

async function sendConfirmationEmail(
  name: string,
  email: string,
  code: string,
  dashboardUrl: string,
  referralLink: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping confirmation email");
    return;
  }

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: "Cosmiq Partners <partners@cosmiq.quest>",
      to: [email],
      subject: "🚀 Your Cosmiq Referral Code is Ready!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; color: #ffffff;">✨ Welcome to Cosmiq Partners!</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 40px;">
                      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Hey ${name}! 👋
                      </p>
                      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                        Your referral code is all set up and ready to share with your audience!
                      </p>
                      
                      <!-- Code Box -->
                      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px;">
                        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Your Referral Code</p>
                        <p style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 2px;">${code}</p>
                      </div>
                      
                      <!-- Referral Link -->
                      <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                        <p style="color: #a78bfa; font-size: 14px; margin: 0 0 8px;">Share this link:</p>
                        <a href="${referralLink}" style="color: #c4b5fd; font-size: 14px; word-break: break-all;">${referralLink}</a>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          View Your Dashboard →
                        </a>
                      </div>
                      
                      <!-- Earnings Info -->
                      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                        <h3 style="color: #ffffff; font-size: 18px; margin: 0 0 16px;">💰 Your Earning Potential</h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #a78bfa;">Monthly subscriber:</span>
                              <span style="color: #22c55e; float: right; font-weight: 600;">$5</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #a78bfa;">Annual subscriber:</span>
                              <span style="color: #22c55e; float: right; font-weight: 600;">$12</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.1);">
                              <span style="color: #e0e0e0; font-size: 13px;">Minimum payout threshold: $50</span>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background: rgba(0,0,0,0.2); text-align: center;">
                      <p style="color: #888; font-size: 13px; margin: 0;">
                        Questions? Reply to this email or visit <a href="https://cosmiq.quest" style="color: #a78bfa;">cosmiq.quest</a>
                      </p>
                      <p style="color: #666; font-size: 12px; margin: 16px 0 0;">
                        © 2024 Cosmiq. Transform your habits into an epic journey.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    // Don't throw - email failure shouldn't block code creation
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { name, email, handle, paypal_email, promotion_channel } = await req.json();

    // Validate required fields
    if (!name || !email || !handle || !paypal_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, handle, paypal_email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(paypal_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // SECURITY: Check rate limit before processing (by IP + email)
    const clientIP = getClientIP(req);
    const rateLimitResult = await checkRateLimit(supabaseClient, clientIP, email);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit blocked request from IP: ${clientIP}, email: ${email}`);
      return new Response(
        JSON.stringify({ error: rateLimitResult.message }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://cosmiq.quest";

    // Check if influencer already has a code
    const { data: existingCode } = await supabaseClient
      .from("referral_codes")
      .select("code")
      .eq("influencer_email", email)
      .eq("owner_type", "influencer")
      .maybeSingle();

    if (existingCode) {
      const creatorAccessToken = await createCreatorAccessToken(existingCode.code);

      // Return existing code instead of creating duplicate
      const appLink = `${appUrl}/?ref=${existingCode.code}`;
      const dashboardUrl = `${appUrl}/creator/dashboard?code=${existingCode.code}&token=${encodeURIComponent(creatorAccessToken)}`;
      
      // Send reminder email with existing code
      await sendConfirmationEmail(name, email, existingCode.code, dashboardUrl, appLink);
      
      return new Response(
        JSON.stringify({
          code: existingCode.code,
          link: appLink,
          creator_access_token: creatorAccessToken,
          dashboard_url: dashboardUrl,
          message: "You already have a referral code. We've sent you a reminder email!",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate code from handle
    let code = generateCodeFromHandle(handle);
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseClient
        .from("referral_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      
      if (!existing) break;
      
      // Regenerate with different random suffix
      code = generateCodeFromHandle(handle + Math.random().toString());
      attempts++;
    }

    // Create influencer referral code
    const { data: newCode, error: insertError } = await supabaseClient
      .from("referral_codes")
      .insert({
        code,
        owner_type: "influencer",
        influencer_name: name,
        influencer_email: email,
        influencer_handle: handle,
        payout_method: "paypal",
        payout_identifier: paypal_email,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create influencer code:", insertError);
      return new Response(
        JSON.stringify({ error: sanitizeError(insertError) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appLink = `${appUrl}/?ref=${code}`;
    const creatorAccessToken = await createCreatorAccessToken(code);
    const dashboardUrl = `${appUrl}/creator/dashboard?code=${code}&token=${encodeURIComponent(creatorAccessToken)}`;

    // Send confirmation email
    await sendConfirmationEmail(name, email, code, dashboardUrl, appLink);

    console.log(`Created influencer code for ${name} (@${handle}): ${code} from IP: ${clientIP}`);

    return new Response(
      JSON.stringify({
        code,
        link: appLink,
        creator_access_token: creatorAccessToken,
        dashboard_url: dashboardUrl,
        promo_caption: `✨ Transform your habits into an epic journey! Use my code ${code} or click: ${appLink}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating influencer code:", error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
