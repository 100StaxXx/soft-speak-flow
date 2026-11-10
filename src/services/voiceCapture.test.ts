import { isVoiceCaptureActive } from './voiceCaptureActivity';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  enabled: false, platform: 'web', start: vi.fn(), stop: vi.fn(), addListener: vi.fn(), requestPermission: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform, isPluginAvailable: () => native.enabled },
  registerPlugin: () => native,
}));
import { createVoiceCapture, requestVoicePermission, supportsVoiceCapture, type VoiceCaptureEvent } from './voiceCapture';
class Recognition {
  static instances: Recognition[] = [];
  continuous = false; interimResults = false; lang = '';
  onstart: (() => void) | null = null;
  onresult: ((event: { results: {0:{transcript:string};isFinal:boolean}[] }) => void) | null = null;
  onerror: ((event: {error:string}) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.()); stop = vi.fn(); abort = vi.fn();
  constructor() { Recognition.instances.push(this); }
}
const stopTrack = vi.fn(); const gum = vi.fn();
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.clearAllMocks(); native.enabled = false; native.platform = 'web'; Recognition.instances = [];
  vi.stubGlobal('SpeechRecognition', Recognition);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } });
  gum.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  native.start.mockResolvedValue(undefined); native.stop.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
it('rebuilds the complete revised transcript and frees all tracks/listeners on end', async () => {
  const events: VoiceCaptureEvent[] = []; createVoiceCapture('en-US', event => events.push(event)); await tick();
  const recognition = Recognition.instances[0];
  recognition.onresult?.({ results: [{0:{transcript:'Meet Cynthia'},isFinal:true},{0:{transcript:'at nine'},isFinal:false}] });
  recognition.onresult?.({ results: [{0:{transcript:'Meet Cynthia'},isFinal:true},{0:{transcript:'at ten'},isFinal:true}] });
  expect(events.filter(event => event.type === 'transcript')).toEqual([{type:'transcript',text:'Meet Cynthia at nine'},{type:'transcript',text:'Meet Cynthia at ten'}]);
  recognition.onend?.(); expect(stopTrack).toHaveBeenCalledOnce(); expect(recognition.onresult).toBeNull();
});
it('cancels an unresolved microphone permission prompt and stops late-acquired tracks', async () => {
  let resolve!: (stream: unknown) => void; gum.mockReturnValue(new Promise(done => { resolve = done; }));
  const events = vi.fn(); const capture = createVoiceCapture('en-US', events); capture.cancel();
  resolve({ getTracks: () => [{ stop: stopTrack }] }); await tick();
  expect(stopTrack).toHaveBeenCalledOnce(); expect(Recognition.instances).toHaveLength(0); expect(events).not.toHaveBeenCalled();
});
it('distinguishes permission denial from silent input and ends cleanly', async () => {
  gum.mockRejectedValue(Object.assign(new Error(),{name:'NotAllowedError'})); const events = vi.fn();
  createVoiceCapture('en-US', events); await tick();
  expect(events.mock.calls.map(call => call[0])).toEqual([{type:'error',code:'not-allowed'},{type:'ended'}]);
});
it('waits for final web words after Stop, while immediately releasing the metering stream', async () => {
  const events = vi.fn(); const capture = createVoiceCapture('en-US', events); await tick();
  capture.stop(); expect(Recognition.instances[0].stop).toHaveBeenCalledOnce(); expect(stopTrack).toHaveBeenCalledOnce();
  Recognition.instances[0].onresult?.({results:[{0:{transcript:'Final word'},isFinal:true}]});
  expect(events).toHaveBeenCalledWith({type:'transcript',text:'Final word'});
  capture.cancel(); expect(Recognition.instances[0].abort).toHaveBeenCalled();
});
it('uses the native bridge on iPhone and filters stale session events', async () => {
  native.platform = 'ios'; native.enabled = true; const remove = vi.fn();
  let listener!: (event: VoiceCaptureEvent & {sessionId:string}) => void;
  native.addListener.mockImplementation(async (_name, callback) => { listener = callback; return {remove}; });
  const events = vi.fn(); const capture = createVoiceCapture('en-US', events); await tick();
  const {sessionId} = native.start.mock.calls[0][0]; expect(gum).not.toHaveBeenCalled(); expect(supportsVoiceCapture()).toBe(true);
  listener({sessionId:'stale',type:'transcript',text:'wrong'}); expect(events).not.toHaveBeenCalled();
  listener({sessionId,type:'level',level:.5}); expect(events).toHaveBeenCalledWith(expect.objectContaining({type:'level',level:.5}));
  capture.stop(); expect(native.stop).toHaveBeenCalledWith({sessionId,cancel:false});
  listener({sessionId,type:'ended'}); expect(remove).toHaveBeenCalledOnce();
});
it('removes a native listener that resolves after Cancel without starting recording', async () => {
  native.platform = 'ios'; native.enabled = true; let resolve!: (value: unknown) => void; const remove = vi.fn();
  native.addListener.mockReturnValue(new Promise(done => {resolve = done;}));
  const events = vi.fn(); const capture = createVoiceCapture('en-US', events); capture.cancel();
  resolve({remove}); await tick(); expect(native.start).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce();
});
it('retains permission-only requests for companion chat without opening a native recording', async () => {
  native.platform = 'ios'; native.enabled = true; native.requestPermission.mockResolvedValue({status:'granted'});
  expect(await requestVoicePermission()).toBe('granted'); expect(native.start).not.toHaveBeenCalled();
});

it('holds playback until native microphone shutdown completes on cancellation', async () => {
  native.platform = 'ios'; native.enabled = true;
  native.addListener.mockResolvedValue({remove:vi.fn()});
  let resolveStop!: () => void;
  native.stop.mockReturnValue(new Promise<void>(resolve=>{resolveStop=resolve;}));
  const capture=createVoiceCapture('en-US',vi.fn());await tick();
  expect(isVoiceCaptureActive()).toBe(true);
  capture.cancel();expect(isVoiceCaptureActive()).toBe(true);
  resolveStop();await tick();expect(isVoiceCaptureActive()).toBe(false);
});
