import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface AnalyticsData {
  totalSignups: number;
  totalConversions: number;
  conversionRate: number;
  totalPaid: number;
  totalPending: number;
  totalRequested: number;
  totalApproved: number;
  avgPayoutAmount: number;
  topReferrers: {
    code: string;
    name: string;
    conversions: number;
    earnings: number;
  }[];
  monthlyStats: {
    month: string;
    signups: number;
    conversions: number;
    earnings: number;
  }[];
}

export const AdminReferralAnalytics = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-referral-analytics"],
    queryFn: async (): Promise<AnalyticsData> => {
      // Get all referral codes
      const { data: codes } = await supabase
        .from("referral_codes")
        .select("*");

      // Get all payouts
      const { data: payouts } = await supabase
        .from("referral_payouts")
        .select("*");

      // Get signups by referral code
      const { data: referredProfiles } = await supabase
        .from("profiles")
        .select("referred_by_code, created_at")
        .not("referred_by_code", "is", null);

      const totalSignups = referredProfiles?.length || 0;

      // Count conversions (profiles with subscriptions via referral)
      const { count: totalConversions } = await supabase
        .from("referral_payouts")
        .select("*", { count: "exact", head: true });

      const conversionRate =
        totalSignups > 0
          ? ((totalConversions || 0) / totalSignups) * 100
          : 0;

      // Calculate payout totals by status
      const totalPaid =
        payouts
          ?.filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalPending =
        payouts
          ?.filter((p) => p.status === "pending")
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalRequested =
        payouts
          ?.filter((p) => p.status === "requested")
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalApproved =
        payouts
          ?.filter((p) => p.status === "approved")
          .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalPayoutsAmount =
        payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const avgPayoutAmount =
        payouts && payouts.length > 0
          ? totalPayoutsAmount / payouts.length
          : 0;

      // Calculate top referrers
      const referrerStats = new Map<
        string,
        { code: string; name: string; conversions: number; earnings: number }
      >();

      codes?.forEach((code) => {
        const codePayouts = payouts?.filter(
          (p) => p.referral_code_id === code.id
        );
        const earnings =
          codePayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const conversions = codePayouts?.length || 0;

        referrerStats.set(code.id, {
          code: code.code,
          name: code.influencer_name || code.owner_user_id?.substring(0, 8) || "Unknown",
          conversions,
          earnings,
        });
      });

      const topReferrers = Array.from(referrerStats.values())
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 5);

      // Calculate monthly stats (last 6 months)
      const now = new Date();
      const monthlyStats: AnalyticsData["monthlyStats"] = [];

      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthStr = monthDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });

        const monthSignups =
          referredProfiles?.filter((p) => {
            const created = new Date(p.created_at);
            return created >= monthDate && created <= monthEnd;
          }).length || 0;

        const monthPayouts = payouts?.filter((p) => {
          const created = new Date(p.created_at);
          return created >= monthDate && created <= monthEnd;
        });

        const monthConversions = monthPayouts?.length || 0;
        const monthEarnings =
          monthPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        monthlyStats.push({
          month: monthStr,
          signups: monthSignups,
          conversions: monthConversions,
          earnings: monthEarnings,
        });
      }

      return {
        totalSignups,
        totalConversions: totalConversions || 0,
        conversionRate,
        totalPaid,
        totalPending,
        totalRequested,
        totalApproved,
        avgPayoutAmount,
        topReferrers,
        monthlyStats,
      };
    },
  });

  if (isLoading) {
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
        <BarChart3 className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl font-semibold">
          Referral Analytics
        </h2>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Total Signups</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">
            {analytics?.totalSignups || 0}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Conversions</span>
          </div>
          <p className="text-2xl font-bold text-green-500">
            {analytics?.totalConversions || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {analytics?.conversionRate.toFixed(1)}% rate
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Total Paid Out</span>
          </div>
          <p className="text-2xl font-bold text-purple-500">
            ${analytics?.totalPaid.toFixed(2) || "0.00"}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Avg Payout</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">
            ${analytics?.avgPayoutAmount.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      {/* Pipeline */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg mb-4">Payout Pipeline</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-lg font-bold text-yellow-600">
              ${analytics?.totalPending.toFixed(2) || "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-lg font-bold text-orange-600">
              ${analytics?.totalRequested.toFixed(2) || "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">Requested</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-lg font-bold text-blue-600">
              ${analytics?.totalApproved.toFixed(2) || "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-lg font-bold text-green-600">
              ${analytics?.totalPaid.toFixed(2) || "0.00"}
            </p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg mb-4">Monthly Trend</h3>
        <div className="grid grid-cols-6 gap-2">
          {analytics?.monthlyStats.map((month, idx) => {
            const prevMonth = analytics.monthlyStats[idx - 1];
            const earningsChange = prevMonth
              ? month.earnings - prevMonth.earnings
              : 0;
            const isPositive = earningsChange >= 0;

            return (
              <div
                key={month.month}
                className="text-center p-3 bg-secondary/20 rounded-lg"
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {month.month}
                </p>
                <p className="text-sm font-semibold">{month.signups} signups</p>
                <p className="text-xs text-green-500">
                  {month.conversions} converts
                </p>
                <p className="text-sm font-bold text-primary mt-1">
                  ${month.earnings.toFixed(0)}
                </p>
                {idx > 0 && (
                  <div
                    className={`flex items-center justify-center text-xs mt-1 ${
                      isPositive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    ${Math.abs(earningsChange).toFixed(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Referrers */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Top Referrers</h3>
        {analytics?.topReferrers && analytics.topReferrers.length > 0 ? (
          <div className="space-y-2">
            {analytics.topReferrers.map((referrer, idx) => (
              <div
                key={referrer.code}
                className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0
                        ? "bg-yellow-500/20 text-yellow-500"
                        : idx === 1
                        ? "bg-gray-400/20 text-gray-400"
                        : idx === 2
                        ? "bg-amber-700/20 text-amber-700"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">{referrer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {referrer.code}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">
                    ${referrer.earnings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {referrer.conversions} conversions
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            No referrer data yet
          </p>
        )}
      </div>
    </Card>
  );
};
