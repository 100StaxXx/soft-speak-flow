import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  COMPANION_MOTION_EVENT_DURATIONS,
  createCompanionMotionEventId,
  type CompanionMotionEvent,
  type CompanionMotionEventType,
  type CompanionMotionIntensity,
} from "@/config/companionMotion";

interface TriggerCompanionMotionEventOptions {
  type: CompanionMotionEventType;
  intensity?: CompanionMotionIntensity;
  durationMs?: number;
  element?: string | null;
  stage?: number | null;
  reason?: string | null;
}

interface CompanionMotionContextValue {
  activeEvent: CompanionMotionEvent | null;
  triggerEvent: (options: TriggerCompanionMotionEventOptions) => CompanionMotionEvent;
  clearEvent: (eventId?: string) => void;
}

const CompanionMotionContext = createContext<CompanionMotionContextValue | null>(null);

const NOOP_EVENT: CompanionMotionEvent = {
  id: "companion-motion-noop",
  type: "idle",
  intensity: "subtle",
  durationMs: 0,
  createdAt: 0,
  element: null,
  stage: null,
  reason: null,
};

export const CompanionMotionProvider = ({ children }: { children: ReactNode }) => {
  const [activeEvent, setActiveEvent] = useState<CompanionMotionEvent | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const clearEvent = useCallback((eventId?: string) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setActiveEvent((current) => {
      if (!eventId || current?.id === eventId) {
        return null;
      }
      return current;
    });
  }, []);

  const triggerEvent = useCallback((options: TriggerCompanionMotionEventOptions) => {
    const event: CompanionMotionEvent = {
      id: createCompanionMotionEventId(),
      type: options.type,
      intensity: options.intensity ?? "subtle",
      durationMs: options.durationMs ?? COMPANION_MOTION_EVENT_DURATIONS[options.type],
      createdAt: Date.now(),
      element: options.element ?? null,
      stage: options.stage ?? null,
      reason: options.reason ?? null,
    };

    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setActiveEvent(event);

    if (event.durationMs > 0) {
      clearTimerRef.current = window.setTimeout(() => {
        setActiveEvent((current) => (current?.id === event.id ? null : current));
        clearTimerRef.current = null;
      }, event.durationMs);
    }

    return event;
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      activeEvent,
      triggerEvent,
      clearEvent,
    }),
    [activeEvent, clearEvent, triggerEvent],
  );

  return (
    <CompanionMotionContext.Provider value={value}>
      {children}
    </CompanionMotionContext.Provider>
  );
};

export const useCompanionMotion = () => {
  const context = useContext(CompanionMotionContext);
  if (!context) {
    throw new Error("useCompanionMotion must be used within CompanionMotionProvider");
  }
  return context;
};

export const useCompanionMotionSafe = () => {
  const context = useContext(CompanionMotionContext);
  if (!context) {
    return {
      activeEvent: null,
      triggerEvent: () => NOOP_EVENT,
      clearEvent: () => {},
    } satisfies CompanionMotionContextValue;
  }
  return context;
};
