import { useState, useRef, useCallback, useEffect } from 'react';
import type { PermissionStatus } from './useMicrophonePermission';
import { createVoiceCapture, supportsVoiceCapture, requestVoicePermission, type VoiceCapture } from '@/services/voiceCapture';

export type VoiceInputState = 'idle' | 'starting' | 'listening' | 'stopping';
interface UseVoiceInputOptions {
  onInterimResult?: (text: string) => void;
  /** Called once per recording, after the last words have been finalized. */
  onFinalResult?: (text: string, submitRequested?: boolean) => void;
  onError?: (error: string) => void;
  onPermissionNeeded?: () => void;
  onAutoStopping?: () => void;
  language?: string;
  autoStopOnSilence?: boolean;
  silenceTimeoutMs?: number;
}
const errors: Record<string, string> = {
  'not-allowed': 'Allow microphone and speech recognition access in Settings to use voice input.',
  'service-not-allowed': 'Speech recognition is unavailable. Check speech recognition permissions in Settings.',
  'no-speech': 'I didn’t catch any speech. Tap the microphone to try again.',
  'audio-capture': 'Your microphone is unavailable. Check your audio connection and try again.',
  'network': 'Dictation lost its connection. Your captured words are kept below; you can edit them or try again.',
  'interrupted': 'Recording was interrupted. Your captured words are kept below.',
  'unsupported': 'Voice input is unavailable on this device. You can still type your request.',
};
// Only one voice field may own the microphone, even across mounted sheets.
let releaseActiveCapture: (() => void) | undefined;
export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const optionsRef = useRef(options); optionsRef.current = options;
  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAutoStopping, setAutoStopping] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const stateRef = useRef<VoiceInputState>('idle');
  const capture = useRef<VoiceCapture>();
  const generation = useRef(0), text = useRef(''), startedAt = useRef(0), lastActivity = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval>>(), deadline = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true), hadError = useRef(false), submitRequested = useRef(false);
  const isSupported = supportsVoiceCapture();
  const changeState = useCallback((value: VoiceInputState) => { stateRef.current = value; if (mounted.current) setState(value); }, []);
  const finish = useCallback((commit: boolean) => {
    if (stateRef.current === 'idle') return;
    generation.current++;
    const shouldSubmit = commit && submitRequested.current && !hadError.current;
    submitRequested.current = false;
    clearInterval(timer.current); clearTimeout(deadline.current);
    capture.current?.cancel(); capture.current = undefined;
    if (releaseActiveCapture === releaseRef.current) releaseActiveCapture = undefined;
    changeState('idle');
    if (mounted.current) {
      setAudioLevel(0); setAutoStopping(false); setTranscript('');
      optionsRef.current.onInterimResult?.('');
      if (commit && text.current.trim()) {
        if (shouldSubmit) optionsRef.current.onFinalResult?.(text.current.trim(), true);
        else optionsRef.current.onFinalResult?.(text.current.trim());
      }
      else if (commit && !hadError.current) optionsRef.current.onError?.(errors['no-speech']);
    }
    text.current = '';
  }, [changeState]);
  const releaseRef = useRef<() => void>(() => {});
  const cancelRecording = useCallback(() => finish(false), [finish]);
  const stopRecording = useCallback(() => {
    if (stateRef.current === 'starting') { finish(false); return; }
    if (stateRef.current !== 'listening') return;
    changeState('stopping'); clearInterval(timer.current);
    // Keep a bounded finalization window so stopping never hangs or drops interim text.
    clearTimeout(deadline.current);
    deadline.current = setTimeout(() => finish(true), 5000);
    capture.current?.stop();
  }, [changeState, finish]);
  const submitRecording = useCallback(() => {
    if (stateRef.current !== 'listening') return;
    submitRequested.current = true;
    stopRecording();
  }, [stopRecording]);
  const startRecording = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    if (!supportsVoiceCapture()) { optionsRef.current.onError?.(errors.unsupported); return; }
    releaseActiveCapture?.();
    const release = () => finish(true); releaseRef.current = release; releaseActiveCapture = release;
    const session = ++generation.current;
    text.current = ''; hadError.current = false; submitRequested.current = false;
    setTranscript(''); setElapsedSeconds(0); setAudioLevel(0); setAutoStopping(false);
    optionsRef.current.onInterimResult?.(''); changeState('starting');
    deadline.current = setTimeout(() => {
      hadError.current = true; optionsRef.current.onError?.('Microphone setup took too long. Please try again.'); finish(false);
    }, 30000);
    capture.current = createVoiceCapture(optionsRef.current.language || navigator.language || 'en-US', event => {
      if (!mounted.current || generation.current !== session) return;
      if (event.type === 'started') {
        clearTimeout(deadline.current); changeState('listening'); setPermissionStatus('granted');
        startedAt.current = lastActivity.current = Date.now();
        timer.current = setInterval(() => {
          const now = Date.now(), elapsed = now - startedAt.current;
          setElapsedSeconds(Math.floor(elapsed / 1000));
          const silence = Math.max(2500, optionsRef.current.silenceTimeoutMs ?? 3500);
          if (elapsed >= 60000 || (!text.current && now - lastActivity.current >= 10000) ||
            (optionsRef.current.autoStopOnSilence !== false && !!text.current && now - lastActivity.current >= silence)) {
            setAutoStopping(true); optionsRef.current.onAutoStopping?.(); stopRecording();
          }
        }, 200);
      } else if (event.type === 'transcript') {
        // Some recognizers emit an empty final result after Done. It is not
        // a user edit and must never erase words already shown in the draft.
        if (!event.text.trim()) return;
        if (event.text !== text.current) lastActivity.current = Date.now();
        text.current = event.text; setTranscript(event.text); optionsRef.current.onInterimResult?.(event.text);
      } else if (event.type === 'level') {
        const level = Number.isFinite(event.level) ? Math.max(0, Math.min(1, event.level)) : 0;
        setAudioLevel(level);
        if (level > .09) lastActivity.current = Date.now();
      } else if (event.type === 'error') {
        // A late no-speech result describes the final chunk, not the whole
        // recording. Preserve and commit the transcript we already received.
        if (event.code === 'no-speech' && text.current.trim()) return;
        hadError.current = true;
        if (event.code === 'not-allowed' || event.code === 'service-not-allowed') {
          setPermissionStatus('denied'); optionsRef.current.onPermissionNeeded?.();
        }
        optionsRef.current.onError?.(errors[event.code] || 'Voice input stopped. Check the captured text and try again.');
      } else if (event.type === 'ended') finish(true);
    });
  }, [changeState, finish, stopRecording]);
  const toggleRecording = useCallback(() => {
    if (stateRef.current === 'idle') startRecording(); else stopRecording();
  }, [startRecording, stopRecording]);
  useEffect(() => {
    mounted.current = true;
    const hide = () => { if (document.hidden) finish(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { mounted.current = false; finish(false); document.removeEventListener('visibilitychange', hide); };
  }, [finish]);
  const requestPermission = useCallback(async () => {
    const status = await requestVoicePermission();
    if (mounted.current) setPermissionStatus(status);
    return status;
  }, []);
  return { requestPermission, state, isRecording: state !== 'idle', isAutoStopping, isSupported, permissionStatus,
    transcript, audioLevel, elapsedSeconds, startRecording, stopRecording, submitRecording, cancelRecording, toggleRecording };
}
