import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  colorId?: string;
}

interface ExternalEvent {
  user_id: string;
  connection_id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string | null;
  color: string | null;
  source: string;
  raw_data: object;
  synced_at: string;
}

// Google Calendar color ID to hex mapping
const GOOGLE_COLORS: Record<string, string> = {
  "1": "#7986CB", // Lavender
  "2": "#33B679", // Sage
  "3": "#8E24AA", // Grape
  "4": "#E67C73", // Flamingo
  "5": "#F6BF26", // Banana
  "6": "#F4511E", // Tangerine
  "7": "#039BE5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3F51B5", // Blueberry
  "10": "#0B8043", // Basil
  "11": "#D50000", // Tomato
};

async function refreshTokenIfNeeded(
  supabase: any,
  connection: any,
  googleClientId: string,
  googleClientSecret: string
): Promise<string | null> {
  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return connection.access_token;
  }

  console.log("Token expired or expiring soon, refreshing...");

  if (!connection.refresh_token) {
    console.error("No refresh token available");
    return null;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
      console.error("Token refresh failed:", await tokenResponse.text());
      return null;
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update stored token
    await supabase
      .from("user_calendar_connections")
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    console.log("Token refreshed successfully");
    return tokens.access_token;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

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

    const { action, user_id, start_date, end_date } = await req.json();
    console.log(`Google Calendar Events - Action: ${action}, User: ${user_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action: sync - Fetch events from Google and cache them
    if (action === "sync") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get connection
      const { data: connection, error: connError } = await supabase
        .from("user_calendar_connections")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .single();

      if (connError || !connection) {
        console.error("No Google connection found:", connError);
        return new Response(
          JSON.stringify({ error: "No Google Calendar connection found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!connection.sync_enabled) {
        return new Response(
          JSON.stringify({ error: "Sync is disabled for this connection" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Refresh token if needed
      const accessToken = await refreshTokenIfNeeded(
        supabase,
        connection,
        googleClientId,
        googleClientSecret
      );

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Failed to get valid access token, please reconnect" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate date range (default: 30 days back, 90 days forward)
      const timeMin = start_date 
        ? new Date(start_date).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = end_date
        ? new Date(end_date).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      console.log(`Fetching events from ${timeMin} to ${timeMax}`);

      // Fetch events from Google Calendar
      const eventsUrl = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(connection.calendar_id || "primary")}/events`);
      eventsUrl.searchParams.set("timeMin", timeMin);
      eventsUrl.searchParams.set("timeMax", timeMax);
      eventsUrl.searchParams.set("singleEvents", "true");
      eventsUrl.searchParams.set("orderBy", "startTime");
      eventsUrl.searchParams.set("maxResults", "250");

      const eventsResponse = await fetch(eventsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        console.error("Failed to fetch events:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch events from Google Calendar", details: errorText }),
          { status: eventsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const eventsData = await eventsResponse.json();
      const googleEvents: GoogleEvent[] = eventsData.items || [];

      console.log(`Fetched ${googleEvents.length} events from Google`);

      // Transform to our format
      const externalEvents: ExternalEvent[] = googleEvents.map((event) => {
        const isAllDay = !event.start.dateTime;
        const startTime = event.start.dateTime || `${event.start.date}T00:00:00Z`;
        const endTime = event.end.dateTime || `${event.end.date}T23:59:59Z`;

        return {
          user_id,
          connection_id: connection.id,
          external_event_id: event.id,
          title: event.summary || "(No title)",
          description: event.description || null,
          start_time: startTime,
          end_time: endTime,
          is_all_day: isAllDay,
          location: event.location || null,
          color: event.colorId ? GOOGLE_COLORS[event.colorId] || null : null,
          source: "google",
          raw_data: event,
          synced_at: new Date().toISOString(),
        };
      });

      // Delete old events for this connection in the date range and upsert new ones
      if (externalEvents.length > 0) {
        // Delete events in range first
        await supabase
          .from("external_calendar_events")
          .delete()
          .eq("connection_id", connection.id)
          .gte("start_time", timeMin)
          .lte("start_time", timeMax);

        // Insert new events
        const { error: insertError } = await supabase
          .from("external_calendar_events")
          .upsert(externalEvents, {
            onConflict: "connection_id,external_event_id",
          });

        if (insertError) {
          console.error("Failed to cache events:", insertError);
          return new Response(
            JSON.stringify({ error: "Failed to cache events", details: insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update last synced timestamp
      await supabase
        .from("user_calendar_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_token: eventsData.nextSyncToken || null,
        })
        .eq("id", connection.id);

      console.log(`Cached ${externalEvents.length} events`);

      return new Response(
        JSON.stringify({
          success: true,
          events_synced: externalEvents.length,
          sync_token: eventsData.nextSyncToken || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get_events - Get cached events for a date range
    if (action === "get_events") {
      if (!user_id || !start_date || !end_date) {
        return new Response(
          JSON.stringify({ error: "user_id, start_date, and end_date are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: events, error: fetchError } = await supabase
        .from("external_calendar_events")
        .select("*")
        .eq("user_id", user_id)
        .gte("start_time", new Date(start_date).toISOString())
        .lte("start_time", new Date(end_date).toISOString())
        .order("start_time", { ascending: true });

      if (fetchError) {
        console.error("Failed to fetch cached events:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch events" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Returning ${events?.length || 0} cached events`);

      return new Response(
        JSON.stringify({ events: events || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: clear_cache - Clear all cached events for a user
    if (action === "clear_cache") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabase
        .from("external_calendar_events")
        .delete()
        .eq("user_id", user_id)
        .eq("source", "google");

      if (deleteError) {
        console.error("Failed to clear cache:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to clear event cache" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Cleared event cache for user:", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Google Calendar Events error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
