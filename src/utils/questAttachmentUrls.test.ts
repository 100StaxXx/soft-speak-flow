import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: null }, error: null }),
      }),
    },
  },
}));

import { extractQuestAttachmentFilePath } from "./questAttachmentUrls";

describe("extractQuestAttachmentFilePath", () => {
  it("returns raw storage paths unchanged", () => {
    expect(extractQuestAttachmentFilePath("user-1/quest.png")).toBe("user-1/quest.png");
  });

  it("extracts signed quest attachment paths", () => {
    expect(
      extractQuestAttachmentFilePath(
        "https://example.supabase.co/storage/v1/object/sign/quest-attachments/user-1%2Fquest.png?token=abc",
      ),
    ).toBe("user-1/quest.png");
  });

  it("extracts public quest attachment paths", () => {
    expect(
      extractQuestAttachmentFilePath(
        "https://example.supabase.co/storage/v1/object/public/quest-attachments/user-1/manual.pdf",
      ),
    ).toBe("user-1/manual.pdf");
  });
});
