function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("generate-journey-path stores user-scoped cache rows and storage keys", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assert(
    source.includes('onConflict: "epic_id,user_id,milestone_index"'),
    "Expected journey path cache writes to be scoped by user",
  );
  assert(
    source.includes('const fileName = `${userId}/${epicId}/${milestoneIndex}_${Date.now()}.png`;'),
    "Expected journey path uploads to be prefixed by user id",
  );
  assert(
    source.includes('image_size: JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE'),
    "Expected journey path generation to request the landscape image size",
  );
  assert(
    source.includes('render_version: JOURNEY_PATH_RENDER_VERSION'),
    "Expected journey path prompt context to store a render version",
  );
  assert(
    !source.includes("requestPayload.userId"),
    "Expected the function to stop trusting caller-supplied userId values",
  );
});
