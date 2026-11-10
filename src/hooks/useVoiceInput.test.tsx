import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceInput } from './useVoiceInput';
import type { VoiceCaptureEvent } from '@/services/voiceCapture';
const mocks = vi.hoisted(() => ({ supported: true, captures: [] as { emit: (event: VoiceCaptureEvent) => void; stop: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }[] }));
vi.mock('@/services/voiceCapture', () => ({
  supportsVoiceCapture: () => mocks.supported,
  createVoiceCapture: (_language: string, emit: (event: VoiceCaptureEvent) => void) => {
    const capture = { emit, stop: vi.fn(), cancel: vi.fn() }; mocks.captures.push(capture); return capture;
  },
}));
const emit = (event: VoiceCaptureEvent, index = 0) => act(() => mocks.captures[index].emit(event));
beforeEach(() => { vi.useFakeTimers(); mocks.supported = true; mocks.captures = []; });
afterEach(() => { vi.useRealTimers(); });
describe('voice input lifecycle', () => {
  it('replaces revised live words and commits the complete utterance once, including final words after Done', () => {
    const final = vi.fn(); const { result } = renderHook(() => useVoiceInput({ onFinalResult: final }));
    act(() => result.current.startRecording()); emit({ type: 'started' });
    emit({ type: 'transcript', text: 'appointment at ten' });
    emit({ type: 'transcript', text: 'appointment at ten with Cynthia' });
    expect(result.current.transcript).toBe('appointment at ten with Cynthia'); expect(final).not.toHaveBeenCalled();
    act(() => result.current.stopRecording()); expect(result.current.state).toBe('stopping');
    emit({ type: 'transcript', text: 'Appointment at ten with Cynthia. Remind me one hour before.' });
    emit({ type: 'ended' }); emit({ type: 'ended' });
    expect(final).toHaveBeenCalledExactlyOnceWith('Appointment at ten with Cynthia. Remind me one hour before.');
    expect(result.current.state).toBe('idle'); expect(mocks.captures[0].cancel).toHaveBeenCalled();
  });
  it('uses current callbacks after re-render without restarting capture', () => {
    const old = vi.fn(), current = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useVoiceInput({ onFinalResult: cb }), { initialProps: { cb: old } });
    act(() => result.current.startRecording()); emit({ type: 'started' }); rerender({ cb: current });
    emit({ type: 'transcript', text: 'Read tomorrow' }); emit({ type: 'ended' });
    expect(old).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledWith('Read tomorrow'); expect(mocks.captures).toHaveLength(1);
  });
  it('guards rapid taps and cancellation during permission, ignoring all late results', () => {
    const final = vi.fn(); const { result } = renderHook(() => useVoiceInput({ onFinalResult: final }));
    act(() => { result.current.startRecording(); result.current.startRecording(); });
    expect(mocks.captures).toHaveLength(1);
    act(() => result.current.toggleRecording());
    emit({ type: 'started' }); emit({ type: 'transcript', text: 'stale words' }); emit({ type: 'ended' });
    expect(result.current.state).toBe('idle'); expect(final).not.toHaveBeenCalled();
    act(() => result.current.startRecording()); emit({ type: 'started' }, 1);
    expect(result.current.state).toBe('listening');
  });
  it('Cancel discards this recording and cannot leak words into the next one', () => {
    const final = vi.fn(); const { result } = renderHook(() => useVoiceInput({ onFinalResult: final }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'discard' });
    act(() => result.current.cancelRecording()); act(() => result.current.startRecording());
    emit({ type: 'transcript', text: 'late discard' }); emit({ type: 'started' }, 1); emit({ type: 'transcript', text: 'keep' }, 1); emit({ type: 'ended' }, 1);
    expect(final).toHaveBeenCalledExactlyOnceWith('keep');
  });
  it('allows a thinking pause with manual stop, but bounds recording to one minute', () => {
    const { result } = renderHook(() => useVoiceInput({ autoStopOnSilence: false }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'I want to' });
    act(() => vi.advanceTimersByTime(9000)); expect(result.current.state).toBe('listening');
    act(() => vi.advanceTimersByTime(51000)); expect(result.current.state).toBe('stopping'); expect(mocks.captures[0].stop).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(5000)); expect(result.current.state).toBe('idle');
  });
  it('times out silence with actionable feedback and allows retry', () => {
    const error = vi.fn(); const { result } = renderHook(() => useVoiceInput({ onError: error }));
    act(() => result.current.startRecording()); emit({ type: 'started' });
    act(() => vi.advanceTimersByTime(15000));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('didn’t catch')); expect(result.current.state).toBe('idle');
    act(() => result.current.startRecording()); expect(mocks.captures).toHaveLength(2);
  });
  it('keeps live text on connection failure, reports denial clearly, and avoids duplicate no-speech errors', () => {
    const final = vi.fn(), error = vi.fn(), permission = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onFinalResult: final, onError: error, onPermissionNeeded: permission }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'walk dog at seven' });
    emit({ type: 'error', code: 'network' }); emit({ type: 'ended' }); expect(final).toHaveBeenCalledWith('walk dog at seven');
    act(() => result.current.startRecording()); emit({ type: 'error', code: 'not-allowed' }, 1); emit({ type: 'ended' }, 1);
    expect(permission).toHaveBeenCalledOnce(); expect(error).toHaveBeenCalledTimes(2); expect(result.current.permissionStatus).toBe('denied');
  });
  it('cleans up pending timers and ignores results after unmount', () => {
    const final = vi.fn(); const { result, unmount } = renderHook(() => useVoiceInput({ onFinalResult: final }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); unmount();
    emit({ type: 'transcript', text: 'late' }); emit({ type: 'ended' }); act(() => vi.advanceTimersByTime(60000));
    expect(final).not.toHaveBeenCalled(); expect(mocks.captures[0].cancel).toHaveBeenCalledOnce();
  });
  it('releases the previous field before another field takes the microphone', () => {
    const final = vi.fn(); const first = renderHook(() => useVoiceInput({ onFinalResult: final })), second = renderHook(() => useVoiceInput());
    act(() => first.result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'first field' });
    first.rerender(); act(() => second.result.current.startRecording());
    expect(first.result.current.state).toBe('idle'); expect(final).toHaveBeenCalledWith('first field'); expect(mocks.captures[0].cancel).toHaveBeenCalledOnce();
  });
  it('keeps draft words when backgrounded and reports unsupported capture without opening a mic', () => {
    const final = vi.fn(); const { result } = renderHook(() => useVoiceInput({ onFinalResult: final }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'Read chapter five' });
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(final).toHaveBeenCalledWith('Read chapter five'); expect(result.current.state).toBe('idle'); hidden.mockRestore();
    mocks.supported = false; act(() => result.current.startRecording()); expect(mocks.captures).toHaveLength(1);
  });
  it('uses actual microphone activity to avoid stopping mid-speech while recognition is delayed', () => {
    const { result } = renderHook(() => useVoiceInput({ silenceTimeoutMs: 2500 }));
    act(() => result.current.startRecording()); emit({ type: 'started' }); emit({ type: 'transcript', text: 'appointment' });
    act(() => vi.advanceTimersByTime(2000)); emit({ type: 'level', level: .6 });
    act(() => vi.advanceTimersByTime(2000)); expect(result.current.state).toBe('listening'); expect(result.current.audioLevel).toBe(.6);
    act(() => vi.advanceTimersByTime(600)); expect(result.current.state).toBe('stopping');
  });
});

