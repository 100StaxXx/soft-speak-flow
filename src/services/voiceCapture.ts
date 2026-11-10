import { acquireVoiceCaptureActivity } from './voiceCaptureActivity';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type VoiceCaptureEvent =
  | { type: 'started' }
  | { type: 'transcript'; text: string }
  | { type: 'level'; level: number }
  | { type: 'ended' }
  | { type: 'error'; code: string };
export interface VoiceCapture { stop(): void; cancel(): void }
interface NativeVoicePlugin {
  requestPermission(): Promise<{ status: 'granted' | 'denied' }>;
  start(options: { sessionId: string; language: string }): Promise<void>;
  stop(options: { sessionId: string; cancel: boolean }): Promise<void>;
  addListener(name: 'voiceInput', listener: (event: VoiceCaptureEvent & { sessionId: string }) => void): Promise<PluginListenerHandle>;
}
let nativePlugin: NativeVoicePlugin | undefined;
const getNativeVoiceInput = () => nativePlugin ??= registerPlugin<NativeVoicePlugin>('NativeVoiceInput');
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type VoiceWindow = Window & { AudioContext?: typeof AudioContext; SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition; webkitAudioContext?: typeof AudioContext };
const isNative = () => Capacitor.getPlatform?.() === 'ios' && Capacitor.isPluginAvailable?.('NativeVoiceInput');
export const supportsVoiceCapture = () => isNative() || (typeof window !== 'undefined' && !!((window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition));

/** One capture session. Cancellation also covers unresolved OS permission prompts. */
export function createVoiceCapture(language: string, onEvent: (event: VoiceCaptureEvent) => void): VoiceCapture {
  let cancelled = false, ended = false;
  const releaseAudio = acquireVoiceCaptureActivity();
  let cleanup = () => {};
  const emit = (event: VoiceCaptureEvent) => {
    if (cancelled || ended) return;
    if (event.type === 'ended') { ended = true; cleanup(); releaseAudio(); }
    onEvent(event);
  };
  if (isNative()) {
    const NativeVoiceInput = getNativeVoiceInput();
    const sessionId = crypto.randomUUID();
    let listener: PluginListenerHandle | undefined;
    cleanup = () => { void listener?.remove(); listener = undefined; };
    void (async () => {
      listener = await NativeVoiceInput.addListener('voiceInput', event => {
        if (event.sessionId === sessionId) emit(event);
      });
      if (cancelled) { cleanup(); releaseAudio(); return; }
      await NativeVoiceInput.start({ sessionId, language });
      if (cancelled) await NativeVoiceInput.stop({ sessionId, cancel: true }).finally(releaseAudio);
    })().catch(error => {
      emit({ type: 'error', code: error?.code || 'start-failed' });
      emit({ type: 'ended' });
      cleanup();
    });
    return {
      stop: () => { void NativeVoiceInput.stop({ sessionId, cancel: false }).catch(() => { emit({ type: 'error', code: 'interrupted' }); emit({ type: 'ended' }); }); },
      cancel: () => { cancelled = true; cleanup(); void NativeVoiceInput.stop({ sessionId, cancel: true }).catch(() => {}).finally(releaseAudio); },
    };
  }

  const win = window as VoiceWindow;
  const API = win.SpeechRecognition || win.webkitSpeechRecognition;
  let recognition: Recognition | undefined, stream: MediaStream | undefined, context: AudioContext | undefined;
  let frame = 0;
  const stopMeter = () => {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    void context?.close().catch(() => {}); context = undefined;
  };
  cleanup = () => {
    stopMeter(); releaseAudio();
    if (recognition) recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
  };
  void (async () => {
    if (!API) throw Object.assign(new Error(), { name: 'unsupported' });
    // Capture once for permission and real input metering. Never save or upload audio ourselves.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (cancelled) { stopMeter(); return; }
    const Context = win.AudioContext || win.webkitAudioContext;
    if (Context) {
      try {
        context = new Context();
        const analyser = context.createAnalyser(); analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        void context.resume().catch(() => {});
        const samples = new Float32Array(analyser.fftSize);
        let previous = 0;
        const meter = (now: number) => {
          if (cancelled || ended) return;
          if (now - previous > 65) {
            previous = now; analyser.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
            emit({ type: 'level', level: Math.min(1, rms * 7) });
          }
          frame = requestAnimationFrame(meter);
        };
        frame = requestAnimationFrame(meter);
      } catch { /* Dictation remains usable when Web Audio metering is unavailable. */ }
    }
    recognition = new API();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = language;
    recognition.onstart = () => emit({ type: 'started' });
    recognition.onresult = event => {
      // The API returns the complete result list, including revised interim words.
      // Replace the draft instead of appending repeated partial phrases.
      emit({ type: 'transcript', text: Array.from(event.results, result => result[0].transcript.trim()).filter(Boolean).join(' ') });
    };
    recognition.onerror = event => { emit({ type: 'error', code: event.error }); emit({ type: 'ended' }); };
    recognition.onend = () => emit({ type: 'ended' });
    recognition.start();
  })().catch(error => {
    emit({ type: 'error', code: error?.name === 'NotAllowedError' ? 'not-allowed' : error?.name === 'NotFoundError' ? 'audio-capture' : error?.name === 'unsupported' ? 'unsupported' : 'start-failed' });
    emit({ type: 'ended' });
  });
  return {
    stop: () => { stopMeter(); try { recognition?.stop(); } catch { emit({ type: 'ended' }); } },
    cancel: () => { cancelled = true; cleanup(); try { recognition?.abort(); } catch { /* Already ended. */ } },
  };
}

export async function requestVoicePermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (isNative()) {
    try { return (await getNativeVoiceInput().requestPermission()).status; } catch { return 'denied'; }
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return 'granted';
  } catch { return 'denied'; }
}
