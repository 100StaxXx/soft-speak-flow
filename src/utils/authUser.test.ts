import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getAuthUserAccountEmail, getAuthUserProductMode } from "./authUser";

const makeUser = (overrides: Partial<User>): User => ({
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-08-18T00:00:00.000Z",
  ...overrides,
});

describe("auth user product identity", () => {
  it("shows the real Apple email instead of a product-scoped internal auth email", () => {
    const user = makeUser({
      email: "apple-hash@accounts.graceward.app",
      app_metadata: {
        account_email: "Person@Example.com",
        auth_product_mode: "graceward",
      },
      user_metadata: {
        account_email: "tampered@example.com",
        auth_product_mode: "cosmiq",
      },
    });

    expect(getAuthUserAccountEmail(user)).toBe("person@example.com");
    expect(getAuthUserProductMode(user)).toBe("graceward");
  });

  it("derives a trusted product binding from the Apple audience", () => {
    const user = makeUser({
      app_metadata: { apple_audience: "com.darrylgraham.revolution" },
      user_metadata: { auth_product_mode: "graceward" },
    });

    expect(getAuthUserProductMode(user)).toBe("cosmiq");
  });

  it("falls back to the Supabase email for legacy users", () => {
    const user = makeUser({ email: "Legacy@Example.com" });

    expect(getAuthUserAccountEmail(user)).toBe("legacy@example.com");
    expect(getAuthUserProductMode(user)).toBeNull();
  });
});
