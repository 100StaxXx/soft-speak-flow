import { useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const DailyQuoteSettings = memo(() => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleQuotePush = async (enabled: boolean) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_quote_push_enabled: enabled })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success(enabled ? "Daily quotes enabled" : "Daily quotes disabled");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateWindow = async (window: string) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_quote_push_window: window })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success("Delivery time updated");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateTime = async (time: string) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_quote_push_time: time })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success("Delivery time updated");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Daily Quote Notifications</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="quote-push-toggle" className="text-base">
                Enable Daily Quotes
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive an inspiring quote from your mentor each day
              </p>
            </div>
            <Switch
              id="quote-push-toggle"
              checked={profile?.daily_quote_push_enabled ?? true}
              onCheckedChange={handleToggleQuotePush}
              disabled={isUpdating}
            />
          </div>

          {profile?.daily_quote_push_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quote-window">Delivery Window</Label>
                <Select
                  value={profile?.daily_quote_push_window || "afternoon"}
                  onValueChange={handleUpdateWindow}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="quote-window">
                    <SelectValue placeholder="Select time of day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (6 AM - 12 PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12 PM - 6 PM)</SelectItem>
                    <SelectItem value="evening">Evening (6 PM - 10 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-time">Preferred Time</Label>
                <Select
                  value={profile?.daily_quote_push_time || "14:00:00"}
                  onValueChange={handleUpdateTime}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="quote-time">
                    <SelectValue placeholder="Select specific time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00:00">8:00 AM</SelectItem>
                    <SelectItem value="09:00:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00:00">10:00 AM</SelectItem>
                    <SelectItem value="12:00:00">12:00 PM</SelectItem>
                    <SelectItem value="14:00:00">2:00 PM</SelectItem>
                    <SelectItem value="16:00:00">4:00 PM</SelectItem>
                    <SelectItem value="18:00:00">6:00 PM</SelectItem>
                    <SelectItem value="20:00:00">8:00 PM</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quotes will be delivered around this time each day
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
});
DailyQuoteSettings.displayName = 'DailyQuoteSettings';
