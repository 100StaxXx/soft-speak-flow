import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("./product"); vi.resetModules(); });
describe("Graceward Adventure release switch", () => {
  it.each([
    ["christian", "true", true],
    ["christian", "false", false],
    ["cosmiq", "true", false],
  ])("isolates %s with flag %s", async (product, flag, expected) => {
    vi.resetModules(); vi.doMock("./product", () => ({ PRODUCT: { mode: product } })); vi.stubEnv("VITE_GRACEWARD_ADVENTURE", flag);
    expect((await import("./gracewardAdventure")).GRACEWARD_ADVENTURE_ENABLED).toBe(expected);
  });
});
