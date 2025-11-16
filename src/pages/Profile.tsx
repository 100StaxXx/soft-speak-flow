import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crown, User, Bell, Repeat, LogOut, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: adaptivePushSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["adaptive-push-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_push_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["mentors", "active"] ,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("id, name, slug, avatar_url, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      const map = new Map<string, any>();
      for (const m of data || []) {
        const key = ((m.slug || m.name || "").trim().toLowerCase());
        if (!map.has(key)) map.set(key, m);
      }
      return Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
    },
  });

  const { data: selectedMentor } = useQuery({
    queryKey: ["selected-mentor", profile?.selected_mentor_id],
    enabled: !!profile?.selected_mentor_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("mentors").select("*").eq("id", profile!.selected_mentor_id!).single();
      if (error) throw error;
      return data;
    },
  });

  const handleToggleAdaptivePush = async () => {
    if (!user) return;
    
    try {
      const newState = !adaptivePushSettings?.enabled;
      
      if (adaptivePushSettings) {
        const { error } = await supabase
          .from("adaptive_push_settings")
          .update({ enabled: newState })
          .eq("user_id", user.id);
        if (error) throw error;
      }
      
      refetchSettings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleChangeMentor = async (mentorId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({ selected_mentor_id: mentorId }).eq("id", user.id);
      if (error) throw error;
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateAdaptivePushSettings = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("adaptive_push_settings").insert({
        user_id: user.id,
        enabled: true,
        mentor_id: profile?.selected_mentor_id,
      });
      if (error) throw error;
      toast({ title: "Adaptive Pushes enabled" });
      refetchSettings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-lg mx-auto px-4 py-8 text-center py-12">
          <h2 className="font-display text-3xl text-foreground mb-4">Sign in to view your profile</h2>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-6 rounded-3xl">Sign In</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <h1 className="font-display text-4xl text-foreground">Profile</h1>
        
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="p-6 bg-card border-border shadow-soft">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-accent/20 p-3 rounded-2xl"><User className="h-5 w-5 text-foreground" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-foreground font-medium">{user.email}</p>
                    </div>
                  </div>
                  {profile?.is_premium && (
                    <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5" /><span className="text-xs font-medium">Premium</span>
                    </div>
                  )}
                </div>
                {!profile?.is_premium && <Button onClick={() => navigate("/premium")} variant="outline" size="sm" className="w-full"><Crown className="h-4 w-4 mr-2" />Upgrade</Button>}
              </Card>

              <Card className="p-6 bg-card border-border shadow-soft">
                <Label className="text-foreground mb-3 block">Your Mentor</Label>
                {selectedMentor && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-accent/10 rounded-2xl">
                    {selectedMentor.avatar_url && <img src={selectedMentor.avatar_url} alt={selectedMentor.name} className="w-10 h-10 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{selectedMentor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedMentor.tone_description}</p>
                    </div>
                  </div>
                )}
                <Select value={profile?.selected_mentor_id || ""} onValueChange={handleChangeMentor}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select a mentor" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    {mentors?.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            </div>

            <Card className="p-6 mb-6 bg-card border-border shadow-soft">
              <h2 className="font-display text-2xl text-foreground mb-6">Mentor Options</h2>
              <div className="space-y-4">
                <Button 
                  onClick={() => navigate("/mentor-selection")} 
                  variant="outline"
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  Browse All Mentors
                </Button>
                <Button 
                  onClick={() => navigate("/onboarding")} 
                  variant="outline"
                  className="w-full"
                >
                  <Repeat className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Button>
              </div>
            </Card>

            <div className="pt-6 border-t border-border">
              <Button onClick={handleSignOut} variant="outline" className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <h1 className="font-display text-4xl text-foreground mb-6">Notifications</h1>
            <PushNotificationSettings />
            
            <Card className="p-6 bg-card border-border shadow-soft">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-accent/20 p-2 rounded-xl"><Bell className="h-5 w-5 text-foreground" /></div>
                <h2 className="font-display text-2xl text-foreground">Adaptive Pushes™</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Smart reminders in the voice you need, exactly when you need them.
              </p>
              
              {adaptivePushSettings ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl">
                    <div className="flex-1">
                      <Label className="text-foreground font-medium">Enable Adaptive Pushes</Label>
                      <p className="text-xs text-muted-foreground mt-1">Get personalized nudges throughout your day</p>
                    </div>
                    <Switch 
                      checked={adaptivePushSettings.enabled ?? false}
                      onCheckedChange={handleToggleAdaptivePush}
                    />
                  </div>
                  
                  {adaptivePushSettings.enabled && (
                    <div className="ml-2 space-y-3 text-sm text-muted-foreground">
                      <p>✓ Tailored to your mentor's style</p>
                      <p>✓ Delivered when you need motivation most</p>
                      <p>✓ Contextual to your goals and progress</p>
                    </div>
                  )}
                </div>
              ) : (
                <Button onClick={handleCreateAdaptivePushSettings} className="w-full">Enable Adaptive Pushes</Button>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
