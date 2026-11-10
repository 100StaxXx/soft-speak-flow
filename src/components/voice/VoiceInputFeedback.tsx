import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VoiceInputState } from '@/hooks/useVoiceInput';
import './voiceInput.css';

type Props = {
  state?: VoiceInputState; audioLevel?: number; elapsedSeconds?: number; transcript?: string;
  onStop: () => void; onCancel: () => void; onSend?: () => void; sendDisabled?: boolean;
};
export function VoiceInputFeedback({ state = 'idle', audioLevel = 0, elapsedSeconds = 0, transcript = '', onStop, onCancel, onSend, sendDisabled = false }: Props) {
  const levelRef = useRef(audioLevel); levelRef.current = audioLevel;
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0));
  useEffect(() => {
    if (state !== 'listening') { setLevels(Array(24).fill(0)); return; }
    const timer = setInterval(() => setLevels(values => [...values.slice(1), levelRef.current]), 75);
    return () => clearInterval(timer);
  }, [state]);
  if (state === 'idle') return null;
  const label = state === 'starting' ? 'Connecting microphone…' : state === 'stopping' ? 'Finishing your words…' : 'Listening';
  return <section className="voice-input-feedback" aria-label="Voice input">
    <div className="voice-input-controls">
      <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X size={22}/></Button>
      <div className="voice-input-wave" aria-hidden="true">{levels.map((level, index) => <span key={index} style={{ height: `${3 + level * 29}px` }}/>)}</div>
      <Button type="button" variant="ghost" size="icon" aria-label="Stop recording" disabled={state !== 'listening'} onClick={onStop}>{state === 'listening' ? <Square size={16} fill="currentColor"/> : <Loader2 size={18} className="animate-spin motion-reduce:animate-none"/>}</Button>
      {onSend && <Button type="button" size="icon" className="voice-input-send" aria-label="Send answer" disabled={state !== 'listening' || !transcript.trim() || sendDisabled} onClick={onSend}><ArrowUp size={24}/></Button>}
    </div>
    <div className="voice-input-feedback-header"><span role="status">{label}</span><span className="voice-input-time" aria-label={`${elapsedSeconds} seconds recorded`}>{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')} / 1:00</span></div>
    {transcript && <p className="voice-input-transcript">{transcript}</p>}
  </section>;
}
