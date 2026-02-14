import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Users,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface ReferralPayout {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code_id: string | null;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected" | "requested" | "failed";
  payout_type: "first_month" | "first_year";
  apple_transaction_id: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  admin_notes: string | null;
  paypal_transaction_id: string | null;
  retry_count: number | null;
  last_retry_at: string | null;
  failure_reason: string | null;
  next_retry_at: string | null;
  referral_code: {
    code: string;
    owner_type: "user" | "influencer";
    owner_user_id: string | null;
    influencer_name: string | null;
    influencer_email: string | null;
    influencer_handle: string | null;
    payout_identifier: string | null;
  } | null;
  referee: {
    email: string;
  };
}

interface ReferrerSummary {
  referral_code_id: string;
  code: string;
  owner_type: "user" | "influencer";
  referrer_name: string;
  referrer_email: string;
  referrer_handle: string | null;
  paypal_email: string | null;
  total_pending: number;
  total_approved: number;
  total_paid: number;
  pending_count: number;
  approved_count: number;
  paid_count: number;
}

const MINIMUM_PAYOUT_THRESHOLD = 50; // $50 minimum

export const AdminPayouts = () => {
  const queryClient = useQueryClient();
  const [selectedReferrer, setSelectedReferrer] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch all payouts with referral code and referee info
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["admin-referral-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_payouts")
        .select(`
          *,
          referral_code:referral_codes!referral_code_id(
            code,
            owner_type,
            owner_user_id,
            influencer_name,
            influencer_email,
            influencer_handle,
            payout_identifier
          ),
          referee:profiles!referee_id(email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ReferralPayout[];
    },
  });

  // Calculate referrer summaries by referral_code_id
  const referrerSummaries: ReferrerSummary[] = payouts
    ? Object.values(
        payouts
          .filter((p) => p.referral_code_id) // Only include payouts with referral codes
          .reduce((acc, payout) => {
            const id = payout.referral_code_id!;
            if (!acc[id]) {
              const rc = payout.referral_code;
              acc[id] = {
                referral_code_id: id,
                code: rc?.code || "Unknown",
                owner_type: rc?.owner_type || "user",
                referrer_name:
                  rc?.owner_type === "influencer"
                    ? rc.influencer_name || "Unknown"
                    : rc?.influencer_email || "Unknown",
                referrer_email:
                  rc?.owner_type === "influencer"
                    ? rc.influencer_email || ""
                    : rc?.influencer_email || "",
                referrer_handle:
                  rc?.owner_type === "influencer" ? rc.influencer_handle : null,
                paypal_email: rc?.payout_identifier || null,
                total_pending: 0,
                total_approved: 0,
                total_paid: 0,
                pending_count: 0,
                approved_count: 0,
                paid_count: 0,
              };
            }
            if (payout.status === "pending") {
              acc[id].total_pending += Number(payout.amount);
              acc[id].pending_count++;
            } else if (payout.status === "approved") {
              acc[id].total_approved += Number(payout.amount);
              acc[id].approved_count++;
            } else if (payout.status === "paid") {
              acc[id].total_paid += Number(payout.amount);
              acc[id].paid_count++;
            }
            return acc;
          }, {} as Record<string, ReferrerSummary>)
      )
    : [];

  // Approve payout mutation
  const approveMutation = useMutation({
    mutationFn: async ({
      payoutId,
      notes,
    }: {
      payoutId: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("referral_payouts")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq("id", payoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
      toast.success("Payout approved");
      setAdminNotes("");
    },
    onError: (error) => {
      console.error("Failed to approve payout:", error);
      toast.error("Failed to approve payout");
    },
  });

  // Reject payout mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      payoutId,
      notes,
    }: {
      payoutId: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("referral_payouts")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          admin_notes: notes || null,
        })
        .eq("id", payoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
      toast.success("Payout rejected");
      setAdminNotes("");
    },
    onError: (error) => {
      console.error("Failed to reject payout:", error);
      toast.error("Failed to reject payout");
    },
  });

  // Process payout via PayPal
  const processPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      setProcessingId(payoutId);
      const { data, error } = await supabase.functions.invoke(
        "process-paypal-payout",
        {
          body: { payout_id: payoutId },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
      toast.success(`Payout processed! PayPal Batch ID: ${data.payout_batch_id}`);
      setProcessingId(null);
    },
    onError: (error) => {
      console.error("Failed to process payout:", error);
      toast.error(`Failed to process payout: ${error.message}`);
      setProcessingId(null);
    },
  });

  // Bulk retry all failed payouts
  const bulkRetryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "retry-failed-payouts",
        {}
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
      toast.success(`Retried ${data.processed || 0} failed payouts`);
    },
    onError: (error) => {
      console.error("Failed to bulk retry:", error);
      toast.error(`Failed to retry payouts: ${error.message}`);
    },
  });

  // Bulk approve all pending payouts for a referral code
  const bulkApproveMutation = useMutation({
    mutationFn: async (referralCodeId: string) => {
      const pendingPayouts = payouts?.filter(
        (p) => p.referral_code_id === referralCodeId && p.status === "pending"
      );
      if (!pendingPayouts || pendingPayouts.length === 0) return;

      const { error } = await supabase
        .from("referral_payouts")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("referral_code_id", referralCodeId)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
      toast.success("All pending payouts approved");
    },
    onError: (error) => {
      console.error("Failed to bulk approve:", error);
      toast.error("Failed to approve payouts");
    },
  });

  // Calculate failed payouts count
  const failedPayoutsCount = payouts?.filter((p) => p.status === "failed").length || 0;

  const selectedReferrerPayouts = payouts?.filter(
    (p) => p.referral_code_id === selectedReferrer
  );

  const selectedSummary = referrerSummaries.find(
    (s) => s.referral_code_id === selectedReferrer
  );

  if (payoutsLoading) {
    return (
      <Card className="p-6 rounded-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8 rounded-3xl shadow-soft">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl font-semibold">
          Referral Payouts Management
        </h2>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Pending</p>
          <p className="text-xl font-bold text-yellow-500">
            ${payouts
              ?.filter((p) => p.status === "pending")
              .reduce((sum, p) => sum + Number(p.amount), 0)
              .toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Approved</p>
          <p className="text-xl font-bold text-blue-500">
            ${payouts
              ?.filter((p) => p.status === "approved")
              .reduce((sum, p) => sum + Number(p.amount), 0)
              .toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-500">
            ${payouts
              ?.filter((p) => p.status === "paid")
              .reduce((sum, p) => sum + Number(p.amount), 0)
              .toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Referrers</p>
          <p className="text-xl font-bold text-primary">
            {referrerSummaries.length}
          </p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/20">
          <p className="text-xs text-muted-foreground mb-1">Failed</p>
          <p className="text-xl font-bold text-red-500">
            {failedPayoutsCount}
          </p>
        </div>
      </div>

      {/* Failed Payouts Alert */}
      {failedPayoutsCount > 0 && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-600">
                {failedPayoutsCount} failed payout(s) need attention
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-50"
              onClick={() => bulkRetryMutation.mutate()}
              disabled={bulkRetryMutation.isPending}
            >
              {bulkRetryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Retry All Failed
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
        Minimum payout threshold: ${MINIMUM_PAYOUT_THRESHOLD}. Only process
        payouts when referrer total reaches this amount.
      </p>

      {/* Referrer List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Referrers
        </h3>

        {referrerSummaries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No referral payouts yet
          </p>
        ) : (
          <div className="space-y-3">
            {referrerSummaries.map((summary) => {
              const totalEarnings =
                summary.total_pending +
                summary.total_approved +
                summary.total_paid;
              const readyForPayout =
                summary.total_approved >= MINIMUM_PAYOUT_THRESHOLD;
              const isSelected = selectedReferrer === summary.referral_code_id;

              return (
                <div
                  key={summary.referral_code_id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() =>
                    setSelectedReferrer(
                      isSelected ? null : summary.referral_code_id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{summary.referrer_name}</p>
                        {summary.owner_type === "influencer" && (
                          <Badge variant="secondary" className="text-xs">
                            Influencer
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {summary.referrer_email}
                      </p>
                      {summary.referrer_handle && (
                        <p className="text-xs text-primary">
                          {summary.referrer_handle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Code: {summary.code}
                      </p>
                      {summary.paypal_email && (
                        <p className="text-xs text-green-600">
                          PayPal: {summary.paypal_email}
                        </p>
                      )}
                      {!summary.paypal_email && (
                        <p className="text-xs text-red-500">
                          No PayPal email set
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        ${totalEarnings.toFixed(2)}
                      </p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-yellow-500">
                          P: ${summary.total_pending.toFixed(2)}
                        </span>
                        <span className="text-blue-500">
                          A: ${summary.total_approved.toFixed(2)}
                        </span>
                        <span className="text-green-500">
                          D: ${summary.total_paid.toFixed(2)}
                        </span>
                      </div>
                      {readyForPayout && summary.paypal_email && (
                        <Badge className="mt-1 bg-green-500">
                          Ready for payout
                        </Badge>
                      )}
                      {summary.total_approved > 0 &&
                        summary.total_approved < MINIMUM_PAYOUT_THRESHOLD && (
                          <Badge variant="outline" className="mt-1">
                            ${(MINIMUM_PAYOUT_THRESHOLD - summary.total_approved).toFixed(2)} more needed
                          </Badge>
                        )}
                    </div>
                  </div>

                  {/* Expanded Payout Details */}
                  {isSelected && selectedReferrerPayouts && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Bulk Actions */}
                      {summary.pending_count > 0 && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              bulkApproveMutation.mutate(summary.referral_code_id);
                            }}
                            disabled={bulkApproveMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve All Pending ({summary.pending_count})
                          </Button>
                        </div>
                      )}

                      {/* Individual Payouts */}
                      <div className="space-y-2">
                        {selectedReferrerPayouts.map((payout) => (
                          <div
                            key={payout.id}
                            className="flex items-center justify-between bg-secondary/20 rounded-lg p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    payout.status === "paid"
                                      ? "default"
                                      : payout.status === "approved"
                                      ? "secondary"
                                      : payout.status === "rejected"
                                      ? "destructive"
                                      : "outline"
                                  }
                                >
                                  {payout.status}
                                </Badge>
                                <span className="font-medium">
                                  ${Number(payout.amount).toFixed(2)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {payout.payout_type === "first_month"
                                    ? "Monthly"
                                    : "Yearly"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Referee: {payout.referee?.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payout.created_at).toLocaleDateString()}
                              </p>
                              {payout.admin_notes && (
                                <p className="text-xs text-amber-600 mt-1">
                                  Note: {payout.admin_notes}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {payout.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-600 hover:bg-green-50"
                                    onClick={() =>
                                      approveMutation.mutate({
                                        payoutId: payout.id,
                                        notes: adminNotes,
                                      })
                                    }
                                    disabled={approveMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-600 hover:bg-red-50"
                                    onClick={() =>
                                      rejectMutation.mutate({
                                        payoutId: payout.id,
                                        notes: adminNotes,
                                      })
                                    }
                                    disabled={rejectMutation.isPending}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {payout.status === "approved" && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() =>
                                    processPayoutMutation.mutate(payout.id)
                                  }
                                  disabled={
                                    processingId === payout.id ||
                                    !summary.paypal_email
                                  }
                                >
                                  {processingId === payout.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-1" />
                                      Pay
                                    </>
                                  )}
                                </Button>
                              )}
                              {payout.status === "paid" && (
                                <span className="text-green-600 text-sm flex items-center">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Paid
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Admin Notes Input */}
                      {selectedSummary &&
                        (selectedSummary.pending_count > 0 ||
                          selectedSummary.approved_count > 0) && (
                          <div className="pt-2">
                            <Textarea
                              placeholder="Admin notes (optional)"
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
