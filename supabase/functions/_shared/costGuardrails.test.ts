import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  computeCrossedThresholds,
  detectCostAnomalies,
  getCurrentCostPeriodStart,
  getOpenAITextTokenRatesPerThousand,
  normalizeThresholds,
} from "./costGuardrails.ts";

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
  assertEquals(getOpenAITextTokenRatesPerThousand("gpt-6-preview"), {
    inputRate: 0.001,
    outputRate: 0.002,
  });
  assertEquals(getOpenAITextTokenRatesPerThousand(null), {
    inputRate: 0.001,
    outputRate: 0.002,
  });
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
