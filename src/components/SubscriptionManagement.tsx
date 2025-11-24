import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

export function SubscriptionManagement() {
  const { subscription, isLoading, isActive, isCancelled, nextBillingDate, planPrice, plan } = useSubscription();
  const { toast } = useToast();
  const [openingPortal, setOpeningPortal] = useState(false);

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error("Error opening customer portal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription management",
        variant: "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You don't have an active subscription.
          </p>
          <Button onClick={() => window.location.href = '/premium'}>
            View Premium Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Subscription Details
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-normal">
              <CheckCircle2 className="h-4 w-4" />
              Active
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-600 text-sm font-normal">
              <XCircle className="h-4 w-4" />
              Cancelled
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="font-medium capitalize">{plan || 'Monthly'}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="font-medium">{planPrice}</span>
          </div>
          
          {nextBillingDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Next Billing Date</span>
              <span className="font-medium">
                {nextBillingDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleManageSubscription}
            disabled={openingPortal}
            className="w-full"
            variant="outline"
          >
            {openingPortal ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening Portal...
              </>
            ) : (
              "Manage Subscription"
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Cancel, update payment method, or view billing history
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
