import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  Loader2,
  Save,
  Plus,
  Trash2,
  DollarSign,
  Percent,
  Shield,
} from "lucide-react";

interface CommissionTier {
  min_conversions: number;
  monthly_percent: number;
  yearly_percent: number;
}

interface CommissionRates {
  default: {
    monthly_percent: number;
    yearly_percent: number;
  };
  tiers: Record<string, CommissionTier>;
}

interface PayoutSettings {
  minimum_threshold: number;
  auto_approve_threshold: number;
  max_retry_attempts: number;
  retry_delay_hours: number;
}

interface TrustedInfluencers {
  codes: string[];
  auto_approve_after_payouts: number;
}

interface ReferralConfig {
  id: string;
  config_key: string;
  config_value: CommissionRates | PayoutSettings | TrustedInfluencers;
  description: string;
  created_at: string;
  updated_at: string;
}

export const AdminReferralConfig = () => {
  const queryClient = useQueryClient();
  const [newTierName, setNewTierName] = useState("");

  // Fetch all configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin-referral-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_config")
        .select("*")
        .order("config_key");

      if (error) throw error;
      return data as unknown as ReferralConfig[];
    },
  });

  // Get specific configs with type safety
  const commissionConfig = configs?.find((c) => c.config_key === "commission_rates");
  const payoutConfig = configs?.find((c) => c.config_key === "payout_settings");
  const trustedConfig = configs?.find((c) => c.config_key === "trusted_influencers");

  const commissionRates = commissionConfig?.config_value as CommissionRates | undefined;
  const payoutSettings = payoutConfig?.config_value as PayoutSettings | undefined;
  const trustedInfluencers = trustedConfig?.config_value as TrustedInfluencers | undefined;

  // Local state for editing
  const [localCommission, setLocalCommission] = useState<CommissionRates | null>(null);
  const [localPayout, setLocalPayout] = useState<PayoutSettings | null>(null);
  const [localTrusted, setLocalTrusted] = useState<TrustedInfluencers | null>(null);

  // Initialize local state when data loads
  if (commissionRates && !localCommission) {
    setLocalCommission(commissionRates);
  }
  if (payoutSettings && !localPayout) {
    setLocalPayout(payoutSettings);
  }
  if (trustedInfluencers && !localTrusted) {
    setLocalTrusted(trustedInfluencers);
  }

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({
      configKey,
      configValue,
    }: {
      configKey: string;
      configValue: unknown;
    }) => {
      const { error } = await supabase
        .from("referral_config")
        .update({ config_value: configValue as unknown as Record<string, never> })
        .eq("config_key", configKey);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referral-config"] });
      toast.success("Configuration saved");
    },
    onError: (error) => {
      console.error("Failed to update config:", error);
      toast.error("Failed to save configuration");
    },
  });

  const handleSaveCommission = () => {
    if (localCommission) {
      updateConfigMutation.mutate({
        configKey: "commission_rates",
        configValue: localCommission,
      });
    }
  };

  const handleSavePayout = () => {
    if (localPayout) {
      updateConfigMutation.mutate({
        configKey: "payout_settings",
        configValue: localPayout,
      });
    }
  };

  const handleSaveTrusted = () => {
    if (localTrusted) {
      updateConfigMutation.mutate({
        configKey: "trusted_influencers",
        configValue: localTrusted,
      });
    }
  };

  const handleAddTier = () => {
    if (!newTierName.trim() || !localCommission) return;
    const tierKey = newTierName.toLowerCase().replace(/\s+/g, "_");
    if (localCommission.tiers[tierKey]) {
      toast.error("Tier already exists");
      return;
    }
    setLocalCommission({
      ...localCommission,
      tiers: {
        ...localCommission.tiers,
        [tierKey]: {
          min_conversions: 0,
          monthly_percent: 50,
          yearly_percent: 20,
        },
      },
    });
    setNewTierName("");
  };

  const handleRemoveTier = (tierKey: string) => {
    if (!localCommission) return;
    const { [tierKey]: _, ...remainingTiers } = localCommission.tiers;
    setLocalCommission({
      ...localCommission,
      tiers: remainingTiers,
    });
  };

  const handleUpdateTier = (
    tierKey: string,
    field: keyof CommissionTier,
    value: number
  ) => {
    if (!localCommission) return;
    setLocalCommission({
      ...localCommission,
      tiers: {
        ...localCommission.tiers,
        [tierKey]: {
          ...localCommission.tiers[tierKey],
          [field]: value,
        },
      },
    });
  };

  const handleAddTrustedCode = (code: string) => {
    if (!localTrusted || !code.trim()) return;
    if (localTrusted.codes.includes(code.toUpperCase())) {
      toast.error("Code already in trusted list");
      return;
    }
    setLocalTrusted({
      ...localTrusted,
      codes: [...localTrusted.codes, code.toUpperCase()],
    });
  };

  const handleRemoveTrustedCode = (code: string) => {
    if (!localTrusted) return;
    setLocalTrusted({
      ...localTrusted,
      codes: localTrusted.codes.filter((c) => c !== code),
    });
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
        <Settings className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl font-semibold">
          Referral Configuration
        </h2>
      </div>

      <div className="space-y-8">
        {/* Commission Rates Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Commission Rates</h3>
            </div>
            <Button
              size="sm"
              onClick={handleSaveCommission}
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>

          {/* Default Rates */}
          <div className="bg-secondary/20 rounded-lg p-4">
            <p className="text-sm font-medium mb-3">Default Rates</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Monthly %</Label>
                <Input
                  type="number"
                  value={localCommission?.default.monthly_percent || 0}
                  onChange={(e) =>
                    localCommission &&
                    setLocalCommission({
                      ...localCommission,
                      default: {
                        ...localCommission.default,
                        monthly_percent: Number(e.target.value),
                      },
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Yearly %</Label>
                <Input
                  type="number"
                  value={localCommission?.default.yearly_percent || 0}
                  onChange={(e) =>
                    localCommission &&
                    setLocalCommission({
                      ...localCommission,
                      default: {
                        ...localCommission.default,
                        yearly_percent: Number(e.target.value),
                      },
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Tiers */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Commission Tiers</p>
            {localCommission &&
              Object.entries(localCommission.tiers)
                .sort(([, a], [, b]) => a.min_conversions - b.min_conversions)
                .map(([tierKey, tier]) => (
                  <div
                    key={tierKey}
                    className="bg-secondary/10 border border-border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="capitalize">
                        {tierKey}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTier(tierKey)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Min Conversions</Label>
                        <Input
                          type="number"
                          value={tier.min_conversions}
                          onChange={(e) =>
                            handleUpdateTier(
                              tierKey,
                              "min_conversions",
                              Number(e.target.value)
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Monthly %</Label>
                        <Input
                          type="number"
                          value={tier.monthly_percent}
                          onChange={(e) =>
                            handleUpdateTier(
                              tierKey,
                              "monthly_percent",
                              Number(e.target.value)
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Yearly %</Label>
                        <Input
                          type="number"
                          value={tier.yearly_percent}
                          onChange={(e) =>
                            handleUpdateTier(
                              tierKey,
                              "yearly_percent",
                              Number(e.target.value)
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}

            {/* Add Tier */}
            <div className="flex gap-2">
              <Input
                placeholder="New tier name (e.g., diamond)"
                value={newTierName}
                onChange={(e) => setNewTierName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTier()}
              />
              <Button variant="outline" onClick={handleAddTier}>
                <Plus className="h-4 w-4 mr-1" />
                Add Tier
              </Button>
            </div>
          </div>
        </div>

        {/* Payout Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Payout Settings</h3>
            </div>
            <Button
              size="sm"
              onClick={handleSavePayout}
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>

          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Minimum Payout Threshold ($)</Label>
                <Input
                  type="number"
                  value={localPayout?.minimum_threshold || 0}
                  onChange={(e) =>
                    localPayout &&
                    setLocalPayout({
                      ...localPayout,
                      minimum_threshold: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Auto-Approve Threshold ($)</Label>
                <Input
                  type="number"
                  value={localPayout?.auto_approve_threshold || 0}
                  onChange={(e) =>
                    localPayout &&
                    setLocalPayout({
                      ...localPayout,
                      auto_approve_threshold: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Payouts under this amount are auto-approved
                </p>
              </div>
              <div>
                <Label className="text-xs">Max Retry Attempts</Label>
                <Input
                  type="number"
                  value={localPayout?.max_retry_attempts || 0}
                  onChange={(e) =>
                    localPayout &&
                    setLocalPayout({
                      ...localPayout,
                      max_retry_attempts: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Retry Delay (hours)</Label>
                <Input
                  type="number"
                  value={localPayout?.retry_delay_hours || 0}
                  onChange={(e) =>
                    localPayout &&
                    setLocalPayout({
                      ...localPayout,
                      retry_delay_hours: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trusted Influencers Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Trusted Influencers</h3>
            </div>
            <Button
              size="sm"
              onClick={handleSaveTrusted}
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>

          <div className="bg-secondary/20 rounded-lg p-4 space-y-4">
            <div>
              <Label className="text-xs">Auto-approve after X successful payouts</Label>
              <Input
                type="number"
                value={localTrusted?.auto_approve_after_payouts || 0}
                onChange={(e) =>
                  localTrusted &&
                  setLocalTrusted({
                    ...localTrusted,
                    auto_approve_after_payouts: Number(e.target.value),
                  })
                }
                className="mt-1 max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Influencers become trusted after this many successful payouts
              </p>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Trusted Referral Codes</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {localTrusted?.codes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {code}
                    <button
                      onClick={() => handleRemoveTrustedCode(code)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {(!localTrusted?.codes || localTrusted.codes.length === 0) && (
                  <span className="text-sm text-muted-foreground">
                    No trusted codes yet
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add referral code"
                  className="max-w-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTrustedCode((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
