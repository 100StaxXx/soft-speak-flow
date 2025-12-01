import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Share, Copy, Users, Gift, DollarSign, Clock, CheckCircle2, Loader2, Send, AlertCircle } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share as CapacitorShare } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const MINIMUM_PAYOUT_THRESHOLD = 50; // $50 minimum

export const ReferralDashboard = () => {
  const { referralStats, availableSkins } = useReferrals();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [isSharing, setIsSharing] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState(profile?.paypal_email || "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  // Update paypalEmail when profile loads
  useEffect(() => {
    if (profile?.paypal_email) {
      setPaypalEmail(profile.paypal_email);
    }
  }, [profile?.paypal_email]);

  // Fetch user's payouts via their referral_code
  const { data: payouts } = useQuery({
    queryKey: ["referral-payouts", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // First get the user's referral_code_id
      const { data: codeData } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("owner_user_id", profile.id)
        .eq("owner_type", "user")
        .maybeSingle();

      if (!codeData) return [];

      // Then fetch payouts for that referral code
      const { data, error } = await supabase
        .from("referral_payouts")
        .select("*")
        .eq("referral_code_id", codeData.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds
    enabled: !!profile?.id,
  });

  const handleSavePayPalEmail = async () => {
    if (!paypalEmail || !paypalEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSavingEmail(true);
    try {
      // Update both profiles and referral_codes tables
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ paypal_email: paypalEmail })
        .eq("id", profile?.id);

      if (profileError) throw profileError;

      // Also update the referral_codes payout_identifier
      const { error: codeError } = await supabase
        .from("referral_codes")
        .update({ payout_identifier: paypalEmail })
        .eq("owner_user_id", profile?.id)
        .eq("owner_type", "user");

      if (codeError) throw codeError;

      toast.success("PayPal email saved!");
    } catch (error) {
      console.error("Failed to save PayPal email:", error);
      toast.error("Failed to save PayPal email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!profile?.paypal_email && !paypalEmail) {
      toast.error("Please set your PayPal email first");
      return;
    }

    setIsRequestingPayout(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-referral-payout");

      if (error) throw error;
      
      if (data.error) {
        if (data.code === "BELOW_THRESHOLD") {
          toast.error(`You need $${data.amount_needed.toFixed(2)} more to request a payout`);
        } else if (data.code === "NO_PAYPAL_EMAIL") {
          toast.error("Please set your PayPal email first");
        } else if (data.code === "NO_PENDING_PAYOUTS") {
          toast.info("No pending payouts to request");
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success(data.message || "Payout request submitted!");
      queryClient.invalidateQueries({ queryKey: ["referral-payouts"] });
    } catch (error) {
      console.error("Failed to request payout:", error);
      toast.error("Failed to request payout. Please try again.");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const totalEarnings = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const pendingAmount = payouts?.filter(p => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const approvedAmount = payouts?.filter(p => p.status === "approved").reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const paidAmount = payouts?.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const availableForPayout = pendingAmount + approvedAmount;
  const progressToThreshold = Math.min((availableForPayout / MINIMUM_PAYOUT_THRESHOLD) * 100, 100);
  const canRequestPayout = pendingAmount >= MINIMUM_PAYOUT_THRESHOLD && (profile?.paypal_email || paypalEmail);
  const hasRequestedPayout = payouts?.some(p => p.status === "pending" && p.admin_notes?.includes("Payout requested"));

  const handleShare = async () => {
    if (!referralStats?.referral_code) return;
    setIsSharing(true);

    const shareText = `Join me on R-Evolution and use my code: ${referralStats.referral_code}`;

    try {
      // Use native share on mobile
      if (Capacitor.isNativePlatform()) {
        try {
          await CapacitorShare.share({
            title: "Join R-Evolution",
            text: shareText,
            dialogTitle: "Share your referral code",
          });
        } catch (error) {
          console.error("Share failed:", error);
          
          // Check if user cancelled (case-insensitive)
          const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
          const isCancelled = errorMsg.includes('cancel') || 
                             errorMsg.includes('abort') || 
                             errorMsg.includes('dismissed') ||
                             error?.name === 'AbortError';
          
          if (!isCancelled) {
            await copyToClipboard();
          }
        }
      } else {
        // Fallback to Web Share API or clipboard
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Join R-Evolution",
              text: shareText,
            });
          } catch (error) {
            console.error("Share failed:", error);
            
            // Check if user cancelled (case-insensitive)
            const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
            const isCancelled = errorMsg.includes('cancel') || 
                               errorMsg.includes('abort') || 
                               errorMsg.includes('dismissed') ||
                               error?.name === 'AbortError';
            
            if (!isCancelled) {
              await copyToClipboard();
            }
          }
        } else {
          await copyToClipboard();
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!referralStats?.referral_code) return;
    
    try {
      // FIX: Check if Clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralStats.referral_code);
        toast.success("Referral code copied to clipboard!");
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = referralStats.referral_code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success("Referral code copied to clipboard!");
      }
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error(`Failed to copy. Your code: ${referralStats.referral_code}`);
    }
  };

  const nextMilestone = availableSkins?.find(
    (skin) => (skin.unlock_requirement || 0) > (referralStats?.referral_count || 0)
  );

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-bold">Referral Rewards</h3>
      </div>

      <div className="space-y-4">
        {/* Referral Code */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Your Referral Code</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary rounded-lg p-3 text-center font-mono text-lg font-bold">
              {referralStats?.referral_code || "Loading..."}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              disabled={!referralStats?.referral_code}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Share Button */}
        <Button
          className="w-full"
          onClick={handleShare}
          disabled={!referralStats?.referral_code || isSharing}
        >
          <Share className="mr-2 h-4 w-4" />
          {isSharing ? "Sharing..." : "Share Your Code"}
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center space-y-1">
            <p className="text-2xl font-bold text-primary">
              {referralStats?.referral_count || 0}
            </p>
            <p className="text-sm text-muted-foreground">Friends Referred</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-2xl font-bold text-primary">
              {nextMilestone?.unlock_requirement || 0}
            </p>
            <p className="text-sm text-muted-foreground">Next Milestone</p>
          </div>
        </div>

        {/* Next Reward Preview */}
        {nextMilestone && (
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gift className="h-4 w-4 text-primary" />
              <span>Next Reward</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Refer {(nextMilestone.unlock_requirement || 0) - (referralStats?.referral_count || 0)} more friend
              {(nextMilestone.unlock_requirement || 0) - (referralStats?.referral_count || 0) !== 1 ? 's' : ''} to unlock:
            </p>
            <p className="font-semibold">{nextMilestone.name}</p>
          </div>
        )}

        {/* Cash Earnings Section */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">Cash Earnings</h4>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-lg font-bold text-green-500">${totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-lg font-bold text-yellow-500">${pendingAmount.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Paid</p>
              <p className="text-lg font-bold text-blue-500">${paidAmount.toFixed(2)}</p>
            </div>
          </div>

          {/* Payout Threshold Progress */}
          <div className="bg-gradient-to-r from-primary/10 to-green-500/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payout Progress</span>
              <span className="text-sm text-muted-foreground">
                ${availableForPayout.toFixed(2)} / ${MINIMUM_PAYOUT_THRESHOLD}
              </span>
            </div>
            <Progress value={progressToThreshold} className="h-2" />
            
            {availableForPayout < MINIMUM_PAYOUT_THRESHOLD ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                ${(MINIMUM_PAYOUT_THRESHOLD - availableForPayout).toFixed(2)} more to reach minimum payout threshold
              </p>
            ) : hasRequestedPayout ? (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Payout requested! Our team will review your request soon.
              </p>
            ) : approvedAmount > 0 ? (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ${approvedAmount.toFixed(2)} approved and being processed
              </p>
            ) : (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                You've reached the minimum! Request your payout below.
              </p>
            )}

            {/* Request Payout Button */}
            {canRequestPayout && !hasRequestedPayout && (
              <Button
                onClick={handleRequestPayout}
                disabled={isRequestingPayout}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isRequestingPayout ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Request Payout (${pendingAmount.toFixed(2)})
                  </>
                )}
              </Button>
            )}
          </div>

          {/* PayPal Email Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">PayPal Email (for payouts)</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSavePayPalEmail}
                disabled={isSavingEmail || !paypalEmail}
                size="sm"
              >
                {isSavingEmail ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You earn 50% of first month ($5) or 20% of first year ($20) when friends subscribe. Minimum $50 for payout.
            </p>
          </div>

          {/* Payout History */}
          {payouts && payouts.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Payout History</h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between bg-secondary/20 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      {payout.status === "paid" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {payout.status === "pending" && <Clock className="h-4 w-4 text-yellow-500" />}
                      {payout.status === "approved" && <Clock className="h-4 w-4 text-blue-500" />}
                      <div>
                        <p className="text-sm font-medium">${Number(payout.amount).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {payout.payout_type === "first_month" ? "Monthly" : "Yearly"} referral
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        payout.status === "paid" ? "default" :
                        payout.status === "approved" ? "secondary" : "outline"
                      }
                    >
                      {payout.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
