import { useCallback, useEffect, useRef, useState } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { GAME_RECORDS_EVENT, readGameRecords } from "@/lib/gracewardGameScores";

export function useGameRecords(playerId?: string) {
  const [records, setRecords] = useState(() => readGameRecords(playerId));
  useEffect(() => {
    const refresh = () => setRecords(readGameRecords(playerId));
    refresh();
    window.addEventListener(GAME_RECORDS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(GAME_RECORDS_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [playerId]);
  return records;
}

/** Accumulate only active foreground time; backgrounding pauses the round. */
export function useGameClock(active: boolean, paused: boolean, pause: () => void, initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const elapsed = useRef(initialSeconds);
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (!active) return;
    const hidden = () => { if (document.hidden) pauseRef.current(); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [active]);
  useEffect(() => {
    if (!active || paused || document.hidden) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (!document.hidden) elapsed.current += Math.min(now - last, 1000) / 1000;
      last = now;
      setSeconds(Math.floor(elapsed.current));
    };
    const timer = window.setInterval(tick, 250);
    return () => { window.clearInterval(timer); tick(); };
  }, [active, paused]);
  return { seconds, resetClock: () => { elapsed.current = 0; setSeconds(0); } };
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
/** Small synthesized cues: no downloads, and audio only follows a user gesture. */
export function useGameSound() {
  const [sound, setSound] = useState(() => safeLocalStorage.getItem("graceward:game-sound") === "on");
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  const cue = useCallback((kind: "tap" | "match" | "finish" | "miss", enabled = sound) => {
    if (!enabled) return;
    try {
      const Audio = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!Audio) return;
      context.current ??= new Audio();
      const audio = context.current;
      void audio.resume().catch(() => {});
      const notes = kind === "finish" ? [523, 659, 784, 1047] : kind === "match" ? [659, 880] : kind === "miss" ? [220] : [440];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.09;
        oscillator.type = "sine"; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.2);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Audio is optional; play continues when unavailable. */ }
  }, [sound]);
  const toggleSound = () => { const next = !sound; setSound(next); safeLocalStorage.setItem("graceward:game-sound", next ? "on" : "off"); if (next) cue("match", true); };
  return { sound, toggleSound, cue };
}
