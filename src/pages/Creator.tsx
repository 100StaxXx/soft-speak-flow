import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Link as LinkIcon, Sparkles, ArrowRight } from "lucide-react";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export default function Creator() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    handle: "",
    paypal_email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    code: string;
    link: string;
    promo_caption: string;
    creator_access_token?: string;
    dashboard_url?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-influencer-code",
        {
          body: formData,
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success("Your referral code is ready!");
    } catch (error) {
      console.error("Failed to create code:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create referral code"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const shareCode = async () => {
    if (!result) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: "Join me on Cosmiq!",
          text: result.promo_caption,
          url: result.link,
          dialogTitle: "Share your referral link",
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Cosmiq!",
          text: result.promo_caption,
          url: result.link,
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
    } else {
      await copyToClipboard(result.link, "Link");
    }
  };

  if (result) {
    return (
      <div className="min-h-screen pb-nav-safe relative overflow-hidden">
        <StarfieldBackground />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-8 cosmic-glass">
            <div className="text-center mb-8">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <h1 className="font-heading text-3xl font-bold mb-2">
                Your Code is Ready! ✨
              </h1>
              <p className="text-muted-foreground">
                Start sharing and earn rewards when your followers subscribe
              </p>
            </div>

            {/* Dashboard Button */}
            <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <Button
                onClick={() => {
                  const params = new URLSearchParams({ code: result.code });
                  if (result.creator_access_token) {
                    params.set("token", result.creator_access_token);
                  }
                  navigate(`/creator/dashboard?${params.toString()}`);
                }}
                className="w-full"
                size="lg"
              >
                View Your Dashboard →
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Track your referrals and earnings
              </p>
            </div>

            <div className="space-y-6">
              {/* Referral Code */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2">
                  Your Referral Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={result.code}
                    readOnly
                    className="font-mono text-lg font-bold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(result.code, "Code")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Shareable Link */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2">
                  Shareable Link
                </Label>
                <div className="flex gap-2">
                  <Input value={result.link} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(result.link, "Link")}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Promo Caption */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2">
                  Pre-written Caption
                </Label>
                <div className="bg-secondary/20 p-4 rounded-lg">
                  <p className="text-sm mb-3">{result.promo_caption}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(result.promo_caption, "Caption")
                    }
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy Caption
                  </Button>
                </div>
              </div>

              {/* Share Button */}
              <Button
                onClick={shareCode}
                className="w-full"
                size="lg"
              >
                <ArrowRight className="h-5 w-5 mr-2" />
                Share Now
              </Button>

              {/* How it Works */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="font-semibold mb-2">How it Works</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Share your code or link with your audience</li>
                  <li>• Earn 50% of their first month ($5) or 20% of first year ($12)</li>
                  <li>• Minimum payout: $50 via PayPal</li>
                  <li>• Payouts require admin approval</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 cosmic-glass">
          <div className="text-center mb-8">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="font-heading text-3xl font-bold mb-2">
              Creator Portal
            </h1>
            <p className="text-muted-foreground">
              Get your referral code and start earning rewards
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Your full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label htmlFor="handle">Social Handle *</Label>
              <Input
                id="handle"
                value={formData.handle}
                onChange={(e) =>
                  setFormData({ ...formData, handle: e.target.value })
                }
                required
                placeholder="@yourusername"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your TikTok, Instagram, or other social media handle
              </p>
            </div>

            <div>
              <Label htmlFor="paypal_email">PayPal Email *</Label>
              <Input
                id="paypal_email"
                type="email"
                value={formData.paypal_email}
                onChange={(e) =>
                  setFormData({ ...formData, paypal_email: e.target.value })
                }
                required
                placeholder="paypal@email.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Where we'll send your payouts
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Get My Code"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-2 text-sm">Rewards Structure</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• 50% of first month subscription ($5)</li>
              <li>• 20% of first year subscription ($20)</li>
              <li>• $50 minimum payout threshold</li>
              <li>• Payments via PayPal after admin approval</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
