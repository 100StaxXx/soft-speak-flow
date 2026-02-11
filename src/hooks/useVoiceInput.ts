import { useState, useRef, useCallback, useEffect } from 'react';
import { useMicrophonePermission, PermissionStatus } from './useMicrophonePermission';

// Web Speech API types (not globally available in all TS configs)
interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventType extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEventType extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventType) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventType) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface UseVoiceInputOptions {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
  onPermissionNeeded?: () => void;
  onAutoStopping?: () => void;
  language?: string;
  autoStopOnSilence?: boolean;
  silenceTimeoutMs?: number;
}

interface UseVoiceInputReturn {
  isRecording: boolean;
  isAutoStopping: boolean;
  isSupported: boolean;
  permissionStatus: PermissionStatus;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
  requestPermission: () => Promise<PermissionStatus>;
}

export function useVoiceInput({
  onInterimResult,
  onFinalResult,
  onError,
  onPermissionNeeded,
  onAutoStopping,
  language = 'en-US',
  autoStopOnSilence = true,
  silenceTimeoutMs = 1500,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isAutoStopping, setIsAutoStopping] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { status: permissionStatus, requestPermission, checkPermission } = useMicrophonePermission();
  
  // Check for Web Speech API support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    setIsAutoStopping(false);
  }, []);

  const stopRecording = useCallback(() => {
    clearSilenceTimeout();
    setIsAutoStopping(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }
  }, [clearSilenceTimeout]);

  const createRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (!isSupported) return null;
    
     
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;
    
    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    
    recognition.onresult = (event: SpeechRecognitionEventType) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript && onFinalResult) {
        onFinalResult(finalTranscript);
      }
      if (interimTranscript && onInterimResult) {
        onInterimResult(interimTranscript);
      }

      // Auto-stop on silence: reset timer whenever we get speech
      if (autoStopOnSilence && (interimTranscript || finalTranscript)) {
        clearSilenceTimeout();
        silenceTimeoutRef.current = setTimeout(() => {
          setIsAutoStopping(true);
          onAutoStopping?.();
          // Give a brief moment for UI feedback before stopping
          setTimeout(() => {
            stopRecording();
          }, 300);
        }, silenceTimeoutMs);
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
      console.error('Speech recognition error:', event.error);
      clearSilenceTimeout();
      setIsRecording(false);
      
      if (onError) {
        const errorMessages: Record<string, string> = {
          'not-allowed': 'Microphone access denied. Please enable microphone permissions.',
          'no-speech': 'No speech detected. Please try again.',
          'audio-capture': 'No microphone found. Please check your device.',
          'network': 'Network error. Please check your connection.',
        };
        onError(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      clearSilenceTimeout();
      setIsRecording(false);
    };
    
    return recognition;
  }, [isSupported, language, onInterimResult, onFinalResult, onError, autoStopOnSilence, silenceTimeoutMs, clearSilenceTimeout, stopRecording]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    // Check permission status first
    const currentStatus = await checkPermission();
    
    if (currentStatus === 'denied' || currentStatus === 'unsupported') {
      onPermissionNeeded?.();
      return;
    }

    if (currentStatus === 'prompt') {
      // Request permission first
      const newStatus = await requestPermission();
      if (newStatus !== 'granted') {
        onPermissionNeeded?.();
        return;
      }
    }
    
    recognitionRef.current = createRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        onError?.('Failed to start recording. Please try again.');
      }
    }
  }, [isSupported, createRecognition, onError, checkPermission, requestPermission, onPermissionNeeded]);


  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimeout();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [clearSilenceTimeout]);

  return {
    isRecording,
    isAutoStopping,
    isSupported,
    permissionStatus,
    startRecording,
    stopRecording,
    toggleRecording,
    requestPermission,
  };
}
