import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioAnalyserReturn {
  audioLevels: number[];
  startAnalysing: (stream?: MediaStream) => Promise<void>;
  stopAnalysing: () => void;
  isAnalysing: boolean;
}

export function useAudioAnalyser(barCount: number = 5): UseAudioAnalyserReturn {
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(barCount).fill(4));
  const [isAnalysing, setIsAnalysing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAnalysing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setIsAnalysing(false);
    setAudioLevels(Array(barCount).fill(4));
  }, [barCount]);

  const startAnalysing = useCallback(async (existingStream?: MediaStream) => {
    try {
      // Get or use existing stream
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      
      // Create analyser
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Connect stream to analyser
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      setIsAnalysing(true);
      
      // Animation loop to read frequency data
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const animate = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Sample frequencies to create bar heights
        const step = Math.floor(bufferLength / barCount);
        const newLevels = Array(barCount).fill(0).map((_, i) => {
          const start = i * step;
          const end = start + step;
          let sum = 0;
          for (let j = start; j < end && j < bufferLength; j++) {
            sum += dataArray[j];
          }
          const avg = sum / step;
          // Map 0-255 to 4-24 pixels with more sensitivity
          return Math.max(4, Math.min(24, 4 + (avg / 255) * 24));
        });
        
        setAudioLevels(newLevels);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      
      animate();
    } catch (error) {
      console.error('Failed to start audio analyser:', error);
      stopAnalysing();
    }
  }, [barCount, stopAnalysing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysing();
    };
  }, [stopAnalysing]);

  return {
    audioLevels,
    startAnalysing,
    stopAnalysing,
    isAnalysing,
  };
}
