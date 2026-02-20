import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_SIZES,
  resolveImageSize,
} from "../../supabase/functions/_shared/aiClient.ts";

describe("aiClient image size normalization", () => {
  it("accepts allowlisted image sizes", () => {
    for (const size of ALLOWED_IMAGE_SIZES) {
      expect(resolveImageSize(size, "1536x1024")).toBe(size);
    }
  });

  it("falls back when image size is missing or invalid", () => {
    expect(resolveImageSize(undefined, "1536x1024")).toBe("1536x1024");
    expect(resolveImageSize("2048x2048", "1024x1024")).toBe("1024x1024");
    expect(resolveImageSize("garbage", "1024x1024")).toBe("1024x1024");
  });

  it("returns null when caller requests nullable fallback", () => {
    expect(resolveImageSize("invalid", null)).toBeNull();
  });
});
