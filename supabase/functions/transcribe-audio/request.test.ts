import {
  buildForcedAlignmentFormData,
  buildTranscriptionFormData,
  DEFAULT_TRANSCRIPTION_LANGUAGE,
} from "./request.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("buildTranscriptionFormData includes English language hint", () => {
  const audioBlob = new Blob(["fake audio"], { type: "audio/mpeg" });
  const formData = buildTranscriptionFormData(audioBlob);

  assert(formData.get("model") === "whisper-1", "Expected whisper-1 model");
  assert(
    formData.get("timestamp_granularities[]") === "word",
    "Expected word timestamp granularity",
  );
  assert(
    formData.get("language") === DEFAULT_TRANSCRIPTION_LANGUAGE,
    "Expected English transcription language hint",
  );

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Expected file field to be a File");
  }
  assert(file.name === "audio.mp3", `Expected default filename audio.mp3, got ${file.name}`);
});

Deno.test("buildForcedAlignmentFormData includes the known script", () => {
  const audioBlob = new Blob(["fake audio"], { type: "audio/mpeg" });
  const formData = buildForcedAlignmentFormData(audioBlob, "Be still.");

  assert(formData.get("text") === "Be still.", "Expected exact script for forced alignment");
  const file = formData.get("file");
  assert(file instanceof File && file.name === "audio.mp3", "Expected MP3 file field");
});
