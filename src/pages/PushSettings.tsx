import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bell, Quote } from "lucide-react";

export default function PushSettings() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [enabled, setEnabled] = useState(false);
  const [window, setWindow] = useState("morning");
  const [customTime, setCustomTime] = useState("08:00");
  const [quoteEnabled, setQuoteEnabled] = useState(false);
  const [quoteWindow, setQuoteWindow] = useState("afternoon");
  const [quoteCustomTime, setQuoteCustomTime] = useState("14:00");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setEnabled(profile.daily_push_enabled ?? false);
      setWindow(profile.daily_push_window ?? "morning");
      setCustomTime(profile.daily_push_time ?? "08:00");
      setQuoteEnabled(profile.daily_quote_push_enabled ?? false);
      setQuoteWindow(profile.daily_quote_push_window ?? "afternoon");
      setQuoteCustomTime(profile.daily_quote_push_time ?? "14:00");
      setTimezone(profile.timezone ?? "UTC");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          daily_push_enabled: enabled,
          daily_push_window: window,
          daily_push_time: window === "custom" ? customTime : null,
          daily_quote_push_enabled: quoteEnabled,
          daily_quote_push_window: quoteWindow,
          daily_quote_push_time: quoteWindow === "custom" ? quoteCustomTime : null,
          timezone,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  const getTimeForWindow = (selectedWindow: string) => {
    switch (selectedWindow) {
      case "morning": return "8:00 AM";
      case "afternoon": return "2:00 PM";
      case "evening": return "7:00 PM";
      case "custom": return customTime;
      default: return "8:00 AM";
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Daily Push Settings</h1>
          <p className="text-muted-foreground">
            Configure when you'd like to receive your daily content
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Daily Pep Talk Notifications
            </CardTitle>
            <CardDescription>
              Receive a personalized pep talk from your mentor every day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Daily Pep Talks</label>
                <p className="text-sm text-muted-foreground">
                  Get motivational content delivered daily
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardContent>
        </Card>

        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle>Pep Talk Delivery Time</CardTitle>
              <CardDescription>
                Choose when you'd like to receive your daily pep talk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Window</label>
                <Select value={window} onValueChange={setWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning ({getTimeForWindow("morning")})</SelectItem>
                    <SelectItem value="afternoon">Afternoon ({getTimeForWindow("afternoon")})</SelectItem>
                    <SelectItem value="evening">Evening ({getTimeForWindow("evening")})</SelectItem>
                    <SelectItem value="custom">Custom Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {window === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Time</label>
                  <Input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5" />
              Daily Quote Notifications
            </CardTitle>
            <CardDescription>
              Receive an inspiring quote each day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Daily Quotes</label>
                <p className="text-sm text-muted-foreground">
                  Get a motivational quote delivered daily
                </p>
              </div>
              <Switch checked={quoteEnabled} onCheckedChange={setQuoteEnabled} />
            </div>
          </CardContent>
        </Card>

        {quoteEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Quote Delivery Time</CardTitle>
              <CardDescription>
                Choose when you'd like to receive your daily quote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Window</label>
                <Select value={quoteWindow} onValueChange={setQuoteWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8:00 AM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (2:00 PM)</SelectItem>
                    <SelectItem value="evening">Evening (7:00 PM)</SelectItem>
                    <SelectItem value="custom">Custom Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quoteWindow === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Time</label>
                  <Input
                    type="time"
                    value={quoteCustomTime}
                    onChange={(e) => setQuoteCustomTime(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timezone</CardTitle>
            <CardDescription>
              Set your timezone for accurate delivery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
