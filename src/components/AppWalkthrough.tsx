import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

const WALKTHROUGH_STEPS: (Step & { id?: string })[] = [
  { id: "home-checkin", target: '[data-tour="morning-checkin"]', content: "👋 Welcome! Let's start with your morning check-in. Select how you're feeling right now.", placement: 'top', disableBeacon: true, spotlightClicks: true },
  { id: "checkin-intention", target: '[data-tour="checkin-intention"]', content: "💭 Now, what's your main focus for today? Enter your intention here.", placement: "top", disableBeacon: true, spotlightClicks: true },
  { id: "xp-celebration", target: 'body', content: "🎉 Nice! You just earned +5 XP! Now let's meet your companion! Tap the Companion tab at the bottom.", placement: "center", disableBeacon: true },
  { id: "companion-intro", target: '[data-tour="companion-tooltip-anchor"]', content: "✨ This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Now tap the Quests tab to create your first quest.", placement: "top", disableBeacon: true, spotlightClicks: true, floaterProps: { hideArrow: true } },
  { id: "tasks-create-quest", target: '[data-tour="today-quests-header"]', content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (10 XP), then tap Add Quest. This becomes your MAIN QUEST earning 2x XP (20 total!) - the one thing that moves your day forward!", placement: 'top', disableBeacon: true, spotlightClicks: false, floaterProps: { disableAnimation: true, hideArrow: false, offset: 20 }, styles: { options: { zIndex: 100000 }, tooltip: { minWidth: '300px', maxWidth: '85vw', padding: '1.5rem', borderRadius: '1.25rem', border: '3px solid hsl(var(--primary))', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', marginTop: '-120px', pointerEvents: 'none' }, tooltipContent: { fontSize: '1rem', lineHeight: '1.6', padding: '0.5rem 0', textAlign: 'left', pointerEvents: 'none' } } },
  { id: "final-congrats", target: 'body', content: "🎉 Congratulations! You've mastered the basics! Your first quest is now your MAIN QUEST (2x XP = 20 XP total!). You can add 2 more Side Quests if needed. Complete your Main Quest by tapping the checkbox to evolve your companion! 🚀", placement: "center", disableBeacon: true, locale: { last: 'Begin Adventure' }, styles: { tooltip: { pointerEvents: 'auto' } } },
];

const STEP_INDEX = {
  HOME_CHECKIN: 0,
  CHECKIN_INTENTION: 1,
  XP_CELEBRATION: 2,
  COMPANION_VIEW: 3,
  QUEST_CREATION: 4,
  FINAL_CONGRATULATIONS: 5,
} as const;

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

  // Track and clear timeouts & intervals so scheduled actions don't fire after unmount or pause
  const activeTimeouts = useRef<Set<number>>(new Set());
  const activeIntervals = useRef<Set<number>>(new Set());

  const createTrackedTimeout = useCallback((cb: () => void, delay: number) => {
    if (typeof window === 'undefined') return -1;
    const id = window.setTimeout(() => {
      activeTimeouts.current.delete(id);
      try { cb(); } catch (e) { console.warn('tracked timeout callback error', e); }
    }, delay) as unknown as number;
    activeTimeouts.current.add(id);
    return id;
  }, []);

  const createTrackedInterval = useCallback((cb: () => void, delay: number) => {
    if (typeof window === 'undefined') return -1;
    const id = window.setInterval(() => { try { cb(); } catch (e) { console.warn('tracked interval callback error', e); } }, delay) as unknown as number;
    activeIntervals.current.add(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    activeTimeouts.current.forEach((id) => clearTimeout(id));
    activeTimeouts.current.clear();
    activeIntervals.current.forEach((id) => clearInterval(id));
    activeIntervals.current.clear();
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // waitForSelector using MutationObserver for efficiency
  const waitForSelector = useCallback((selector: string, timeout = 5000) => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (!selector || selector === 'body') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      if (document.querySelector(selector)) return resolve(true);
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const t = window.setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
      activeTimeouts.current.add(t as unknown as number);
    });
  }, []);

  const steps = useMemo(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      const taskIdx = base.findIndex((s) => (s as any).target === '[data-tour="today-quests-header"]');
      if (taskIdx !== -1) {
        base[taskIdx] = { ...base[taskIdx], target: '[data-tour="today-quests-header"]', placement: 'top' } as Step & { id?: string };
      }
      const companionIdx = base.findIndex((s) => (s as any).target === '[data-tour="companion-tooltip-anchor"]');
      if (companionIdx !== -1) base[companionIdx] = { ...base[companionIdx], target: '[data-tour="companion-tooltip-anchor"]', placement: 'top' } as Step & { id?: string };
    }
    return base;
  }, [isMobile]);

  // safeSetStep will fallback to body if anchor not found
  const safeSetStep = useCallback(async (idx: number) => {
    const step = steps[idx] as Step | undefined;
    if (!step) {
      console.warn(`Tutorial step ${idx} does not exist. Steps length=${steps.length}`);
      return;
    }

    window.dispatchEvent(new CustomEvent('tutorial-step-change', { detail: { step: idx } }));

    const target = step.target as string | undefined;
    if (target && target !== 'body') {
      const found = await waitForSelector(target, 6000);
      if (!found) {
        console.warn(`Tutorial anchor not found for selector \