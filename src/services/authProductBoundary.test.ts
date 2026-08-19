import type { Session, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companionMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "user_companion") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ maybeSingle: mocks.companionMaybeSingle }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({ maybeSingle: mocks.profileMaybeSingle }),
        }),
      };
    }),
  },
}));

import { validateSessionProductBoundary } from "./authProductBoundary";

const makeSession = (userOverrides: Partial<User>): Session => ({
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-08-18T00:00:00.000Z",
    ...userOverrides,
  },
});

describe("auth product boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.companionMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("rejects a trusted Cosmiq session in Graceward without reading account data", async () => {
    const boundary = await validateSessionProductBoundary(
      makeSession({
        app_metadata: { auth_product_mode: "cosmiq", provider: "apple" },
      }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      expectedProductMode: "graceward",
      actualProductMode: "cosmiq",
      reason: "trusted_binding",
    });
    expect(mocks.companionMaybeSingle).not.toHaveBeenCalled();
  });

  it("rejects a legacy Cosmiq account using its companion binding", async () => {
    mocks.companionMaybeSingle.mockResolvedValue({
      data: { product_mode: "cosmiq", preset_id: "cosmiq-preset" },
      error: null,
    });

    const boundary = await validateSessionProductBoundary(
      makeSession({
        app_metadata: { provider: "apple" },
      }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      actualProductMode: "cosmiq",
      reason: "companion_binding",
    });
  });

  it("allows a product-scoped Graceward Apple session", async () => {
    const boundary = await validateSessionProductBoundary(
      makeSession({
        app_metadata: {
          provider: "apple",
          apple_audience: "com.darrylgraham.graceward",
        },
      }),
    );

    expect(boundary).toMatchObject({
      allowed: true,
      actualProductMode: "graceward",
      reason: "trusted_binding",
    });
  });

  it("fails closed for an unscoped Apple web OAuth session in Graceward", async () => {
    const boundary = await validateSessionProductBoundary(
      makeSession({
        app_metadata: { provider: "apple" },
      }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      actualProductMode: null,
      reason: "unscoped_apple_session",
    });
  });

  it("fails closed for an unscoped non-Apple session without a data binding", async () => {
    const boundary = await validateSessionProductBoundary(
      makeSession({
        app_metadata: { provider: "email" },
      }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      reason: "unscoped_non_apple_session",
    });
  });

  it("fails closed when the companion product lookup returns an error", async () => {
    mocks.companionMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const boundary = await validateSessionProductBoundary(
      makeSession({ app_metadata: { provider: "apple" } }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      actualProductMode: null,
      reason: "boundary_lookup_failed",
    });
    expect(mocks.profileMaybeSingle).not.toHaveBeenCalled();
  });

  it("fails closed when the profile product lookup throws", async () => {
    mocks.profileMaybeSingle.mockRejectedValue(new Error("network unavailable"));

    const boundary = await validateSessionProductBoundary(
      makeSession({ app_metadata: { provider: "apple" } }),
    );

    expect(boundary).toMatchObject({
      allowed: false,
      actualProductMode: null,
      reason: "boundary_lookup_failed",
    });
  });
});
