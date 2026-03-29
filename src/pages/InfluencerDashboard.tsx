import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Users,
  DollarSign,
  Copy,
  Share2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { safeLocalStorage, safeSessionStorage } from "@/utils/storage";

interface CreatorDashboardData {
  creator: {
    code: string;
    name: string | null;
    handle: string | null;
    contact_email_masked: string | null;
    payout_destination_masked: string | null;
    created_at: string;
  };
  stats: {
    total_signups: number;
    active_subscribers: number;
    pending_earnings: number;
    requested_earnings: number;
    paid_earnings: number;
    total_earnings: number;
  };
  recent_signups: Array<{
    id: string;
    email_masked: string | null;
    created_at: string;
    subscription_status: string | null;
  }>;
  payout_history: Array<{
    amount: number;
    status: string;
    payout_type: string;
    created_at: string;
    paid_at: string | null;
  }>;
}

type DashboardError = Error & {
  code?: string;
};

const InfluencerDashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [creatorAccessToken, setCreatorAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const urlCode = searchParams.get("code");
    const urlToken = searchParams.get("token");
    const storedCode = safeLocalStorage.getItem("influencer_code");
    const storedToken = safeSessionStorage.getItem("influencer_dashboard_token");

    if (urlCode) {
      const normalizedCode = urlCode.toUpperCase();
      setVerifiedCode(normalizedCode);
      safeLocalStorage.setItem("influencer_code", normalizedCode);

      if (urlToken) {
        setCreatorAccessToken(urlToken);
        safeSessionStorage.setItem("influencer_dashboard_token", urlToken);
      } else {
        setCreatorAccessToken(null);
        safeSessionStorage.removeItem("influencer_dashboard_token");
      }

      navigate("/creator/dashboard", { replace: true });
      return;
    }

    if (storedCode) {
      setVerifiedCode(storedCode);
    }

    if (storedToken) {
      setCreatorAccessToken(storedToken);
    }
  }, [navigate, searchParams]);

  const creatorDashboardQuery = useQuery({
    queryKey: ["creator-dashboard", verifiedCode, creatorAccessToken],
    enabled: Boolean(verifiedCode && creatorAccessToken),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-creator-stats", {
        body: {
          referral_code: verifiedCode,
          creator_access_token: creatorAccessToken,
        },
      });

      if (error) {
        const requestError = new Error(error.message) as DashboardError;
        throw requestError;
      }

      if (data?.error) {
        const responseError = new Error(data.error) as DashboardError;
        responseError.code = data.code;
        throw responseError;
      }

      return data as CreatorDashboardData;
    },
  });

  useEffect(() => {
    if (!creatorDashboardQuery.error) {
      return;
    }

    const error = creatorDashboardQuery.error as DashboardError;
    if (error.code === "INVALID_CREATOR_TOKEN") {
      safeSessionStorage.removeItem("influencer_dashboard_token");
      setCreatorAccessToken(null);
      toast.error("Your secure creator session expired. Re-open the dashboard link from your email.");
    }
  }, [creatorDashboardQuery.error]);

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!verifiedCode) {
        throw new Error("Missing referral code");
      }
      if (!creatorAccessToken) {
        throw new Error("Secure creator session expired. Re-open your dashboard link from email.");
      }

      const { data, error } = await supabase.functions.invoke("request-referral-payout", {
        body: {
          referral_code: verifiedCode,
          creator_access_token: creatorAccessToken,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Payout request submitted!");
      queryClient.invalidateQueries({ queryKey: ["creator-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to request payout");
    },
  });

  const copyCode = () => {
    if (!verifiedCode) return;
    navigator.clipboard.writeText(verifiedCode);
    toast.success("Code copied to clipboard!");
  };

  const copyLink = () => {
    if (!verifiedCode) return;
    const link = `${window.location.origin}/?ref=${verifiedCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const shareCode = async () => {
    if (!verifiedCode) return;

    const shareText = `✨ Transform your habits into an epic journey with Cosmiq! Use my code ${verifiedCode} or click: ${window.location.origin}/?ref=${verifiedCode}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          text: shareText,
          dialogTitle: "Share Your Referral Code",
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
      return;
    }

    navigator.clipboard.writeText(shareText);
    toast.success("Promo text copied to clipboard!");
  };

  const logout = () => {
    safeLocalStorage.removeItem("influencer_code");
    safeSessionStorage.removeItem("influencer_dashboard_token");
    setVerifiedCode(null);
    setCreatorAccessToken(null);
    navigate("/creator");
  };

  if (!verifiedCode || !creatorAccessToken) {
    return (
      <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-background via-background/95 to-primary/5 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 rounded-3xl shadow-soft text-center">
            <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="font-heading text-3xl font-bold mb-3">
              Secure Creator Access Required
            </h1>
            <p className="text-muted-foreground mb-6">
              Open the secure dashboard link from your creator confirmation email to view your stats and request payouts.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/creator")}
              >
                Go To Creator Portal
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={logout}
              >
                Clear Saved Session
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (creatorDashboardQuery.isLoading) {
    return (
      <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-background via-background/95 to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (creatorDashboardQuery.isError || !creatorDashboardQuery.data) {
    const message = creatorDashboardQuery.error instanceof Error
      ? creatorDashboardQuery.error.message
      : "Unable to load creator dashboard";

    return (
      <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-background via-background/95 to-primary/5 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 rounded-3xl shadow-soft text-center">
            <h1 className="font-heading text-2xl font-bold mb-4 text-destructive">
              Secure Link Needed
            </h1>
            <p className="text-muted-foreground mb-6">
              {message}
            </p>
            <div className="space-y-3">
              <Button onClick={logout} className="w-full">
                Reopen Creator Portal
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/creator")}>
                Request A Fresh Link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const dashboard = creatorDashboardQuery.data;
  const creator = dashboard.creator;
  const stats = dashboard.stats;
  const conversions = dashboard.recent_signups;
  const payouts = dashboard.payout_history;

  return (
    <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-background via-background/95 to-primary/5 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold mb-2">
              Welcome back, {creator.name || creator.code}! 👋
            </h1>
            <p className="text-muted-foreground">
              Track your referrals and earnings
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Switch Link
          </Button>
        </div>

        <Card className="p-6 mb-6 rounded-3xl shadow-soft">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
              <code className="text-3xl font-bold font-mono text-primary">
                {creator.code}
              </code>
              <p className="text-sm text-muted-foreground mt-2">
                {creator.handle && `${creator.handle} • `}
                {creator.contact_email_masked || "Creator email hidden"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyCode} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
              <Button onClick={copyLink} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button onClick={shareCode}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary">{stats.total_signups}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.total_signups}</p>
            <p className="text-sm text-muted-foreground">Total Sign-Ups</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <Badge variant="secondary">{stats.active_subscribers}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.active_subscribers}</p>
            <p className="text-sm text-muted-foreground">Active Subscribers</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8 text-green-600" />
              <Badge className="bg-green-500">${stats.total_earnings.toFixed(2)}</Badge>
            </div>
            <p className="text-2xl font-bold">${stats.total_earnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <Badge variant="outline">${stats.pending_earnings.toFixed(2)}</Badge>
            </div>
            <p className="text-2xl font-bold">${stats.pending_earnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Pending Payout</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 rounded-3xl shadow-soft">
            <h2 className="font-heading text-2xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Recent Sign-Ups
            </h2>
            {conversions.length > 0 ? (
              <div className="space-y-3">
                {conversions.map((conversion) => (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {conversion.email_masked || "Email hidden"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conversion.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        conversion.subscription_status === "active"
                          ? "default"
                          : "outline"
                      }
                    >
                      {conversion.subscription_status || "Free"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No sign-ups yet. Keep sharing your code!
              </p>
            )}
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <h2 className="font-heading text-2xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Payout History
            </h2>
            {payouts.length > 0 ? (
              <div className="space-y-3">
                {payouts.map((payout, index) => (
                  <div
                    key={`${payout.created_at}-${index}`}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">${Number(payout.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payout.created_at).toLocaleDateString()} •{" "}
                        {payout.payout_type === "first_month" ? "Monthly" : "Yearly"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        payout.status === "paid"
                          ? "default"
                          : payout.status === "pending"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {payout.status === "paid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {payout.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {payout.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No payouts yet. Earnings appear when users subscribe!
              </p>
            )}

            {stats.pending_earnings >= 50 && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      🎉 You've reached the $50 payout threshold!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Request your payout to be sent to{" "}
                      {creator.payout_destination_masked || "your saved payout destination"}
                    </p>
                  </div>
                  <Button
                    onClick={() => requestPayoutMutation.mutate()}
                    disabled={requestPayoutMutation.isPending}
                    className="shrink-0"
                  >
                    {requestPayoutMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4 mr-2" />
                    )}
                    Request Payout
                  </Button>
                </div>
              </div>
            )}

            {stats.requested_earnings > 0 && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm font-medium text-blue-600">
                  ⏳ Payout of ${stats.requested_earnings.toFixed(2)} is pending review
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Our team will process your payout request shortly.
                </p>
              </div>
            )}

            {stats.pending_earnings < 50 && stats.pending_earnings > 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm font-medium">
                  ${(50 - stats.pending_earnings).toFixed(2)} away from $50 minimum payout
                </p>
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6 mt-6 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">
            📢 Promo Kit
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Copy and paste this ready-made caption for your posts:
          </p>
          <div className="bg-secondary/20 p-4 rounded-lg">
            <p className="text-sm mb-3">
              ✨ Transform your habits into an epic journey with Cosmiq! Use my code{" "}
              <strong>{creator.code}</strong> or click:{" "}
              {window.location.origin}/?ref={creator.code}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const text = `✨ Transform your habits into an epic journey with Cosmiq! Use my code ${creator.code} or click: ${window.location.origin}/?ref=${creator.code}`;
                navigator.clipboard.writeText(text);
                toast.success("Promo caption copied!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Caption
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InfluencerDashboard;
