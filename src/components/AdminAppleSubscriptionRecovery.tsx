import { useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

type AppleBinding = {
  original_transaction_id: string;
  bound_user_id: string;
  app_account_token?: string | null;
  latest_transaction_id?: string | null;
  product_id?: string | null;
  environment?: string | null;
  first_bound_at?: string | null;
  last_verified_at?: string | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
};

type UserSummary = {
  id: string;
  email?: string | null;
  created_at?: string | null;
};

type LookupResult = {
  binding?: AppleBinding | null;
  subscription?: SubscriptionRow | null;
  currentOwner?: UserSummary | null;
  targetUser?: UserSummary | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function AdminAppleSubscriptionRecovery() {
  const [originalTransactionId, setOriginalTransactionId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);

  const lookupBinding = async () => {
    const normalizedOriginalTransactionId = originalTransactionId.trim();
    if (!normalizedOriginalTransactionId) {
      toast.error("Original transaction ID is required");
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-apple-subscription-binding", {
        body: {
          action: "lookup",
          originalTransactionId: normalizedOriginalTransactionId,
          targetUserId: targetUserId.trim() || undefined,
        },
      });

      if (error) throw error;
      setLookupResult(data as LookupResult);
      if (!data?.binding) {
        toast.warning("No binding found for that transaction");
      }
    } catch (error) {
      console.error("Apple subscription binding lookup failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to lookup Apple binding");
    } finally {
      setIsLookingUp(false);
    }
  };

  const reassignBinding = async () => {
    const normalizedOriginalTransactionId = originalTransactionId.trim();
    const normalizedTargetUserId = targetUserId.trim();
    const normalizedReason = reason.trim();

    if (!normalizedOriginalTransactionId || !normalizedTargetUserId) {
      toast.error("Original transaction ID and target user ID are required");
      return;
    }

    if (normalizedReason.length < 8) {
      toast.error("Add a short support reason before reassigning");
      return;
    }

    const currentOwner = lookupResult?.binding?.bound_user_id ?? "the current user";
    const confirmed = window.confirm(
      `Reassign this App Store purchase from ${currentOwner} to ${normalizedTargetUserId}? This should only be done after verifying ownership.`,
    );
    if (!confirmed) return;

    setIsReassigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-apple-subscription-binding", {
        body: {
          action: "reassign",
          originalTransactionId: normalizedOriginalTransactionId,
          targetUserId: normalizedTargetUserId,
          reason: normalizedReason,
        },
      });

      if (error) throw error;
      setLookupResult(data as LookupResult);
      toast.success("Apple subscription binding reassigned");
    } catch (error) {
      console.error("Apple subscription binding reassignment failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reassign Apple binding");
    } finally {
      setIsReassigning(false);
    }
  };

  const binding = lookupResult?.binding;
  const subscription = lookupResult?.subscription;

  return (
    <Card className="mb-8 rounded-3xl shadow-soft">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Apple Subscription Recovery
            </CardTitle>
            <CardDescription>
              Move a verified App Store transaction to the correct Cosmiq account after support confirms ownership.
            </CardDescription>
          </div>
          <Badge variant="outline">Admin only</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="apple-original-transaction-id">Original transaction ID</Label>
            <Input
              id="apple-original-transaction-id"
              value={originalTransactionId}
              onChange={(event) => setOriginalTransactionId(event.target.value)}
              placeholder="Apple original_transaction_id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apple-target-user-id">Target Cosmiq user ID</Label>
            <Input
              id="apple-target-user-id"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder="Supabase user UUID"
            />
          </div>
        </div>

        <Button variant="outline" onClick={lookupBinding} disabled={isLookingUp}>
          {isLookingUp ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Lookup binding
        </Button>

        {lookupResult && (
          <div className="grid gap-4 rounded-2xl border bg-card/70 p-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">Current Binding</h3>
              {binding ? (
                <>
                  <p><span className="text-muted-foreground">Owner:</span> {binding.bound_user_id}</p>
                  <p><span className="text-muted-foreground">Apple token:</span> {binding.app_account_token ?? "None"}</p>
                  <p><span className="text-muted-foreground">Product:</span> {binding.product_id ?? "Unknown"}</p>
                  <p><span className="text-muted-foreground">Environment:</span> {binding.environment ?? "Unknown"}</p>
                  <p><span className="text-muted-foreground">Last verified:</span> {formatDate(binding.last_verified_at)}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No binding found.</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Subscription Row</h3>
              {subscription ? (
                <>
                  <p><span className="text-muted-foreground">User:</span> {subscription.user_id}</p>
                  <p><span className="text-muted-foreground">Plan:</span> {subscription.plan ?? "Unknown"}</p>
                  <p><span className="text-muted-foreground">Status:</span> {subscription.status ?? "Unknown"}</p>
                  <p><span className="text-muted-foreground">Period end:</span> {formatDate(subscription.current_period_end)}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No subscription row found. The target user will need to restore after reassignment.</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="apple-transfer-reason">Support reason</Label>
          <Textarea
            id="apple-transfer-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: verified Apple receipt and duplicate-account ownership with support ticket #1234"
            className="min-h-24"
          />
        </div>

        <Button
          onClick={reassignBinding}
          disabled={isReassigning || !binding}
          className="w-full md:w-auto"
        >
          {isReassigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reassign to target user
        </Button>
      </CardContent>
    </Card>
  );
}
