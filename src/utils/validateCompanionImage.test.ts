import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { generateWithValidation } from "./validateCompanionImage";

describe("generateWithValidation", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("passes through flowType and max retry overrides", async () => {
    invokeMock.mockResolvedValue({
      data: {
        imageUrl: "https://example.com/companion.png",
        qualityScore: {
          overallScore: 85,
          shouldRetry: false,
          retryCount: 0,
        },
      },
      error: null,
    });

    await generateWithValidation(
      {
        favoriteColor: "#FF6B35",
        spiritAnimal: "Wolf",
        element: "Fire",
        stage: 0,
        flowType: "onboarding",
      },
      { maxRetries: 0 },
    );

    expect(invokeMock).toHaveBeenCalledWith("generate-companion-image", {
      body: expect.objectContaining({
        favoriteColor: "#FF6B35",
        spiritAnimal: "Wolf",
        element: "Fire",
        stage: 0,
        flowType: "onboarding",
        maxInternalRetries: 0,
      }),
    });
  });

  it("keeps compatibility defaults when retry override is omitted", async () => {
    invokeMock.mockResolvedValue({
      data: {
        imageUrl: "https://example.com/companion.png",
      },
      error: null,
    });

    await generateWithValidation({
      favoriteColor: "#7B68EE",
      spiritAnimal: "Fox",
      element: "Air",
      stage: 4,
      flowType: "regenerate",
    });

    const [, invokeArgs] = invokeMock.mock.calls[0];
    expect(invokeArgs.body).toMatchObject({
      favoriteColor: "#7B68EE",
      spiritAnimal: "Fox",
      element: "Air",
      stage: 4,
      flowType: "regenerate",
    });
    expect(invokeArgs.body).not.toHaveProperty("maxInternalRetries");
  });
});
