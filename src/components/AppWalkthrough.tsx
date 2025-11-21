import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/useIsMobile";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

/**
 * App walkthrough steps. Keep them in-order (0..5).
 * If you want to reorder later, reference steps by id via findIndex.
 */
const WALKTHROUGH_STEPS: (Step & { id?: string })[] = [
  {
    id: "home-checkin",
    target: '[data-tour="morning-checkin"]',
    content: "👋 Welcome! Let's start with your morning check-in. Select how you're feeling right now.",
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    id: "checkin-intention",
    target: '[data-tour="checkin-intention"]',
    content: "💭 Now, what's your main focus for today? Enter your intention here.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    id: "xp-celebration",
    target: 'body',
    content: "🎉 Nice! You just earned +5 XP! Now let's meet your companion! Tap the Companion tab at the bottom.",
    placement: "center",
    disableBeacon: true,
  },
  {
    id: "companion-intro",
    target: '[data-tour="companion-tooltip-anchor"]',
    content: "✨ This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Now tap the Quests tab to create your first quest.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
    floaterProps: { hideArrow: true },
  },
  {
    id: "tasks-create-quest",
    target: '[data-tour="today-quests-header"]',
    content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (10 XP), then tap Add Quest. This becomes your MAIN QUEST earning 2x XP (20 total!) - the one thing that moves your day forward!",
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: false,
    floaterProps: {
      disableAnimation: true,
      hideArrow: false,
      offset: 20,
    },
    styles: {
      options: { zIndex: 100000 },
      tooltip: {
        minWidth: '300px',
        maxWidth: '85vw',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        border: '3px solid hsl(var(--primary))',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        marginTop: '-120px',
        pointerEvents: 'none',
      },
      tooltipContent: { fontSize: '1rem', lineHeight: '1.6', padding: '0.5rem 0', textAlign: 'left', pointerEvents: 'none' },
    },
  },
  {
    id: "final-congrats",
    target: 'body',
    content: "🎉 Congratulations! You've mastered the basics! Your first quest is now your MAIN QUEST (2x XP = 20 XP total!). You can add 2 more Side Quests if needed. Complete your Main Quest by tapping the checkbox to evolve your companion! 🚀",
    placement: "center",
    disableBeacon: true,
    locale: { last: 'Begin Adventure' },
    styles: { tooltip: { pointerEvents: 'auto' } },
  },
];

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

  // Track and clear timeouts so scheduled step changes don't fire after unmount or pause
  const activeTimeouts = useRef<Set<number>>(new Set());
  const createTrackedTimeout = useCallback((cb: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      activeTimeouts.current.delete(id);
      try { cb(); } catch (e) { console.warn("tracked timeout callback error", e); }
    }, delay) as unknown as number;
    activeTimeouts.current.add(id);
    return id;
  }, []);
  const clearAllTimeouts = useCallback(() => {
    activeTimeouts.current.forEach((id) => clearTimeout(id));
    activeTimeouts.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // waitForSelector returns whether element was found
  const waitForSelector = useCallback((selector: string, timeout = 5000) => {
    return new Promise<boolean>((resolve) => {
      const start = Date.now();
      const check = () => {
        if (document.querySelector(selector)) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        requestAnimationFrame(check);
      };
      check();
    });
  }, []);

  // Build steps; on mobile, adjust by finding exact steps instead of numeric indices
  const steps = useMemo(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      const taskIdx = base.findIndex((s) => (s as any).target === '[data-tour="today-quests-header"]');
      if (taskIdx !== -1) {
        base[taskIdx] = {
          ...base[taskIdx],
          target: '[data-tour="today-quests-header"]',
          placement: 'top',
          floaterProps: { ...((base[taskIdx] as any).floaterProps || {}), offset: 0 },
          styles: {
            ...((base[taskIdx] as any).styles || {}),
            tooltip: {
              ...(((base[taskIdx] as any).styles?.tooltip) || {}),
              marginTop: undefined,
              marginBottom: '8px',
              pointerEvents: 'none',
            }
          },
        } as Step & { id?: string };
      }

      const companionIdx = base.findIndex((s) => (s as any).target === '[data-tour="companion-tooltip-anchor"]');
      if (companionIdx !== -1) {
        base[companionIdx] = {
          ...base[companionIdx],
          target: '[data-tour="companion-tooltip-anchor"]',
          placement: 'top',
        } as Step & { id?: string };
      }
    }
    return base;
  }, [isMobile]);

  // Utility: safeSetStep uses the built steps (checks existence and waits for target)
  const safeSetStep = useCallback(async (idx: number) => {
    const step = steps[idx] as Step | undefined;
    if (!step) {
      console.warn(`Tutorial step ${idx} does not exist. Steps length=${steps.length}`);
      return;
    }

    // Emit tutorial state change early so bottom nav and other listeners can react
    window.dispatchEvent(new CustomEvent('tutorial-step-change', { detail: { step: idx } }));

    const target = (step.target as string | undefined);
    if (target && target !== 'body') {
      const found = await waitForSelector(target, 6000);
      if (!found) {
        console.warn(`Tutorial anchor not found for selector \