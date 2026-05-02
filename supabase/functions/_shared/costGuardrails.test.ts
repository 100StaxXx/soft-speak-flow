import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  computeCrossedThresholds,
  createCostGuardrailSession,
  detectCostAnomalies,
  getCurrentCostPeriodStart,
  getOpenAITextTokenRatesPerThousand,
  normalizeThresholds,
} from "./costGuardrails.ts";

function delayTelemetryWrite(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

function createCostGuardrailSupabaseMock() {
  const events: Array<Record<string, unknown>> = [];
  const stateUpserts: Array<Record<string, unknown>> = [];
  let activeTelemetryWrites = 0;
  let maxActiveTelemetryWrites = 0;

  async function withTelemetryWrite<T>(operation: () => T): Promise<T> {
    activeTelemetryWrites += 1;
    maxActiveTelemetryWrites = Math.max(
      maxActiveTelemetryWrites,
      activeTelemetryWrites,
    );

    try {
      await delayTelemetryWrite();
      return operation();
    } finally {
      activeTelemetryWrites -= 1;
    }
  }

  const supabase = {
    from(table: string) {
      if (table === "cost_guardrail_config") {
        return {
          select: (_selection: string) => ({
            eq: (_column: string, _value: string) => ({
              in: async (_column: string, _values: string[]) => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "cost_guardrail_state") {
        return {
          select: (_selection: string) => {
            const query = {
              eq: (_column: string, _value: string) => query,
              in: async (_column: string, _values: string[]) => ({
                data: [],
                error: null,
              }),
            };

            return query;
          },
          upsert: (payload: Record<string, unknown>) =>
            withTelemetryWrite(() => {
              stateUpserts.push(payload);
              return { error: null };
            }),
        };
      }

      if (table === "cost_events") {
        return {
          insert: (payload: Record<string, unknown>) =>
            withTelemetryWrite(() => {
              events.push(payload);
              return { error: null };
            }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    events,
    get maxActiveTelemetryWrites() {
      return maxActiveTelemetryWrites;
    },
    stateUpserts,
    supabase,
  };
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

Deno.test("getOpenAITextTokenRatesPerThousand routes GPT-5.5 pro before base GPT-5.5", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-5.5-pro"), {
    inputRate: 0.03,
    outputRate: 0.18,
  });
});

Deno.test("getOpenAITextTokenRatesPerThousand preserves existing fallback tiers", () => {
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-4o-mini"), {
    inputRate: 0.005,
    outputRate: 0.015,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand(null), {
    inputRate: 0.001,
    outputRate: 0.002,
  });
});

Deno.test("createCostGuardrailSession serializes recordEvent writes for parallel wrapped fetches", async () => {
  const mock = createCostGuardrailSupabaseMock();
  const session = createCostGuardrailSession({
    supabase: mock.supabase,
    endpointKey: "companion-chat",
    featureKey: "ai_companion_conversation",
    requestId: "request-1",
    getEnv: () => null,
  });
  const guardedFetch = session.wrapFetch(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Done." } }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 0,
          total_tokens: 1000,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  );
  const openAIRequest = {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-5.5",
      messages: [{ role: "user", content: "Hello." }],
    }),
  };

  await Promise.all([
    guardedFetch("https://api.openai.com/v1/chat/completions", openAIRequest),
    guardedFetch("https://api.openai.com/v1/chat/completions", openAIRequest),
  ]);

  assertEquals(mock.maxActiveTelemetryWrites, 1);
  assertEquals(
    mock.events.map((event) => event.estimated_cost_usd),
    [0.005, 0.005],
  );
  assertEquals(
    mock.stateUpserts
      .filter((row) =>
        row.scope_type === "endpoint" && row.scope_key === "companion-chat"
      )
      .map((row) => row.total_estimated_cost_usd),
    [0.005, 0.01],
  );
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
