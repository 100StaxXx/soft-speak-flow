import { FormEvent, useState, memo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gift, CheckCircle2 } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";

export const ReferralCodeRedeemCard = memo(() => {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { referralStats, applyReferralCode } = useReferrals();

  const hasAppliedCode = Boolean(referralStats?.referred_by);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitized = code.trim().toUpperCase();
    if (!sanitized) return;

    setIsSubmitting(true);
    try {
      await applyReferralCode.mutateAsync(sanitized);
      setCode("");
    } catch (error) {
      // toast handled inside hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Gift className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Enter a Referral Code</CardTitle>
            <CardDescription>Entering a friend's code simply lets them earn cosmetic skins when you reach Stage 3.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasAppliedCode ? (
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Referral code already applied</p>
              <p className="text-sm text-muted-foreground">
                Your friend will get their cosmetic reward once you hit Stage 3; nothing changes on your account.
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              placeholder="REF-XXXXXXXX"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={12}
              className="text-center text-lg tracking-wider"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !code.trim()}
            >
              {isSubmitting ? "Applying..." : "Apply Code"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Codes can be entered once per account. We’ll handle the rest automatically.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
});
ReferralCodeRedeemCard.displayName = 'ReferralCodeRedeemCard';
