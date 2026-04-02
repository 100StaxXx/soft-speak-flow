import { memo, useEffect, useMemo } from "react";
import {
  Alignment,
  Fit,
  Layout,
  StateMachineInputType,
  useRive,
} from "@rive-app/react-canvas";
import {
  getCompanionMotionEventCode,
  getCompanionMotionStagePower,
  type CompanionMotionEvent,
  type CompanionMotionSceneConfig,
} from "@/config/companionMotion";
import { cn } from "@/lib/utils";

interface LazyRiveMotionSceneProps {
  src: string;
  artboard?: string;
  stateMachines?: string[];
  inputBindings?: CompanionMotionSceneConfig["inputBindings"];
  className?: string;
  stage?: number;
  event?: CompanionMotionEvent | null;
  onLoadError?: () => void;
}

export const LazyRiveMotionScene = memo(({
  src,
  artboard,
  stateMachines,
  inputBindings,
  className,
  stage = 0,
  event,
  onLoadError,
}: LazyRiveMotionSceneProps) => {
  const layout = useMemo(
    () =>
      new Layout({
        fit: Fit.Cover,
        alignment: Alignment.Center,
      }),
    [],
  );

  const { rive, RiveComponent } = useRive(
    {
      src,
      artboard,
      stateMachines,
      autoplay: true,
      layout,
      onLoadError,
    },
    {
      useDevicePixelRatio: true,
      shouldResizeCanvasToContainer: true,
      shouldUseIntersectionObserver: true,
      useOffscreenRenderer: false,
    },
  );

  useEffect(() => {
    if (!rive || !stateMachines?.length || !inputBindings) return;

    const inputMap = new Map<string, ReturnType<typeof rive.stateMachineInputs>[number]>();
    for (const stateMachine of stateMachines) {
      for (const input of rive.stateMachineInputs(stateMachine)) {
        inputMap.set(input.name, input);
      }
    }

    const setNumberInput = (name: string | undefined, value: number) => {
      if (!name) return;
      const input = inputMap.get(name);
      if (!input || input.type !== StateMachineInputType.Number) return;
      input.value = value;
    };

    const setBooleanInput = (name: string | undefined, value: boolean) => {
      if (!name) return;
      const input = inputMap.get(name);
      if (!input || input.type !== StateMachineInputType.Boolean) return;
      input.value = value;
    };

    const fireTriggerInput = (name: string | undefined) => {
      if (!name || !event) return;
      const input = inputMap.get(name);
      if (!input || input.type !== StateMachineInputType.Trigger) return;
      input.fire();
    };

    setNumberInput(inputBindings.stagePower, getCompanionMotionStagePower(stage));
    setNumberInput(
      inputBindings.intensity,
      event ? (event.intensity === "heroic" ? 1 : event.intensity === "medium" ? 0.72 : 0.48) : 0.36,
    );
    setNumberInput(inputBindings.eventCode, getCompanionMotionEventCode(event?.type ?? "idle"));
    setBooleanInput(inputBindings.isIdle, !event || event.type === "idle");
    fireTriggerInput(inputBindings.eventTrigger);
  }, [event, inputBindings, rive, stage, stateMachines]);

  return (
    <div className={cn("absolute inset-0", className)}>
      <RiveComponent className="h-full w-full" aria-hidden="true" />
    </div>
  );
});

LazyRiveMotionScene.displayName = "LazyRiveMotionScene";
