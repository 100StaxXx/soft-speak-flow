/** Provider credentials never leave the server. All callers must authenticate and scope the connection first. */
export async function calendarAccessToken(db: any, conn: any, env: (name: string) => string | undefined, fetcher: typeof fetch = fetch) {
  if (!["google", "outlook"].includes(conn.provider)) throw new Error("Unsupported calendar provider.");
  if (conn.access_token && Date.parse(conn.token_expires_at || "") > Date.now()+60000) return conn.access_token as string;
  const google = conn.provider === "google";
  const clientId = env(google ? "GOOGLE_CALENDAR_CLIENT_ID" : "OUTLOOK_CLIENT_ID");
  const clientSecret = env(google ? "GOOGLE_CALENDAR_CLIENT_SECRET" : "OUTLOOK_CLIENT_SECRET");
  if (!conn.refresh_token || !clientId || !clientSecret) throw new Error("Reconnect this account in Preferences.");
  const response = await fetcher(google ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Reconnect this account in Preferences.");
  const tokens = await response.json();
  const expiresIn = Number(tokens.expires_in ?? 3600);
  if (typeof tokens.access_token !== "string" || !tokens.access_token.trim()
    || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 604800
    || (tokens.refresh_token != null && (typeof tokens.refresh_token !== "string" || !tokens.refresh_token))) {
    throw new Error("Account authorization failed.");
  }
  // A phone, another worker, or an OAuth reconnect may have replaced credentials
  // during this request. Never overwrite that newer connection with this result.
  let save = db.from("user_calendar_connections").update({ access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || conn.refresh_token,
    token_expires_at: new Date(Date.now()+expiresIn*1000).toISOString(),
  }).eq("id", conn.id).eq("user_id", conn.user_id).eq("provider", conn.provider)
    .eq("sync_enabled", true).eq("refresh_token", conn.refresh_token);
  save = conn.access_token == null ? save.is("access_token", null) : save.eq("access_token", conn.access_token);
  if (conn.updated_at) save = save.eq("updated_at", conn.updated_at);
  const { data: saved, error } = await save.select("id").maybeSingle();
  if (error) throw new Error("Could not save account authorization.");
  if (!saved) throw new Error("This calendar connection changed. Sync will retry with its current authorization.");
  return tokens.access_token as string;
}
