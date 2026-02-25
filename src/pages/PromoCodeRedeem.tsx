import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePromoCode, PromoCodeRedeemError } from "@/hooks/usePromoCode";
import { toast } from "sonner";

const PromoCodeRedeem = () => {
  const navigate = useNavigate();
  const { redeemPromoCode } = usePromoCode();
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = redeemPromoCode.isPending;
  const sanitizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sanitizedCode) {
      setErrorMessage("Enter a promo code.");
      return;
    }

    setErrorMessage(null);
    try {
      await redeemPromoCode.mutateAsync(sanitizedCode);
      toast.success("Promo code applied. Access unlocked.");
      navigate("/profile", { replace: true });
    } catch (error) {
      if (error instanceof PromoCodeRedeemError) {
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage("Unable to redeem promo code right now. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gift className="h-6 w-6" />
          </div>
          <CardTitle>Redeem Promo Code</CardTitle>
          <CardDescription>
            Enter your promo code to unlock app access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="PROMO-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="text-center text-lg tracking-wider"
              maxLength={40}
            />
            {errorMessage && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting || !sanitizedCode}>
              {isSubmitting ? "Redeeming..." : "Redeem Promo Code"}
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/profile")}
          >
            Back to Command Center
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PromoCodeRedeem;
