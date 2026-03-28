export const DEFAULT_TRANSCRIPTION_LANGUAGE = "en";

export function buildTranscriptionFormData(
  audioBlob: Blob,
  fileName = "audio.mp3",
): FormData {
  const formData = new FormData();
  formData.append("file", audioBlob, fileName);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("language", DEFAULT_TRANSCRIPTION_LANGUAGE);
  return formData;
}