it('bounds microphone setup and keeps the latest words if the provider never finishes', () => {
 const final=vi.fn(), error=vi.fn(); const {result}=renderHook(()=>useVoiceInput({onFinalResult:final,onError:error}));
 act(()=>result.current.startRecording()); act(()=>vi.advanceTimersByTime(30000));
 expect(result.current.state).toBe('idle'); expect(error).toHaveBeenCalledWith(expect.stringContaining('took too long'));
 act(()=>result.current.startRecording()); emit({type:'started'},1); emit({type:'transcript',text:'Keep these last words'},1);
 act(()=>result.current.stopRecording()); act(()=>vi.advanceTimersByTime(5000));
 expect(final).toHaveBeenCalledExactlyOnceWith('Keep these last words'); expect(result.current.state).toBe('idle');
});

it('keeps listening when speech arrives before the recognizer produces its first words', () => {
 const final=vi.fn(), error=vi.fn(); const {result}=renderHook(()=>useVoiceInput({autoStopOnSilence:false,onFinalResult:final,onError:error}));
 act(()=>result.current.startRecording()); emit({type:'started'});
 for(let n=0;n<6;n++){act(()=>vi.advanceTimersByTime(2000));emit({type:'level',level:.5});}
 expect(result.current.state).toBe('listening');expect(error).not.toHaveBeenCalled();
 act(()=>result.current.stopRecording());act(()=>vi.advanceTimersByTime(3000));
 emit({type:'transcript',text:'Tomorrow at seven'});emit({type:'ended'});
 expect(final).toHaveBeenCalledExactlyOnceWith('Tomorrow at seven');expect(error).not.toHaveBeenCalled();
});

