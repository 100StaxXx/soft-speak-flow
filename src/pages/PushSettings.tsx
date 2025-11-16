import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bell, Clock, MapPin } from "lucide-react";

export default function PushSettings() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [enabled, setEnabled] = useState(false);
  const [window, setWindow] = useState("morning");
  const [customTime, setCustomTime] = useState("08:00");
  const [timezone, setTimezone] = useState("America/New_York");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setEnabled(profile.daily_push_enabled || false);
      setWindow(profile.daily_push_window || "morning");
      setCustomTime(profile.daily_push_time || "08:00");
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
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
          daily_push_time: customTime,
          timezone: timezone,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Push settings saved successfully");
    } catch (error: any) {
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
      case "afternoon": return "12:00 PM";
      case "evening": return "6:00 PM";
      case "custom": return customTime;
      default: return "8:00 AM";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Daily Push Settings</h1>
          <p className="text-muted-foreground">
            Configure when and how you receive your daily mentor pep talks
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Enable Daily Pushes
              </CardTitle>
              <CardDescription>
                Receive a personalized pep talk from your mentor every day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="text-base">
                  Daily pushes {enabled ? "enabled" : "disabled"}
                </Label>
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {enabled && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Delivery Time
                  </CardTitle>
                  <CardDescription>
                    Choose when you want to receive your daily push
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="window">Time Window</Label>
                    <Select value={window} onValueChange={setWindow}>
                      <SelectTrigger id="window">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (8:00 AM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12:00 PM)</SelectItem>
                        <SelectItem value="evening">Evening (6:00 PM)</SelectItem>
                        <SelectItem value="custom">Custom Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {window === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="customTime">Custom Time</Label>
                      <Input
                        id="customTime"
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      You'll receive your daily push at <span className="font-semibold text-foreground">{getTimeForWindow(window)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Timezone
                  </CardTitle>
                  <CardDescription>
                    Your current timezone for accurate delivery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="w-full"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
