import { useState, useEffect } from "react";
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, EVENTS } from "react-joyride";

interface QuestsPageTourProps {
  run: boolean;
  onComplete: () => void;
}

export const QuestsPageTour = ({ run, onComplete }: QuestsPageTourProps) => {
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = [
    {
      target: '[data-tour="quests-welcome"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">⚔️ Welcome to Your Quest System!</h3>
          <p>Your tasks are now epic quests! Let me show you how this works.</p>
        </div>
      ),
      disableBeacon: true,
      placement: "center",
    },
    {
      target: '[data-tour="add-quest-input"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">📝 Create Your Quests</h3>
          <p>Add up to 3 daily quests. Each one is a task that moves your life forward.</p>
          <p className="text-sm text-muted-foreground">Try adding your first quest now!</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '[data-tour="main-quest-section"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">⚔️ Main Quest = 2x XP!</h3>
          <p><strong>Your Main Quest</strong> is THE most important thing you'll do today.</p>
          <ul className="text-sm space-y-1 ml-4 list-disc">
            <li>Earns <strong>double XP</strong> when completed</li>
            <li>Bigger card with special styling</li>
            <li>The quest that matters most</li>
          </ul>
        </div>
      ),
      disableBeacon: true,
      placement: "bottom",
    },
    {
      target: '[data-tour="side-quests-section"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">📜 Side Quests Support Your Day</h3>
          <p>Side Quests are smaller tasks that complement your Main Quest.</p>
          <p className="text-sm font-medium">💡 Tip: Hover over any Side Quest to see the ⭐ promote button!</p>
        </div>
      ),
      disableBeacon: true,
      placement: "top",
    },
    {
      target: '[data-tour="promote-button"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">⭐ Promote to Main Quest</h3>
          <p>Click the star icon on any Side Quest to make it your Main Quest.</p>
          <p className="text-sm text-muted-foreground">Only one Main Quest at a time - choose wisely!</p>
        </div>
      ),
      disableBeacon: true,
      placement: "left",
      styles: {
        options: {
          zIndex: 10000,
        },
      },
    },
    {
      target: '[data-tour="quest-completion"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">✅ Complete Your Quests</h3>
          <p>Click any quest to mark it complete and earn XP!</p>
          <div className="bg-primary/10 p-3 rounded-lg text-sm">
            <p className="font-semibold">Strategy Tip:</p>
            <p>Focus on your Main Quest first - it's worth 2x the XP and sets the tone for your day!</p>
          </div>
        </div>
      ),
      disableBeacon: true,
      placement: "center",
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      onComplete();
    } else if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      setStepIndex(index + 1);
    } else if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
      setStepIndex(index - 1);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          arrowColor: "hsl(var(--background))",
          zIndex: 1000,
        },
        tooltip: {
          borderRadius: "0.75rem",
          padding: "1.5rem",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
};
