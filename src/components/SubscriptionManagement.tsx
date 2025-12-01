import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core';
import { IAP_PRODUCTS } from "@/utils/appleIAP";

export function SubscriptionManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscription, isLoading, isActive, nextBillingDate, planPrice, plan } = useSubscription();
  const { handlePurchase, handleRestore, loading: purchasing, isAvailable } = useAppleSubscription();

  const handleManageSubscription = async () => {
    if (Capacitor.isNativePlatform()) {
      // On iOS, direct users to Settings
      toast({
        title: "Manage Subscription",
        description: "Open Settings > [Your Name] > Subscriptions to manage your R-Evolution subscription",
      });
    } else {
      toast({
        title: "iOS Only",
        description: "Subscription management is only available on iOS devices",
        variant: "destructive",
      });
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

  const handleSubscribe = async () => {
    const success = await handlePurchase(IAP_PRODUCTS.MONTHLY);
    if (success) {
      toast({
        title: "Success!",
        description: "Your subscription is now active",
      });
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You don't have an active subscription.
          </p>
          
          {!isAvailable && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm text-muted-foreground text-center">
                In-App Purchases are only available on iOS devices
              </p>
            </div>
          )}
          
          <Button 
            onClick={handleSubscribe}
            disabled={purchasing || !isAvailable}
            className="w-full"
          >
            {purchasing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" />
                Subscribe to Premium
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Subscription Details
        </CardTitle>
        <CardDescription>
          Manage your R-Evolution Premium subscription
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          {plan && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{plan}</span>
            </div>
          )}

          {planPrice && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium">{planPrice}</span>
            </div>
          )}

          {nextBillingDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Renews On</span>
              <span className="font-medium">
                {nextBillingDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={handleManageSubscription}
          variant="outline"
          className="w-full"
        >
          <Settings className="mr-2 h-4 w-4" />
          Manage in iOS Settings
        </Button>
        <Button
          onClick={handleRestore}
          disabled={purchasing}
          variant="ghost"
          className="w-full"
        >
          {purchasing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            "Restore Purchases"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
