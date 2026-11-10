// Recording owns the audio session; ambient videos must not restart over it.
export const VOICE_CAPTURE_ACTIVITY = 'cosmiq:voice-capture-activity';
let captures = 0;
export const isVoiceCaptureActive = () => captures > 0;
export function acquireVoiceCaptureActivity() {
  captures++;
  window.dispatchEvent(new Event(VOICE_CAPTURE_ACTIVITY));
  const stopPlayback = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) event.target.pause();
  };
  document.addEventListener('play', stopPlayback, true);
  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(media => media.pause());
  window.dispatchEvent(new Event('cosmiq:stop-story-narration'));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener('play', stopPlayback, true);
    captures--;
    window.dispatchEvent(new Event(VOICE_CAPTURE_ACTIVITY));
  };
}
