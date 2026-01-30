import { vi } from "vitest";

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(),
      })),
    })),
  })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));
