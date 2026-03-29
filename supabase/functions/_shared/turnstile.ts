interface TurnstileVerificationResult {
  success: boolean;
  status?: number;
  message?: string;
}

function isLocalEnvironment(): boolean {
  const environment = Deno.env.get("ENVIRONMENT");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (environment && environment !== "production") {
    return true;
  }

  if (!supabaseUrl) {
    return false;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileVerificationResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");

  if (!secret) {
    if (isLocalEnvironment()) {
      console.warn("TURNSTILE_SECRET_KEY not configured; skipping verification in local environment");
      return { success: true };
    }

    return {
      success: false,
      status: 503,
      message: "Creator signup is temporarily unavailable",
    };
  }

  if (!token) {
    return {
      success: false,
      status: 400,
      message: "Missing security challenge token",
    };
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    console.error("Turnstile verification request failed:", response.status, rawBody);
    return {
      success: false,
      status: 503,
      message: "Unable to verify security challenge",
    };
  }

  let payload: {
    success?: boolean;
    "error-codes"?: string[];
  } | null = null;

  try {
    payload = await response.json();
  } catch (error) {
    console.error("Failed to parse Turnstile verification response:", error);
    return {
      success: false,
      status: 503,
      message: "Unable to verify security challenge",
    };
  }

  if (!payload?.success) {
    console.warn("Turnstile verification failed:", payload?.["error-codes"] ?? []);
    return {
      success: false,
      status: 400,
      message: "Security challenge failed. Please try again.",
    };
  }

  return { success: true };
}
