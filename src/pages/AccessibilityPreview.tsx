import { useState } from "react";
import { useParams } from "react-router-dom";

import { BottomNav } from "@/components/BottomNav";
import { AICompanionCreator } from "@/components/AICompanionCreator";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import {
  LivingCompanionInteractionAura,
  LivingCompanionPresenceBubble,
} from "@/components/companion/LivingCompanionPresence";
import { GracewardOnboarding } from "@/components/onboarding/StoryOnboarding";
import { FactionSelector } from "@/components/onboarding/FactionSelector";
import { CHRISTIAN_COMPANION_FORMS } from "@/config/christianCompanionForms";
import type { LivingCompanionBodyLanguage } from "@/config/livingCompanion";
import type { LivingCompanionPrompt } from "@/hooks/useLivingCompanionPresence";
import ChristianProfile from "@/pages/ChristianProfile";
import Guide from "@/pages/Guide";
import Today from "@/pages/Today";

const OnboardingPreview = () => (
  <GracewardOnboarding />
);

const PathPreview = () => (
  <FactionSelector onComplete={() => undefined} />
);

const CompanionSetupPreview = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,#203b35_0%,#111b1a_42%,#090e0e_100%)] py-4">
    <AICompanionCreator
      storyTone="soft_gentle"
      allowToneSelection
      onComplete={() => undefined}
    />
  </div>
);

const CompanionMigrationPreview = () => (
  <div className="min-h-screen bg-background">
    <CompanionPersonalization
      mode="migration"
      onComplete={() => undefined}
    />
  </div>
);

const COMPANION_PREVIEW_QUESTION: LivingCompanionPrompt = {
  id: "preview-question",
  kind: "question",
  message: "What would help most right now?",
  options: [
    {
      id: "smaller",
      label: "A smaller step",
      response: "Good. Small enough to start is the right size.",
      bodyLanguage: "curious",
    },
    {
      id: "priority",
      label: "A clear priority",
      response: "Let's choose what deserves your attention—and release the rest.",
      bodyLanguage: "happy",
    },
    {
      id: "pause",
      label: "A real pause",
      response: "Take the pause. You don't need to earn it first.",
      bodyLanguage: "calm",
    },
  ],
};

const CompanionPresencePreview = () => {
  const form = CHRISTIAN_COMPANION_FORMS[0];
  const [prompt, setPrompt] = useState<LivingCompanionPrompt | null>(COMPANION_PREVIEW_QUESTION);
  const [bodyLanguage, setBodyLanguage] = useState<LivingCompanionBodyLanguage>("curious");
  const [interactionNonce, setInteractionNonce] = useState(0);

  const answerQuestion = (optionId: string) => {
    const option = COMPANION_PREVIEW_QUESTION.options?.find((candidate) => candidate.id === optionId);
    if (!option) return;
    setPrompt({
      id: `preview-answer-${option.id}`,
      kind: "comment",
      message: option.response,
    });
    setBodyLanguage(option.bodyLanguage);
    setInteractionNonce((current) => current + 1);
  };

  const interact = () => {
    setPrompt({
      id: `preview-tap-${interactionNonce + 1}`,
      kind: "comment",
      message: "I'm here. We can take the next thing slowly.",
    });
    setBodyLanguage("curious");
    setInteractionNonce((current) => current + 1);
  };

  return (
    <main className="daily-way-page flex min-h-screen items-center justify-center p-5 text-foreground">
      <section className="w-full max-w-sm rounded-[2rem] border border-primary/20 bg-card/90 p-5 shadow-2xl backdrop-blur-xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary">Your companion</p>
        <h1 className="mt-1 text-center font-serif text-3xl font-semibold">Nova</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Tap for a response. Press and hold for comfort.</p>

        <div className="relative mt-4 flex justify-center py-2">
          <button
            type="button"
            className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] border border-white/50 bg-[#dbe8d7] text-left shadow-[0_20px_60px_rgba(23,51,35,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Interact with Nova"
            onClick={interact}
          >
            <img src={form.image} alt={`${form.displayName} companion`} className="h-full w-full object-cover" />
            <LivingCompanionInteractionAura
              bodyLanguage={bodyLanguage}
              interactionNonce={interactionNonce}
              prefersReducedMotion={false}
            />
          </button>
          <LivingCompanionPresenceBubble
            prompt={prompt}
            companionName="Nova"
            prefersReducedMotion={false}
            onAnswer={answerQuestion}
            onDismiss={() => setPrompt(null)}
          />
        </div>

        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-full border border-primary/25 bg-primary/[0.08] px-4 text-sm font-semibold text-primary hover:bg-primary/[0.14]"
          onClick={() => {
            setPrompt(COMPANION_PREVIEW_QUESTION);
            setBodyLanguage("curious");
          }}
        >
          Ask today&apos;s question again
        </button>
      </section>
    </main>
  );
};

const PREVIEWS = {
  today: Today,
  guide: Guide,
  onboarding: OnboardingPreview,
  paths: PathPreview,
  "companion-setup": CompanionSetupPreview,
  "companion-migration": CompanionMigrationPreview,
  "companion-presence": CompanionPresencePreview,
  settings: ChristianProfile,
} as const;

/** Development-only rendering surface for responsive and contrast QA. */
export default function AccessibilityPreview() {
  const { screen = "today" } = useParams();
  const Preview = PREVIEWS[screen as keyof typeof PREVIEWS] ?? Today;

  return (
    <>
      <Preview />
      {screen === "onboarding" || screen === "paths" || screen === "companion-setup" || screen === "companion-migration" || screen === "companion-presence" ? null : <BottomNav />}
    </>
  );
}
