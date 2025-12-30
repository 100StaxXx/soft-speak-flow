import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, Sparkles } from "lucide-react";
import { LegalDocumentViewer } from "@/components/LegalDocumentViewer";

interface StoryPrologueProps {
  onComplete: (name: string) => void;
}

export const StoryPrologue = ({ onComplete }: StoryPrologueProps) => {
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Memoize star positions to prevent them from jumping on re-render
  const starPositions = useMemo(() => 
    [...Array(30)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    })), []);

  const canContinue = name.trim().length >= 2 && ageConfirmed && legalAccepted;

  const handleContinue = () => {
    if (canContinue) {
      onComplete(name.trim());
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 pt-safe-top safe-area-bottom">
      {/* Animated Stars Background */}
      <div className="absolute inset-0 overflow-hidden">
        {starPositions.map((star, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: star.left,
              top: star.top,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>

      {/* Cinematic Opening */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="w-full max-w-md z-10"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: 0.3, duration: 0.8 }}
          className="w-24 h-24 mx-auto mb-8 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Sparkles className="w-12 h-12 text-primary" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome, Traveler
          </h1>
          <p className="text-white/70 text-lg">
            A cosmic journey awaits those who dare to begin
          </p>
        </motion.div>

        {/* Name Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6"
        >
          <label className="block text-white/80 text-sm mb-2">
            What shall we call you?
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="bg-background/50 border-white/20 text-white placeholder:text-white/40 text-lg py-6"
            maxLength={30}
          />
        </motion.div>

        {/* Age & Legal Checkboxes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-8 space-y-4"
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="age"
              checked={ageConfirmed}
              onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
              className="mt-1"
            />
            <label htmlFor="age" className="text-white/70 text-sm leading-relaxed">
              I confirm that I am 13 years of age or older
            </label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="legal"
              checked={legalAccepted}
              onCheckedChange={(checked) => setLegalAccepted(checked === true)}
              className="mt-1"
            />
            <label htmlFor="legal" className="text-white/70 text-sm leading-relaxed">
              I accept the{" "}
              <button
                onClick={() => setShowTerms(true)}
                className="text-primary underline hover:text-primary/80"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                onClick={() => setShowPrivacy(true)}
                className="text-primary underline hover:text-primary/80"
              >
                Privacy Policy
              </button>
            </label>
          </div>
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90"
          >
            Begin My Journey
            <ChevronRight className="ml-2" />
          </Button>
        </motion.div>
      </motion.div>

      {/* Legal Document Modals */}
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
    </div>
  );
};
