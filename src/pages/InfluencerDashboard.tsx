import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { safeLocalStorage } from "@/utils/storage";

interface ReferralCode {
  id: string;
  code: string;
  influencer_name: string;
  influencer_email: string;
  influencer_handle: string | null;
  payout_identifier: string;
  created_at: string;
}

interface Conversion {
  id: string;
  email: string;
  created_at: string;
  subscription_status: string | null;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  payout_type: string;
  created_at: string;
  paid_at: string | null;
}

const InfluencerDashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState("");
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);

  // Check for code in URL params or localStorage
  useEffect(() => {
    const urlCode = searchParams.get("code");
    const storedCode = safeLocalStorage.getItem("influencer_code");
    
    if (urlCode) {
      setVerifiedCode(urlCode);
      safeLocalStorage.setItem("influencer_code", urlCode);
    } else if (storedCode) {
      setVerifiedCode(storedCode);
    }
  }, [searchParams]);

  // Fetch referral code details
  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ["influencer-code", verifiedCode],
    queryFn: async () => {
      if (!verifiedCode) return null;

      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("code", verifiedCode)
        .eq("owner_type", "influencer")
        .maybeSingle();

      if (error) {
        console.error("Error fetching influencer code:", error);
        throw error;
      }
      
      if (!data) {
        throw new Error("Invalid or expired influencer code");
      }
      
      return data as ReferralCode;
    },
    enabled: !!verifiedCode,
  });

  // Fetch conversions (users who used this code)
  const { data: conversions } = useQuery({
    queryKey: ["influencer-conversions", verifiedCode],
    queryFn: async () => {
      if (!verifiedCode) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, created_at, subscription_status")
        .eq("referred_by_code", verifiedCode)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Conversion[];
    },
    enabled: !!verifiedCode,
  });

  // Fetch payouts
  const { data: payouts } = useQuery({
    queryKey: ["influencer-payouts", referralCode?.id],
    queryFn: async () => {
      if (!referralCode?.id) return [];

      const { data, error } = await supabase
        .from("referral_payouts")
        .select("*")
        .eq("referral_code_id", referralCode.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payout[];
    },
    enabled: !!referralCode?.id,
  });

  // Calculate stats
  const stats = {
    totalSignups: conversions?.length || 0,
    activeSubscribers: conversions?.filter(c => c.subscription_status === "active").length || 0,
    totalEarnings: payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    pendingEarnings: payouts?.filter(p => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    requestedEarnings: payouts?.filter(p => p.status === "requested").reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    paidEarnings: payouts?.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  const queryClient = useQueryClient();

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("request-referral-payout", {
        body: { referral_code: verifiedCode },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Payout request submitted!");
      queryClient.invalidateQueries({ queryKey: ["influencer-payouts"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to request payout");
    },
  });

  const handleVerifyCode = () => {
    if (!codeInput.trim()) {
      toast.error("Please enter your referral code");
      return;
    }
    setVerifiedCode(codeInput.trim().toUpperCase());
    safeLocalStorage.setItem("influencer_code", codeInput.trim().toUpperCase());
  };

  const copyCode = () => {
    if (verifiedCode) {
      navigator.clipboard.writeText(verifiedCode);
      toast.success("Code copied to clipboard!");
    }
  };

  const copyLink = () => {
    if (verifiedCode) {
      const link = `${window.location.origin}/?ref=${verifiedCode}`;
      navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard!");
    }
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
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Promo text copied to clipboard!");
    }
  };

  const logout = () => {
    safeLocalStorage.removeItem("influencer_code");
    setVerifiedCode(null);
    navigate("/creator");
  };

  // Code verification screen
  if (!verifiedCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-primary/5 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 rounded-3xl shadow-soft">
            <div className="text-center mb-6">
              <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
              <h1 className="font-heading text-3xl font-bold mb-2">
                Influencer Dashboard
              </h1>
              <p className="text-muted-foreground">
                Enter your referral code to view your performance
              </p>
            </div>

            <div className="space-y-4">
              <Input
                placeholder="Enter your code (e.g., COSMIQ-DARRYL)"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleVerifyCode()}
                className="text-center text-lg font-mono"
              />
              <Button
                onClick={handleVerifyCode}
                className="w-full"
                size="lg"
              >
                View Dashboard
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have a code yet?
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/creator")}
              >
                Create Referral Code
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Loading state
  if (codeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Invalid code
  if (!referralCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-primary/5 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-8 rounded-3xl shadow-soft text-center">
            <h1 className="font-heading text-2xl font-bold mb-4 text-destructive">
              Invalid Code
            </h1>
            <p className="text-muted-foreground mb-6">
              The code "{verifiedCode}" was not found or is not an influencer code.
            </p>
            <Button onClick={logout}>
              Try Different Code
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-primary/5 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold mb-2">
              Welcome back, {referralCode.influencer_name}! 👋
            </h1>
            <p className="text-muted-foreground">
              Track your referrals and earnings
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Switch Code
          </Button>
        </div>

        {/* Referral Code Card */}
        <Card className="p-6 mb-6 rounded-3xl shadow-soft">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
              <code className="text-3xl font-bold font-mono text-primary">
                {referralCode.code}
              </code>
              <p className="text-sm text-muted-foreground mt-2">
                {referralCode.influencer_handle && `${referralCode.influencer_handle} • `}
                {referralCode.influencer_email}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary">{stats.totalSignups}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.totalSignups}</p>
            <p className="text-sm text-muted-foreground">Total Sign-Ups</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <Badge variant="secondary">{stats.activeSubscribers}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.activeSubscribers}</p>
            <p className="text-sm text-muted-foreground">Active Subscribers</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8 text-green-600" />
              <Badge className="bg-green-500">${stats.totalEarnings.toFixed(2)}</Badge>
            </div>
            <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <Badge variant="outline">${stats.pendingEarnings.toFixed(2)}</Badge>
            </div>
            <p className="text-2xl font-bold">${stats.pendingEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Pending Payout</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Conversions */}
          <Card className="p-6 rounded-3xl shadow-soft">
            <h2 className="font-heading text-2xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Recent Sign-Ups
            </h2>
            {conversions && conversions.length > 0 ? (
              <div className="space-y-3">
                {conversions.slice(0, 10).map((conversion) => (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{conversion.email}</p>
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

          {/* Payout History */}
          <Card className="p-6 rounded-3xl shadow-soft">
            <h2 className="font-heading text-2xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Payout History
            </h2>
            {payouts && payouts.length > 0 ? (
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
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

            {stats.pendingEarnings >= 50 && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      🎉 You've reached the $50 payout threshold!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Request your payout to be sent to {referralCode.payout_identifier}
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

            {stats.requestedEarnings > 0 && (
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm font-medium text-blue-600">
                  ⏳ Payout of ${stats.requestedEarnings.toFixed(2)} is pending review
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Our team will process your payout request shortly.
                </p>
              </div>
            )}

            {stats.pendingEarnings < 50 && stats.pendingEarnings > 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm font-medium">
                  ${(50 - stats.pendingEarnings).toFixed(2)} away from $50 minimum payout
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Promo Kit */}
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
              <strong>{referralCode.code}</strong> or click:{" "}
              {window.location.origin}/?ref={referralCode.code}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const text = `✨ Transform your habits into an epic journey with Cosmiq! Use my code ${referralCode.code} or click: ${window.location.origin}/?ref=${referralCode.code}`;
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