it.each(['', '   '])('keeps captured words when Done is followed by an empty final transcript (%j)', empty => {
 const final=vi.fn(), error=vi.fn(); const {result}=renderHook(()=>useVoiceInput({onFinalResult:final,onError:error}));
 act(()=>result.current.startRecording());emit({type:'started'});emit({type:'transcript',text:'Seven tomorrow evening'});
 act(()=>result.current.stopRecording());emit({type:'transcript',text:empty});emit({type:'ended'});
 expect(final).toHaveBeenCalledExactlyOnceWith('Seven tomorrow evening');expect(error).not.toHaveBeenCalled();
});
it('does not show a no-speech error after Done when words were already captured', () => {
 const final=vi.fn(), error=vi.fn(); const {result}=renderHook(()=>useVoiceInput({onFinalResult:final,onError:error}));
 act(()=>result.current.startRecording());emit({type:'started'});emit({type:'transcript',text:'Read at seven'});
 act(()=>result.current.stopRecording());emit({type:'error',code:'no-speech'});emit({type:'ended'});
 expect(final).toHaveBeenCalledExactlyOnceWith('Read at seven');expect(error).not.toHaveBeenCalled();
});

it('finalizes Send once, including late words, and cancels pending submission on capture failure',()=>{
 const final=vi.fn();const {result}=renderHook(()=>useVoiceInput({onFinalResult:final}));
 act(()=>result.current.startRecording());emit({type:'started'});emit({type:'transcript',text:'Read'});
 act(()=>{result.current.submitRecording();result.current.submitRecording();});
 emit({type:'transcript',text:'Read twenty pages'});emit({type:'ended'});
 expect(final).toHaveBeenCalledExactlyOnceWith('Read twenty pages',true);
 final.mockClear();act(()=>result.current.startRecording());emit({type:'started'},1);emit({type:'transcript',text:'Keep as draft'},1);
 act(()=>result.current.submitRecording());emit({type:'error',code:'network'},1);emit({type:'ended'},1);
 expect(final).toHaveBeenCalledExactlyOnceWith('Keep as draft');
});
it('does not leak a cancelled Send into the next recording and handles synchronous capture completion',()=>{
 const final=vi.fn();const {result}=renderHook(()=>useVoiceInput({onFinalResult:final}));
 act(()=>result.current.startRecording());emit({type:'started'});emit({type:'transcript',text:'Discard'});
 act(()=>{result.current.submitRecording();result.current.cancelRecording();});emit({type:'ended'});expect(final).not.toHaveBeenCalled();
 act(()=>result.current.startRecording());emit({type:'started'},1);emit({type:'transcript',text:'Keep'},1);
 mocks.captures[1].stop.mockImplementation(()=>mocks.captures[1].emit({type:'ended'}));
 act(()=>result.current.stopRecording());act(()=>vi.advanceTimersByTime(5000));
 expect(final).toHaveBeenCalledExactlyOnceWith('Keep');expect(result.current.state).toBe('idle');
});
