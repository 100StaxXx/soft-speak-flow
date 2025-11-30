import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gift, Sparkles } from "lucide-react";

interface ReferralCodeInputProps {
  onSubmit: (code: string) => Promise<void>;
  onSkip: () => void;
}

export const ReferralCodeInput = ({ onSubmit, onSkip }: ReferralCodeInputProps) => {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      onSkip();
      return;
    }

    setIsSubmitting(true);
    setError("");
    
    try {
      await onSubmit(code.trim().toUpperCase());
    } catch (err) {
      setError("Invalid referral code. Please check and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Gift className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Got a Referral Code?</h2>
          <p className="text-muted-foreground">
            If a friend invited you, enter their code to unlock bonus rewards!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="REF-XXXXXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-wider"
              maxLength={12}
            />
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Validating..."
              ) : code.trim() ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Apply Code
                </>
              ) : (
                "Continue"
              )}
            </Button>
            
            {code.trim() && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onSkip}
                disabled={isSubmitting}
              >
                Skip for now
              </Button>
            )}
          </div>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          You can always enter a code later in your profile
        </div>
      </Card>
    </div>
  );
};
