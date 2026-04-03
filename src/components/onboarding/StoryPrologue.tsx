import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, Crown, Sparkles } from "lucide-react";
import { LegalDocumentViewer } from "@/components/LegalDocumentViewer";
import { OnboardingStageShell } from "./OnboardingStageShell";

interface StoryPrologueProps {
  onComplete: (name: string) => void;
}

export const StoryPrologue = ({ onComplete }: StoryPrologueProps) => {
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const canContinue = name.trim().length >= 2 && ageConfirmed && legalAccepted;

  const handleContinue = () => {
    if (canContinue) {
      onComplete(name.trim());
    }
  };

  return (
    <OnboardingStageShell
      width="md"
      accent="38 88% 70%"
      hero={
        <div className="onb-stage-emblem">
          <div className="relative flex items-center justify-center">
            <Crown className="h-10 w-10 text-[#ffe2a3]" />
            <motion.div
              className="absolute -right-4 -top-4 rounded-full border border-[#f3cd84]/18 bg-black/25 p-2 text-[#ffe2a3] backdrop-blur-md"
              animate={{ y: [0, -5, 0], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
          </div>
        </div>
      }
      eyebrow="Hall of Origins"
      title="Welcome, Traveler"
      description="The hatchery ledger is open, the stage lamps are lit, and your first inscription is waiting. Choose the name your guide and companion will speak when this story begins."
      bodyClassName="mx-auto w-full max-w-2xl"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="onb-stage-panel overflow-hidden p-5 sm:p-6 md:p-8"
      >
        <div className="space-y-5">
          <div className="onb-stage-card p-5 sm:p-6">
            <label
              htmlFor="onboarding-name"
              className="mb-3 block text-xs font-semibold uppercase tracking-[0.24em] text-[#f4d39b]/62"
            >
              Name for the ledger
            </label>
            <Input
              id="onboarding-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="h-14 rounded-full border-[#f3cd84]/18 bg-black/25 px-5 text-base text-[#fff4df] placeholder:text-[#f7ead6]/34 focus-visible:ring-[#f3cd84]/55 focus-visible:ring-offset-0"
              maxLength={30}
            />
            <p className="mt-3 text-sm leading-6 text-[#f7ead6]/66">
              This is the name inscribed into your guide reveal, your companion bond, and the
              opening page of your journey.
            </p>
          </div>

          <div className="space-y-3">
            <div className="onb-stage-card flex items-start gap-4 p-4 sm:p-5">
              <Checkbox
                id="age"
                aria-label="I confirm that I am 13 years of age or older"
                checked={ageConfirmed}
                onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                className="mt-1 h-5 w-5 rounded-md border-[#f3cd84]/28 bg-white/5 data-[state=checked]:border-[#ffe2a3] data-[state=checked]:bg-[#ffe2a3] data-[state=checked]:text-[#3a220d]"
              />
              <label htmlFor="age" className="flex-1 text-sm leading-6 text-[#f7ead6]/76">
                I confirm that I am 13 years of age or older
              </label>
            </div>

            <div className="onb-stage-card flex items-start gap-4 p-4 sm:p-5">
              <Checkbox
                id="legal"
                aria-label="I accept the Terms of Service, Privacy Policy, and Apple's EULA"
                checked={legalAccepted}
                onCheckedChange={(checked) => setLegalAccepted(checked === true)}
                className="mt-1 h-5 w-5 rounded-md border-[#f3cd84]/28 bg-white/5 data-[state=checked]:border-[#ffe2a3] data-[state=checked]:bg-[#ffe2a3] data-[state=checked]:text-[#3a220d]"
              />
              <div className="flex-1 text-sm leading-6 text-[#f7ead6]/70">
                <label htmlFor="legal" className="inline">
                  I accept the{" "}
                </label>
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-[#ffe2a3] underline decoration-[#f3cd84]/40 underline-offset-4 transition hover:text-[#fff4df]"
                >
                  Terms of Service
                </button>
                ,{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-[#ffe2a3] underline decoration-[#f3cd84]/40 underline-offset-4 transition hover:text-[#fff4df]"
                >
                  Privacy Policy
                </button>
                , and{" "}
                <a
                  href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ffe2a3] underline decoration-[#f3cd84]/40 underline-offset-4 transition hover:text-[#fff4df]"
                >
                  Apple&apos;s EULA
                </a>
              </div>
            </div>
          </div>

          <div className="onb-stage-divider" />

          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            size="lg"
            className="onb-stage-cta h-14 w-full rounded-full text-base font-semibold"
          >
            Begin My Journey
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>

      <LegalDocumentViewer
        open={showTerms}
        onOpenChange={setShowTerms}
        documentType="terms"
      />
      <LegalDocumentViewer
        open={showPrivacy}
        onOpenChange={setShowPrivacy}
        documentType="privacy"
      />
    </OnboardingStageShell>
  );
};
