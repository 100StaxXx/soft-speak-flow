import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Code2,
  Users,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ExternalLink,
  Copy,
} from "lucide-react";

interface ReferralCode {
  id: string;
  code: string;
  owner_type: "user" | "influencer";
  owner_user_id: string | null;
  influencer_name: string | null;
  influencer_email: string | null;
  influencer_handle: string | null;
  payout_method: string | null;
  payout_identifier: string | null;
  is_active: boolean;
  created_at: string;
  conversion_count?: number;
  total_earnings?: number;
}

type OwnerTypeFilter = "all" | "user" | "influencer";

export const AdminReferralCodes = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<OwnerTypeFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch all referral codes with conversion stats
  const { data: codes, isLoading } = useQuery({
    queryKey: ["admin-referral-codes"],
    queryFn: async () => {
      const { data: codesData, error: codesError } = await supabase
        .from("referral_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (codesError) throw codesError;

      // Fetch conversion counts and earnings for each code
      const codesWithStats = await Promise.all(
        codesData.map(async (code) => {
          // Count conversions (profiles that used this code)
          const { count: conversionCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("referred_by_code", code.code);

          // Sum earnings from payouts
          const { data: payouts } = await supabase
            .from("referral_payouts")
            .select("amount")
            .eq("referral_code_id", code.id);

          const totalEarnings = payouts?.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          ) || 0;

          return {
            ...code,
            conversion_count: conversionCount || 0,
            total_earnings: totalEarnings,
          };
        })
      );

      return codesWithStats as ReferralCode[];
    },
  });

  // Toggle is_active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ codeId, isActive }: { codeId: string; isActive: boolean }) => {
      setTogglingId(codeId);
      const { error } = await supabase
        .from("referral_codes")
        .update({ is_active: !isActive })
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] });
      toast.success("Code status updated");
      setTogglingId(null);
    },
    onError: (error) => {
      console.error("Failed to toggle code status:", error);
      toast.error("Failed to update code status");
      setTogglingId(null);
    },
  });

  // Filter codes based on search and owner type
  const filteredCodes = codes?.filter((code) => {
    const matchesSearch =
      code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.influencer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.influencer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.influencer_handle?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      ownerTypeFilter === "all" || code.owner_type === ownerTypeFilter;

    return matchesSearch && matchesType;
  });

  // Calculate summary stats
  const stats = {
    totalCodes: codes?.length || 0,
    activeCodes: codes?.filter((c) => c.is_active).length || 0,
    userCodes: codes?.filter((c) => c.owner_type === "user").length || 0,
    influencerCodes: codes?.filter((c) => c.owner_type === "influencer").length || 0,
    totalConversions: codes?.reduce((sum, c) => sum + (c.conversion_count || 0), 0) || 0,
    totalEarnings: codes?.reduce((sum, c) => sum + (c.total_earnings || 0), 0) || 0,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

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
        <Code2 className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl font-semibold">
          Referral Codes Management
        </h2>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Codes</p>
          <p className="text-2xl font-bold text-primary">{stats.totalCodes}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-green-500">{stats.activeCodes}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">User Codes</p>
          <p className="text-2xl font-bold text-blue-500">{stats.userCodes}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Influencer Codes</p>
          <p className="text-2xl font-bold text-purple-500">{stats.influencerCodes}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Conversions</p>
          <p className="text-2xl font-bold text-orange-500">{stats.totalConversions}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Earnings</p>
          <p className="text-2xl font-bold text-green-600">${stats.totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, name, email, handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={ownerTypeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setOwnerTypeFilter("all")}
          >
            <Filter className="h-4 w-4 mr-1" />
            All
          </Button>
          <Button
            variant={ownerTypeFilter === "user" ? "default" : "outline"}
            size="sm"
            onClick={() => setOwnerTypeFilter("user")}
          >
            <Users className="h-4 w-4 mr-1" />
            Users
          </Button>
          <Button
            variant={ownerTypeFilter === "influencer" ? "default" : "outline"}
            size="sm"
            onClick={() => setOwnerTypeFilter("influencer")}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Influencers
          </Button>
        </div>
      </div>

      {/* Codes List */}
      <div className="space-y-3">
        {filteredCodes && filteredCodes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No referral codes found
          </p>
        ) : (
          filteredCodes?.map((code) => (
            <div
              key={code.id}
              className="p-4 rounded-lg border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="font-mono text-lg font-bold text-primary">
                      {code.code}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Badge variant={code.owner_type === "influencer" ? "default" : "secondary"}>
                      {code.owner_type}
                    </Badge>
                    <Badge variant={code.is_active ? "default" : "outline"}>
                      {code.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {code.owner_type === "influencer" ? (
                    <div className="space-y-1">
                      <p className="font-medium">{code.influencer_name}</p>
                      <p className="text-sm text-muted-foreground">{code.influencer_email}</p>
                      {code.influencer_handle && (
                        <p className="text-sm text-primary">{code.influencer_handle}</p>
                      )}
                      {code.payout_identifier && (
                        <p className="text-xs text-green-600">
                          PayPal: {code.payout_identifier}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      User ID: {code.owner_user_id?.substring(0, 8)}...
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{code.conversion_count} conversions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>${code.total_earnings?.toFixed(2) || "0.00"} earned</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(code.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleActiveMutation.mutate({
                        codeId: code.id,
                        isActive: code.is_active,
                      })
                    }
                    disabled={togglingId === code.id}
                  >
                    {togglingId === code.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : code.is_active ? (
                      <>
                        <ToggleRight className="h-4 w-4 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  {code.owner_type === "influencer" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${window.location.origin}/?ref=${code.code}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creator Portal Link */}
      <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium mb-2">Influencer Sign-Up Portal</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-background/50 px-3 py-2 rounded">
            {window.location.origin}/creator
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(`${window.location.origin}/creator`)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share this link with influencers to generate their referral codes
        </p>
      </div>
    </Card>
  );
};
