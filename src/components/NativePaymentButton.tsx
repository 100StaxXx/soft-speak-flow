import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NativePaymentButtonProps {
  amount: number;
  currency?: string;
  label: string;
  onSuccess?: () => void;
}

export const NativePaymentButton = ({ 
  amount, 
  currency = "usd", 
  label,
  onSuccess 
}: NativePaymentButtonProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // Create payment intent on backend
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: { amount, currency }
        }
      );

      if (paymentError) throw paymentError;

      // For now, simulate successful payment
      // In production with native apps, the Capacitor Stripe plugin will handle Apple Pay/Google Pay
      toast({
        title: "Payment Ready",
        description: `Payment of ${(amount / 100).toFixed(2)} ${currency.toUpperCase()} initialized. Apple Pay and Google Pay will work on native iOS/Android builds.`,
      });
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full py-7 text-lg font-black uppercase tracking-wider bg-gradient-to-r from-primary to-accent"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-5 w-5" />
          Pay with Apple Pay / Google Pay
        </>
      )}
    </Button>
  );
};
