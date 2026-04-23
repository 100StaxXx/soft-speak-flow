import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateLegacyTraitQueries } from "@/lib/legacyTraitQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("legacyTraitQueryCache", () => {
  it("invalidates current and inheritable legacy trait queries through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateLegacyTraitQueries(queryClient, {
      userId: "user-1",
      includeCurrentAll: true,
      includeCurrentDetail: true,
      includeInheritableAll: true,
      includeInheritableDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.legacyTraits.currentAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.legacyTraits.current("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.legacyTraits.inheritableAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.legacyTraits.inheritable("user-1"),
    });
  });
});
