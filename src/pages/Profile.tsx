import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crown, User, Bell, Repeat, LogOut, BookHeart, FileText, Shield, Gift, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { DailyQuoteSettings } from "@/components/DailyQuoteSettings";
import { ReferralDashboard } from "@/components/ReferralDashboard";
import { CompanionSkins } from "@/components/CompanionSkins";
import { ReferralCodeRedeemCard } from "@/components/ReferralCodeRedeemCard";

import { PageTransition } from "@/components/PageTransition";
import { ResetCompanionButton } from "@/components/ResetCompanionButton";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { SoundSettings } from "@/components/SoundSettings";
import { LegalDocumentViewer } from "@/components/LegalDocumentViewer";
import { AstrologySettings } from "@/components/AstrologySettings";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isChangingMentor, setIsChangingMentor] = useState(false);
  const [viewingLegalDoc, setViewingLegalDoc] = useState<"terms" | "privacy" | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);

  // Check if we should open a specific tab from navigation state
  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab);
    }
  }, [location.state]);

  const { data: adaptivePushSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["adaptive-push-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from("adaptive_push_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["mentors", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("id, name, slug, avatar_url, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      const map = new Map<string, any>();
      for (const m of data || []) {
        const key = (m.slug || m.name || "").trim().toLowerCase();
        if (!map.has(key)) map.set(key, m);
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: selectedMentor } = useQuery({
    queryKey: ["selected-mentor", profile?.selected_mentor_id],
    enabled: !!profile?.selected_mentor_id,
    queryFn: async () => {
      if (!profile?.selected_mentor_id) {
        throw new Error('No mentor selected');
      }
      
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to toggle adaptive push";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleChangeMentor = async (mentorId: string) => {
    if (!user || isChangingMentor) return;
    setIsChangingMentor(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          selected_mentor_id: mentorId,
          // Also ensure timezone is set if not already
          timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Mentor Updated", description: "Your mentor has been changed successfully" });
      window.location.reload();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change mentor";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setIsChangingMentor(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sign out";
      toast({ title: "Error signing out", description: errorMessage, variant: "destructive" });
      setIsSigningOut(false);
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
      if (!error) refetchSettings();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update settings";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };


  if (!user) {
    return (
      <PageTransition>
        <StarfieldBackground />
        <div className="min-h-screen pb-24 flex items-center justify-center relative z-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Sign in to view your profile</h2>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {/* Cosmiq Starfield Background */}
      <StarfieldBackground />
      
      <div className="min-h-screen pb-24 relative">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6 safe-area-top">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Profile
                </h1>
                <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
              </div>
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 space-y-6 relative z-10">
          <div className="max-w-md">
            <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-glow" onClick={() => navigate("/library")} data-tour="library">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <BookHeart className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Library</CardTitle>
                </div>
                <CardDescription>View your saved favorites and downloads</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your account details and settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <SubscriptionManagement />

              <Card>
                <CardHeader>
                  <CardTitle>Your Mentor</CardTitle>
                  <CardDescription>Change your AI mentor anytime</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedMentor && (
                    <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-xl">
                      {selectedMentor.avatar_url && <img src={selectedMentor.avatar_url} alt={selectedMentor.name} className="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" />}
                      <div className="flex-1">
                        <p className="font-semibold">{selectedMentor.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedMentor.tone_description}</p>
                      </div>
                    </div>
                  )}
                  <Select value={profile?.selected_mentor_id || ""} onValueChange={handleChangeMentor} disabled={isChangingMentor}>
                    <SelectTrigger disabled={isChangingMentor}>
                      <SelectValue placeholder={isChangingMentor ? "Changing mentor..." : "Select a mentor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mentors?.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => navigate("/mentor-selection")} variant="outline" size="sm"><User className="h-4 w-4 mr-2" />Browse All</Button>
                    <Button onClick={() => navigate("/onboarding")} variant="outline" size="sm"><Repeat className="h-4 w-4 mr-2" />Retake Quiz</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Companion Reset */}
              <Card>
                <CardHeader>
                  <CardTitle>Companion</CardTitle>
                  <CardDescription>Reset your companion to create a new one</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ResetCompanionButton />
                </CardContent>
              </Card>

              {/* Legal Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Legal
                  </CardTitle>
                  <CardDescription>Review our legal agreements and policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setViewingLegalDoc("terms")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Terms of Service
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setViewingLegalDoc("privacy")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Privacy Policy
                  </Button>
                </CardContent>
              </Card>

              {/* Referrals Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Gift className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-2xl font-bold">Referrals & Rewards</h2>
                    <p className="text-sm text-muted-foreground">Share Cosmiq and unlock exclusive companion skins</p>
                  </div>
                </div>
                
                <ReferralCodeRedeemCard />
                <ReferralDashboard />
                <CompanionSkins />
              </div>

            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <PushNotificationSettings />
              <DailyQuoteSettings />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Adaptive Pushes™</CardTitle>
                  <CardDescription>Smart reminders in the voice you need, exactly when you need them</CardDescription>
                </CardHeader>
                <CardContent>
                  {adaptivePushSettings ? (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label>Enable Adaptive Pushes</Label>
                        <p className="text-sm text-muted-foreground">Get personalized nudges throughout your day</p>
                      </div>
                      <Switch checked={adaptivePushSettings.enabled ?? false} onCheckedChange={handleToggleAdaptivePush} />
                    </div>
                  ) : (
                    <Button onClick={handleCreateAdaptivePushSettings} className="w-full">Enable Adaptive Pushes</Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-6">
              <SoundSettings />
              
              <AstrologySettings />
              
              <Card>
                <CardHeader>
                  <CardTitle>App Preferences</CardTitle>
                  <CardDescription>Customize your experience</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">More preferences coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Sign Out Button */}
          <div className="mt-8 pb-6">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={isSigningOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </div>
      <BottomNav />

      {/* Legal Document Viewer */}
      {viewingLegalDoc && (
        <LegalDocumentViewer
          open={viewingLegalDoc !== null}
          onOpenChange={(open) => !open && setViewingLegalDoc(null)}
          documentType={viewingLegalDoc}
        />
      )}
      
      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title="About Your Profile"
        icon={User}
        description="Manage your account settings, notifications, and preferences all in one place."
        features={[
          "Update your account information and subscription",
          "Change your mentor anytime to match your needs",
          "Manage push notifications and daily reminders",
          "Share your referral code to unlock companion skins",
          "Customize app preferences and sound settings"
        ]}
        tip="Invite friends with your referral code to unlock exclusive companion skins!"
      />
    </PageTransition>
  );
};

export default Profile;
