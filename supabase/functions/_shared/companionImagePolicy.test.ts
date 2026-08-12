import {
  DEFAULT_COMPANION_IMAGE_SIZE,
  resolveCompanionImageSizeForUser,
} from "./companionImagePolicy.ts";

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("companion artwork defaults to the same square canvas as bundled assets", () => {
  const previousRollout = Deno.env.get("COMPANION_IMAGE_FAST_PATH_PERCENT");
  try {
    Deno.env.set("COMPANION_IMAGE_FAST_PATH_PERCENT", "0");
    assertEquals(
      DEFAULT_COMPANION_IMAGE_SIZE,
      "1024x1024",
      "Expected the canonical companion canvas to be square",
    );
    assertEquals(
      resolveCompanionImageSizeForUser("art-contract-test-user"),
      "1024x1024",
      "Expected normal companion generation to use the canonical square canvas",
    );
    assertEquals(
      resolveCompanionImageSizeForUser(
        "art-contract-test-user",
        "1536x1024",
      ),
      "1024x1024",
      "Expected callers to be unable to override the canonical square canvas",
    );
  } finally {
    if (typeof previousRollout === "string") {
      Deno.env.set("COMPANION_IMAGE_FAST_PATH_PERCENT", previousRollout);
    } else {
      Deno.env.delete("COMPANION_IMAGE_FAST_PATH_PERCENT");
    }
  }
});

Deno.test("primary and health-state companion renders use one image provider contract", async () => {
  const functionPaths = [
    "../generate-companion-image/index.ts",
  ];

  for (const functionPath of functionPaths) {
    const source = await Deno.readTextFile(
      new URL(functionPath, import.meta.url),
    );
    if (source.includes("google/gemini-2.5-flash-image-preview")) {
      throw new Error(
        `Expected ${functionPath} to avoid the retired alternate image renderer`,
      );
    }
    if (!source.includes("openaiCompanionImageClient.ts")) {
      throw new Error(
        `Expected ${functionPath} to use the canonical companion image client`,
      );
    }
  }
});
