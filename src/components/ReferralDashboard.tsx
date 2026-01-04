import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share, Copy, Users, Gift } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { toast } from "sonner";
import { Share as CapacitorShare } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export const ReferralDashboard = memo(() => {
  const { referralStats, availableSkins } = useReferrals();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!referralStats?.referral_code) return;
    setIsSharing(true);

    const shareText = `Join me on Cosmiq and use my code: ${referralStats.referral_code}`;

    try {
      // Use native share on mobile
      if (Capacitor.isNativePlatform()) {
        try {
          await CapacitorShare.share({
            title: "Join Cosmiq",
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
              title: "Join Cosmiq",
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
      </div>
    </Card>
  );
});
ReferralDashboard.displayName = 'ReferralDashboard';
