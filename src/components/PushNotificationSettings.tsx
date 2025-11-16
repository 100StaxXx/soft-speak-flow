import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const timeOptions = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
  { value: "20:00", label: "8:00 PM" },
];

export const PushNotificationSettings = () => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleTogglePepTalk = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_push_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Daily pep talks enabled" : "Daily pep talks disabled" });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleQuote = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_quote_push_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Daily quotes enabled" : "Daily quotes disabled" });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateTime = async (field: string, value: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: "Time updated" });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 bg-card border-border shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-accent/20 p-2 rounded-xl">
          <Bell className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="font-display text-2xl text-foreground">Daily Notifications</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Get personalized pep talks and quotes delivered daily.
      </p>

      <div className="space-y-6">
        {/* Daily Pep Talk */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Daily Pep Talk</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Personalized motivation from your mentor
              </p>
            </div>
            <Switch
              checked={profile?.daily_push_enabled ?? false}
              onCheckedChange={handleTogglePepTalk}
            />
          </div>
          
          {profile?.daily_push_enabled && (
            <div className="ml-0 space-y-2">
              <Label className="text-sm text-muted-foreground">Delivery Time</Label>
              <Select
                value={profile.daily_push_time || "08:00"}
                onValueChange={(value) => handleUpdateTime("daily_push_time", value)}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Daily Quote */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Daily Quote</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Inspiring quotes to start your day
              </p>
            </div>
            <Switch
              checked={profile?.daily_quote_push_enabled ?? false}
              onCheckedChange={handleToggleQuote}
            />
          </div>
          
          {profile?.daily_quote_push_enabled && (
            <div className="ml-0 space-y-2">
              <Label className="text-sm text-muted-foreground">Delivery Time</Label>
              <Select
                value={profile.daily_quote_push_time || "07:00"}
                onValueChange={(value) => handleUpdateTime("daily_quote_push_time", value)}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
