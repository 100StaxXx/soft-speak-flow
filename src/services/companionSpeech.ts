import { supabase } from "@/integrations/supabase/client";
import { createIOSOptimizedAudio, safePlay } from "@/utils/iosAudio";

export type CompanionSpeechProvider = "device" | "cloud" | "none";

export interface CompanionSpeechRequest {
  text: string;
  companionId: string;
  voiceStyle?: string | null;
  sessionId?: string | null;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;

const LOCAL_SPEECH_TIMEOUT_MS = 12_000;

const canUseSpeechSynthesis = () =>
  typeof window !== "undefined"
  && "speechSynthesis" in window
  && typeof window.SpeechSynthesisUtterance !== "undefined";

const normalizeStyle = (voiceStyle?: string | null) => (voiceStyle ?? "").trim().toLowerCase();
const hasStyleKeyword = (voiceStyle: string, keywords: string[]) =>
  keywords.some((keyword) => voiceStyle.includes(keyword));

const pickDeviceVoice = (voiceStyle?: string | null) => {
  if (!canUseSpeechSynthesis()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const normalizedStyle = normalizeStyle(voiceStyle);
  const preferredKeywords = hasStyleKeyword(normalizedStyle, ["gritty", "streetwise", "raspy", "shadow", "deep"])
    ? ["daniel", "fred", "alex", "tom", "aaron", "jorge", "david"]
    : normalizedStyle.includes("playful")
    ? ["female", "samantha", "victoria", "ava", "serena"]
    : normalizedStyle.includes("wise") || normalizedStyle.includes("grounded")
      ? ["daniel", "fred", "alex", "tom", "aaron"]
      : ["ava", "samantha", "allison", "serena", "alex"];

  const lowerVoices = voices.map((voice) => ({
    voice,
    haystack: `${voice.name} ${voice.lang}`.toLowerCase(),
  }));

  for (const keyword of preferredKeywords) {
    const match = lowerVoices.find((entry) => entry.haystack.includes(keyword));
    if (match) return match.voice;
  }

  return lowerVoices.find((entry) => entry.voice.lang.toLowerCase().startsWith("en"))?.voice ?? voices[0];
};

const applyVoiceStyle = (
  utterance: SpeechSynthesisUtterance,
  voiceStyle?: string | null,
) => {
  const normalizedStyle = normalizeStyle(voiceStyle);
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.lang = "en-US";

  if (hasStyleKeyword(normalizedStyle, ["gritty", "streetwise", "raspy", "shadow"])) {
    utterance.rate = 0.9;
    utterance.pitch = 0.86;
  } else if (normalizedStyle.includes("playful") || normalizedStyle.includes("bright")) {
    utterance.rate = 1.03;
    utterance.pitch = 1.12;
  } else if (normalizedStyle.includes("calm") || normalizedStyle.includes("gentle")) {
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
  } else if (normalizedStyle.includes("grounded") || normalizedStyle.includes("deep")) {
    utterance.rate = 0.92;
    utterance.pitch = 0.92;
  }

  const voice = pickDeviceVoice(voiceStyle);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
};

const decodeBase64Audio = (base64Audio: string, contentType: string) => {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
};

export const stopCompanionSpeech = () => {
  if (canUseSpeechSynthesis()) {
    window.speechSynthesis.cancel();
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }

  activeUtterance = null;
};

async function speakOnDevice(request: CompanionSpeechRequest): Promise<CompanionSpeechProvider> {
  if (!canUseSpeechSynthesis()) {
    throw new Error("Speech synthesis is not available on this device.");
  }

  stopCompanionSpeech();

  const utterance = new window.SpeechSynthesisUtterance(request.text);
  applyVoiceStyle(utterance, request.voiceStyle);
  activeUtterance = utterance;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Device speech timed out."));
    }, LOCAL_SPEECH_TIMEOUT_MS);

    utterance.onend = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    utterance.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Device speech failed."));
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });

  activeUtterance = null;
  return "device";
}

async function speakWithCloudFallback(request: CompanionSpeechRequest): Promise<CompanionSpeechProvider> {
  stopCompanionSpeech();

  const { data, error } = await supabase.functions.invoke("generate-companion-tts", {
    body: {
      text: request.text,
      companionId: request.companionId,
      voiceStyle: request.voiceStyle ?? null,
      sessionId: request.sessionId ?? null,
    },
  });

  if (error) {
    throw error;
  }

  const audioContent = typeof data?.audioContent === "string" ? data.audioContent : "";
  const contentType = typeof data?.contentType === "string" ? data.contentType : "audio/mpeg";
  if (!audioContent) {
    throw new Error("Cloud speech response did not include audio.");
  }

  const blob = decodeBase64Audio(audioContent, contentType);
  const objectUrl = URL.createObjectURL(blob);
  const audio = createIOSOptimizedAudio(objectUrl);
  activeAudio = audio;

  try {
    const played = await safePlay(audio);
    if (!played) {
      throw new Error("Cloud audio playback was blocked.");
    }

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Cloud audio playback failed."));
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
    if (activeAudio === audio) {
      activeAudio = null;
    }
  }

  return "cloud";
}

export const speakCompanionReply = async (
  request: CompanionSpeechRequest,
): Promise<CompanionSpeechProvider> => {
  try {
    return await speakOnDevice(request);
  } catch (deviceError) {
    console.warn("Companion device speech failed, falling back to cloud TTS.", deviceError);
    return speakWithCloudFallback(request);
  }
};

export const isDeviceSpeechSupported = () => canUseSpeechSynthesis();
