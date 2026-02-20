import { describe, expect, it } from "vitest";
import { validateAttachmentFiles } from "./questAttachmentValidation";

const createFile = (name: string, size: number, type: string) =>
  new File([new Uint8Array(size)], name, { type });

describe("validateAttachmentFiles", () => {
  it("accepts exactly 10 files", () => {
    const files = Array.from({ length: 10 }, (_, idx) =>
      createFile(`image-${idx + 1}.png`, 1_024, "image/png"),
    );

    const result = validateAttachmentFiles(files, 0, 10);
    expect(result.accepted).toHaveLength(10);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects the 11th file", () => {
    const files = Array.from({ length: 11 }, (_, idx) =>
      createFile(`image-${idx + 1}.png`, 1_024, "image/png"),
    );

    const result = validateAttachmentFiles(files, 0, 10);
    expect(result.accepted).toHaveLength(10);
    expect(result.errors.join(" ")).toContain("max 10");
  });
});

