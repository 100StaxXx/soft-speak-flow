import { useState, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, AlertCircle, MapPin, Bug, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NotificationPreview } from "@/components/NotificationPreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  isNativePushSupported, 
  initializeNativePush, 
  unregisterNativePush,
  hasActiveNativePushSubscription,
  debugTestRegistration
} from "@/utils/nativePushNotifications";

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

export const PushNotificationSettings = memo(() => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check platform support after mount
  useEffect(() => {
    setIsSupported(isNativePushSupported());
  }, []);

  useEffect(() => {
    if (user) {
      hasActiveNativePushSubscription(user.id).then(setPushEnabled);
    }
  }, [user]);

  const handleTogglePushPermission = async (enabled: boolean) => {
    if (!user) return;
    
    try {
      if (enabled) {
        // Subscribe to native push notifications
        await initializeNativePush(user.id);
        setPushEnabled(true);
        toast({ title: "Notifications Enabled", description: "You'll receive daily notifications" });
      } else {
        // Unsubscribe from push notifications
        await unregisterNativePush(user.id);
        setPushEnabled(false);
        toast({ title: "Notifications Disabled", description: "You won't receive push notifications" });
      }
    } catch (error) {
      console.error("Error toggling push notifications:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle notifications", variant: "destructive" });
    }
  };

  const handleTogglePepTalk = async (enabled: boolean) => {
    if (!user) return;
    
    if (enabled && !pushEnabled) {
      toast({ 
        title: "Enable push notifications first", 
        description: "Please enable browser notifications before activating daily pep talks",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_push_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Daily Push Enabled" : "Daily Push Disabled", description: "Settings updated successfully" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error toggling pep talk:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle pep talk", variant: "destructive" });
    }
  };

  const handleToggleQuote = async (enabled: boolean) => {
    if (!user) return;
    
    if (enabled && !pushEnabled) {
      toast({ 
        title: "Enable push notifications first", 
        description: "Please enable browser notifications before activating daily quotes",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_quote_push_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Quote Push Enabled" : "Quote Push Disabled", description: "Settings updated successfully" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error toggling quote push:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle quote push", variant: "destructive" });
    }
  };

  const handleToggleHabitReminders = async (enabled: boolean) => {
    if (!user) return;
    
    if (enabled && !pushEnabled) {
      toast({ 
        title: "Enable push notifications first", 
        description: "Please enable browser notifications before activating habit reminders",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ habit_reminders_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Habit Reminders Enabled" : "Habit Reminders Disabled", description: "Settings updated successfully" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error toggling habit reminders:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle habit reminders", variant: "destructive" });
    }
  };

  const handleToggleTaskReminders = async (enabled: boolean) => {
    if (!user) return;
    
    if (enabled && !pushEnabled) {
      toast({ 
        title: "Enable push notifications first", 
        description: "Please enable browser notifications before activating quest reminders",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ task_reminders_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      toast({ title: enabled ? "Quest Reminders Enabled" : "Quest Reminders Disabled", description: "Settings updated successfully" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error toggling task reminders:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle task reminders", variant: "destructive" });
    }
  };

  const handleToggleCheckInReminders = async (enabled: boolean) => {
    if (!user) return;

    if (enabled && !pushEnabled) {
      toast({
        title: "Enable push notifications first",
        description: "Please enable browser notifications before activating check-in reminders",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ checkin_reminders_enabled: enabled })
        .eq("id", user.id);

      if (error) throw error;
      toast({ title: enabled ? "Check-In Reminders Enabled" : "Check-In Reminders Disabled", description: "Settings updated successfully" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error toggling check-in reminders:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle check-in reminders", variant: "destructive" });
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
      toast({ title: "Time Updated", description: "Your push notification time has been updated" });
      // Reload to sync state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error updating time:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update time", variant: "destructive" });
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

      {!isSupported && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Push notifications are only available on iOS devices.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Browser Push Permission */}
        {isSupported && (
          <div className="space-y-3 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground font-medium">Browser Notifications</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow this app to send you notifications
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={handleTogglePushPermission}
              />
            </div>
          </div>
        )}
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
              disabled={!pushEnabled}
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

        {/* Timezone Display */}
        {profile?.timezone && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-muted-foreground text-sm">Timezone</Label>
              </div>
              <span className="text-sm text-foreground">{profile.timezone}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              All notification times are shown in your local timezone
            </p>
          </div>
        )}

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
              disabled={!pushEnabled}
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

        {/* Star Path Habit Reminders */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Star Path Habit Reminders</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Get notified when your habits are due
              </p>
            </div>
            <Switch
              checked={profile?.habit_reminders_enabled ?? true}
              onCheckedChange={handleToggleHabitReminders}
              disabled={!pushEnabled}
            />
          </div>
        </div>

        {/* Quest Reminders */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Quest Reminders</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Get notified before scheduled quests
              </p>
            </div>
            <Switch
              checked={profile?.task_reminders_enabled ?? true}
              onCheckedChange={handleToggleTaskReminders}
              disabled={!pushEnabled}
            />
          </div>
        </div>

        {/* Morning + Evening Check-In Reminders */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Check-In Reminders</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Morning and evening reminders at variable times
              </p>
            </div>
            <Switch
              checked={profile?.checkin_reminders_enabled ?? true}
              onCheckedChange={handleToggleCheckInReminders}
              disabled={!pushEnabled}
            />
          </div>
        </div>

        {/* Notification Preview */}
        {pushEnabled && (profile?.daily_push_enabled || profile?.daily_quote_push_enabled) && (
          <div className="pt-6 mt-6 border-t border-border">
            <NotificationPreview />
          </div>
        )}

        {/* Debug Panel */}
        <PushDebugPanel userId={user?.id} />
      </div>
    </Card>
  );
});
PushNotificationSettings.displayName = 'PushNotificationSettings';

// Push Debug Panel Component - memoized
const PushDebugPanel = memo(({ userId }: { userId?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    platform: string;
    isNative: boolean;
    isSupported: boolean;
    permissionStatus: string;
    hasToken: boolean;
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const loadDebugInfo = async () => {
    setIsLoading(true);
    try {
      const info = await debugTestRegistration(userId || '');
      const hasToken = userId ? await hasActiveNativePushSubscription(userId) : false;
      setDebugInfo({ ...info, hasToken });
    } catch (error) {
      console.error('Debug info error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRegistration = async () => {
    if (!userId) {
      toast({ title: "Error", description: "No user ID available", variant: "destructive" });
      return;
    }
    
    setIsRegistering(true);
    try {
      await initializeNativePush(userId);
      toast({ title: "Registration Initiated", description: "Check Xcode console for detailed logs" });
      // Reload debug info after a short delay
      setTimeout(loadDebugInfo, 2000);
    } catch (error) {
      toast({ 
        title: "Registration Failed", 
        description: error instanceof Error ? error.message : "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (isOpen && !debugInfo) {
      loadDebugInfo();
    }
  }, [isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="pt-4 border-t border-border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Debug Push Notifications</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : debugInfo ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Platform:</span>
                <span className="font-mono text-foreground">{debugInfo.platform}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.isNative ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Native:</span>
                <span className="text-foreground">{debugInfo.isNative ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.isSupported ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Supported:</span>
                <span className="text-foreground">{debugInfo.isSupported ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.permissionStatus === 'granted' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-muted-foreground">Permission:</span>
                <span className="text-foreground">{debugInfo.permissionStatus}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                {debugInfo.hasToken ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Token in DB:</span>
                <span className="text-foreground">{debugInfo.hasToken ? 'Yes' : 'No'}</span>
              </div>
            </div>
            
            {debugInfo.error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{debugInfo.error}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDebugInfo}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleTestRegistration}
                disabled={isRegistering || !debugInfo.isSupported}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Test Registration'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load debug info</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
});
PushDebugPanel.displayName = 'PushDebugPanel';
