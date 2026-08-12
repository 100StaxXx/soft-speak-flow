import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  computeCrossedThresholds,
  createCostGuardrailSession,
  detectCostAnomalies,
  getCurrentCostPeriodStart,
  getOpenAIImageFallbackCostUsd,
  getOpenAIImageTokenRatesPerThousand,
  getOpenAITextTokenRatesPerThousand,
  normalizeThresholds,
} from "./costGuardrails.ts";

function createCostGuardrailSupabaseMock() {
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const upserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const supabase = {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return Promise.resolve({ data: [], error: null });
        },
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return Promise.resolve({ data: null, error: null });
        },
        upsert(payload: Record<string, unknown>) {
          upserts.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { supabase, inserts, upserts };
}

Deno.test("normalizeThresholds falls back to defaults", () => {
  const thresholds = normalizeThresholds(null);
  if (thresholds.join(",") !== "50,80,90,100") {
    throw new Error(`Unexpected thresholds: ${thresholds.join(",")}`);
  }
});

Deno.test("computeCrossedThresholds returns only newly crossed thresholds", () => {
  const crossed = computeCrossedThresholds({
    previousPercent: 49,
    nextPercent: 92,
  });

  if (crossed.join(",") !== "50,80,90") {
    throw new Error(`Unexpected threshold crossings: ${crossed.join(",")}`);
  }
});

Deno.test("getCurrentCostPeriodStart uses UTC month boundaries", () => {
  const periodStart = getCurrentCostPeriodStart(
    new Date("2026-03-31T23:59:59-07:00"),
  );
  if (periodStart !== "2026-04-01") {
    throw new Error(`Expected UTC month rollover, got ${periodStart}`);
  }
});

Deno.test("getOpenAITextTokenRatesPerThousand routes GPT-5.5 to documented text rates", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.5"), {
    inputRate: 0.005,
    outputRate: 0.03,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand routes the GPT-5.6 family to documented text rates", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.6-luna"), {
    inputRate: 0.001,
    outputRate: 0.006,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.6-terra"), {
    inputRate: 0.0025,
    outputRate: 0.015,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.6-sol"), {
    inputRate: 0.005,
    outputRate: 0.03,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand routes GPT-5.5 pro before base GPT-5.5", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.5-pro"), {
    inputRate: 0.03,
    outputRate: 0.18,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand routes GPT-5.4 mini to documented text rates", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.4-mini"), {
    inputRate: 0.00075,
    outputRate: 0.0045,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand routes GPT-5.4 pro and nano before base GPT-5.4", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.4-pro"), {
    inputRate: 0.03,
    outputRate: 0.18,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.4-nano"), {
    inputRate: 0.0002,
    outputRate: 0.00125,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.4"), {
    inputRate: 0.0025,
    outputRate: 0.015,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand routes previous GPT-5.x models to documented text rates", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.2"), {
    inputRate: 0.00175,
    outputRate: 0.014,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.1"), {
    inputRate: 0.00125,
    outputRate: 0.01,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand preserves existing fallback tiers", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-4o-mini"), {
    inputRate: 0.005,
    outputRate: 0.015,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-6-preview"), {
    inputRate: 0.001,
    outputRate: 0.002,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand(null), {
    inputRate: 0.001,
    outputRate: 0.002,
  });
});

Deno.test("getOpenAIImageTokenRatesPerThousand routes current image models to token-priced rates", () => {
  assertEquals(getOpenAIImageTokenRatesPerThousand("gpt-image-2"), {
    textInputRate: 0.005,
    imageInputRate: 0.008,
    textOutputRate: 0,
    imageOutputRate: 0.03,
  });
  assertEquals(getOpenAIImageTokenRatesPerThousand("gpt-image-1.5"), {
    textInputRate: 0.005,
    imageInputRate: 0.008,
    textOutputRate: 0.01,
    imageOutputRate: 0.032,
  });
  assertEquals(getOpenAIImageTokenRatesPerThousand("gpt-image-1-mini"), {
    textInputRate: 0.002,
    imageInputRate: 0.0025,
    textOutputRate: 0,
    imageOutputRate: 0.008,
  });
});

Deno.test("getOpenAIImageFallbackCostUsd accounts for size and high-quality image fallbacks", () => {
  assertEquals(
    getOpenAIImageFallbackCostUsd("gpt-image-1.5", "1536x1024", "high"),
    0.2,
  );
  assertEquals(
    getOpenAIImageFallbackCostUsd(
      "chatgpt-image-latest",
      "1024x1024",
      "medium",
    ),
    0.034,
  );
  assertEquals(
    getOpenAIImageFallbackCostUsd("gpt-image-1", "1024x1536", "high"),
    0.25,
  );
  assertEquals(
    getOpenAIImageFallbackCostUsd("gpt-image-1-mini", "1536x1024", "high"),
    0.052,
  );
});

Deno.test("cost guardrail image telemetry uses Image API size when usage tokens are absent", async () => {
  const { supabase, inserts } = createCostGuardrailSupabaseMock();
  const session = createCostGuardrailSession({
    supabase,
    endpointKey: "generate-companion-image",
    featureKey: "companion-image",
    userId: "user-1",
  });

  const guardedFetch = session.wrapFetch(async () =>
    new Response(
      JSON.stringify({
        data: [{ b64_json: "image-bytes" }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  );

  await guardedFetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt: "draw a companion",
      size: "1536x1024",
      quality: "high",
    }),
  });

  const costEvent = inserts.find((row) => row.table === "cost_events");
  assertEquals(costEvent?.payload.estimated_cost_usd, 0.2);
  assertEquals(costEvent?.payload.model, "gpt-image-1.5");
  assertEquals(costEvent?.payload.image_count, 1);
});

Deno.test("detectCostAnomalies finds hourly spend spikes", () => {
  const now = new Date("2026-03-28T12:00:00Z");
  const events = [
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-27T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-26T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-25T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-24T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-23T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 0.5,
      createdAt: "2026-03-22T00:00:00Z",
    },
    {
      endpointKey: "generate-companion-image",
      estimatedCostUsd: 6,
      createdAt: "2026-03-28T11:30:00Z",
    },
  ];

  const anomalies = detectCostAnomalies(events, now);
  const hourly = anomalies.find((item) =>
    item.endpointKey === "generate-companion-image" && item.window === "hour"
  );
  if (!hourly) {
    throw new Error("Expected hourly anomaly to be detected");
  }
});
