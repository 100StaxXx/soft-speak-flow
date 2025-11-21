import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Calendar, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSubscription, cancelSubscription, resumeSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SubscriptionManagement() {
  const {
    subscription,
    isActive,
    isTrialing,
    isPastDue,
    trialDaysRemaining,
    nextBillingDate,
    planPrice,
    plan,
    willCancelAt,
    refetch,
  } = useSubscription();

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    if (!subscription?.stripe_subscription_id) return;

    try {
      setIsLoading(true);
      await cancelSubscription(subscription.stripe_subscription_id);

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will end at the end of the current billing period.",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!subscription?.stripe_subscription_id) return;

    try {
      setIsLoading(true);
      await resumeSubscription(subscription.stripe_subscription_id);

      toast({
        title: "Subscription Resumed",
        description: "Your subscription will continue automatically.",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resume subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!subscription) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <CardTitle>Premium Subscription</CardTitle>
        </div>
        <CardDescription>Manage your subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isActive ? (
            <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Active
            </div>
          ) : isPastDue ? (
            <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              Past Due
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm font-medium">
              Cancelled
            </div>
          )}

          {isTrialing && (
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {trialDaysRemaining} days trial remaining
            </div>
          )}
        </div>

        {/* Plan Details */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Plan</p>
              <p className="text-sm text-muted-foreground capitalize">
                {plan} - {planPrice}
              </p>
            </div>
          </div>

          {nextBillingDate && !willCancelAt && (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {isTrialing ? "Trial ends" : "Next billing date"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nextBillingDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}

          {willCancelAt && (
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Subscription ending</p>
                <p className="text-sm text-muted-foreground">
                  {willCancelAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-2">
          {willCancelAt ? (
            <Button
              onClick={handleResume}
              disabled={isLoading}
              className="w-full"
              variant="default"
            >
              Resume Subscription
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={isLoading}
                >
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll lose access to premium features at the end of your current billing period
                    on{" "}
                    {nextBillingDate?.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    . You can resume anytime before then.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {isPastDue && (
            <p className="text-xs text-destructive text-center">
              Please update your payment method to continue your subscription
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
