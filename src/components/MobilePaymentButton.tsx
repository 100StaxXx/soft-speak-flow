import { useEffect, useState } from "react";
import { PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import { useStripe } from "@stripe/react-stripe-js";
import { useToast } from "@/hooks/use-toast";
import type { PaymentRequest } from "@stripe/stripe-js";

interface MobilePaymentButtonProps {
  amount: number; // Amount in cents
  currency?: string;
  label: string;
  onSuccess?: () => void;
}

export const MobilePaymentButton = ({ 
  amount, 
  currency = "usd", 
  label,
  onSuccess 
}: MobilePaymentButtonProps) => {
  const stripe = useStripe();
  const { toast } = useToast();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: currency,
      total: {
        label: label,
        amount: amount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Apple Pay or Google Pay is available
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      }
    });

    pr.on("paymentmethod", async (e) => {
      try {
        // Here you would typically create a payment intent on your server
        // For now, we'll just simulate success
        toast({
          title: "Payment Successful",
          description: `Processed ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`,
        });
        
        e.complete("success");
        onSuccess?.();
      } catch (error) {
        e.complete("fail");
        toast({
          title: "Payment Failed",
          description: "Please try again",
          variant: "destructive",
        });
      }
    });
  }, [stripe, amount, currency, label, onSuccess, toast]);

  if (!canMakePayment || !paymentRequest) {
    return null;
  }

  return (
    <div className="w-full">
      <PaymentRequestButtonElement 
        options={{ 
          paymentRequest,
          style: {
            paymentRequestButton: {
              type: 'default',
              theme: 'dark',
              height: '48px',
            }
          }
        }} 
      />
    </div>
  );
};
