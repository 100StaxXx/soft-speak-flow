function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const corsModule = await import("./cors.ts");

Deno.test("getAllowedOrigins keeps native defaults when ALLOWED_ORIGINS is configured", () => {
  const originalAllowedOrigins = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "https://custom.cosmiq.quest, https://partner.cosmiq.quest");

  try {
    const origins = corsModule.getAllowedOrigins();

    assert(origins.includes("capacitor://localhost"), "Expected Capacitor origin to remain allowed");
    assert(origins.includes("http://localhost"), "Expected localhost origin to remain allowed");
    assert(origins.includes("https://app.cosmiq.quest"), "Expected production app origin to remain allowed");
    assert(origins.includes("https://custom.cosmiq.quest"), "Expected custom origin from env to be included");
  } finally {
    if (originalAllowedOrigins === undefined) {
      Deno.env.delete("ALLOWED_ORIGINS");
    } else {
      Deno.env.set("ALLOWED_ORIGINS", originalAllowedOrigins);
    }
  }
});

Deno.test("getAllowedOrigins removes duplicates after merging env origins", () => {
  const originalAllowedOrigins = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "https://app.cosmiq.quest, https://custom.cosmiq.quest");

  try {
    const origins = corsModule.getAllowedOrigins();
    const appOrigins = origins.filter((origin: string) => origin === "https://app.cosmiq.quest");

    assert(appOrigins.length === 1, `Expected merged origins to dedupe entries, got ${appOrigins.length}`);
  } finally {
    if (originalAllowedOrigins === undefined) {
      Deno.env.delete("ALLOWED_ORIGINS");
    } else {
      Deno.env.set("ALLOWED_ORIGINS", originalAllowedOrigins);
    }
  }
});
