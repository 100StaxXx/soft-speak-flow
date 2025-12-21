import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

    if (!googleClientId || !googleClientSecret) {
      console.error("Missing Google Calendar credentials");
      return new Response(
        JSON.stringify({ error: "Google Calendar integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, code, redirect_uri, user_id } = await req.json();
    console.log(`Google Calendar Auth - Action: ${action}, User: ${user_id}`);

    // Action: get_auth_url - Generate OAuth URL for user to authorize
    if (action === "get_auth_url") {
      if (!redirect_uri) {
        return new Response(
          JSON.stringify({ error: "redirect_uri is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // State includes user_id for callback identification
      const state = btoa(JSON.stringify({ user_id, redirect_uri }));

      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set("client_id", googleClientId);
      authUrl.searchParams.set("redirect_uri", redirect_uri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      console.log("Generated auth URL for user:", user_id);
      return new Response(
        JSON.stringify({ auth_url: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange_code - Exchange authorization code for tokens
    if (action === "exchange_code") {
      if (!code || !redirect_uri || !user_id) {
        return new Response(
          JSON.stringify({ error: "code, redirect_uri, and user_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Exchanging code for tokens...");

      // Exchange code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResponse.json();
      console.log("Token exchange successful, expires_in:", tokens.expires_in);

      // Get user email from Google
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let calendarEmail = null;
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        calendarEmail = userInfo.email;
        console.log("Got calendar email:", calendarEmail);
      }

      // Get primary calendar ID
      const calendarListResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      let calendarId = "primary";
      if (calendarListResponse.ok) {
        const calendarData = await calendarListResponse.json();
        calendarId = calendarData.id || "primary";
        console.log("Got calendar ID:", calendarId);
      }

      // Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

      // Store connection in database
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: connection, error: upsertError } = await supabase
        .from("user_calendar_connections")
        .upsert({
          user_id,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          calendar_id: calendarId,
          calendar_email: calendarEmail,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,provider",
        })
        .select()
        .single();

      if (upsertError) {
        console.error("Failed to store connection:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to store calendar connection", details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Calendar connection stored successfully:", connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          connection_id: connection.id,
          calendar_email: calendarEmail,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: refresh_token - Refresh expired access token
    if (action === "refresh_token") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get current connection
      const { data: connection, error: fetchError } = await supabase
        .from("user_calendar_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .single();

      if (fetchError || !connection) {
        console.error("No Google connection found for user:", user_id);
        return new Response(
          JSON.stringify({ error: "No Google Calendar connection found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!connection.refresh_token) {
        console.error("No refresh token available for user:", user_id);
        return new Response(
          JSON.stringify({ error: "No refresh token available, please reconnect" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Refreshing token for user:", user_id);

      // Refresh the token
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token refresh failed:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to refresh token", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResponse.json();
      const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

      // Update stored tokens
      const { error: updateError } = await supabase
        .from("user_calendar_connections")
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      if (updateError) {
        console.error("Failed to update tokens:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Token refreshed successfully");

      return new Response(
        JSON.stringify({
          success: true,
          access_token: tokens.access_token,
          expires_at: tokenExpiresAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: disconnect - Remove calendar connection
    if (action === "disconnect") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Delete connection (cascade will delete events)
      const { error: deleteError } = await supabase
        .from("user_calendar_connections")
        .delete()
        .eq("user_id", user_id)
        .eq("provider", "google");

      if (deleteError) {
        console.error("Failed to disconnect:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to disconnect calendar" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Google Calendar disconnected for user:", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: status - Check connection status
    if (action === "status") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: connection, error: fetchError } = await supabase
        .from("user_calendar_connections")
        .select("id, calendar_email, sync_enabled, last_synced_at, token_expires_at, created_at")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to fetch status:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch connection status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isConnected = !!connection;
      const isTokenExpired = connection?.token_expires_at 
        ? new Date(connection.token_expires_at) < new Date() 
        : false;

      return new Response(
        JSON.stringify({
          connected: isConnected,
          token_expired: isTokenExpired,
          calendar_email: connection?.calendar_email,
          sync_enabled: connection?.sync_enabled,
          last_synced_at: connection?.last_synced_at,
          connected_at: connection?.created_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Google Calendar Auth error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
