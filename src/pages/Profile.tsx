import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Crown, User, Bell, Repeat, LogOut, BookHeart, FileText, Shield, Gift, Trash2, Sparkles, HelpCircle, Search, ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { DailyQuoteSettings } from "@/components/DailyQuoteSettings";
import { ReferralDashboard } from "@/components/ReferralDashboard";
import { CompanionSkins } from "@/components/CompanionSkins";
import { ReferralCodeRedeemCard } from "@/components/ReferralCodeRedeemCard";
import { FactionBadge } from "@/components/FactionBadge";

import { PageTransition } from "@/components/PageTransition";
import { ResetCompanionButton } from "@/components/ResetCompanionButton";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { SoundSettings } from "@/components/SoundSettings";
import { LegalDocumentViewer } from "@/components/LegalDocumentViewer";
import { AstrologySettings } from "@/components/AstrologySettings";
import { DisplayNameSetting } from "@/components/DisplayNameSetting";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Quick Action Card Component
const QuickActionCard = ({ 
  icon: Icon, 
  label, 
  description,
  onClick,
  variant = "default"
}: { 
  icon: LucideIcon; 
  label: string; 
  description?: string;
  onClick: () => void;
  variant?: "default" | "accent" | "info";
}) => (
  <button
    onClick={onClick}
    className={`
      group flex items-center gap-3 p-4 rounded-xl border transition-all text-left w-full
      active:scale-[0.98] select-none
      ${variant === "accent" 
        ? "bg-gradient-to-br from-stardust-gold/10 to-amber-600/5 border-stardust-gold/20 sm:hover:border-stardust-gold/40" 
        : variant === "info"
        ? "bg-gradient-to-br from-celestial-blue/10 to-blue-600/5 border-celestial-blue/20 sm:hover:border-celestial-blue/40"
        : "bg-card/50 border-border/50 sm:hover:border-primary/40 sm:hover:bg-card/80"
      }
    `}
    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
  >
    <div className={`
      flex items-center justify-center w-10 h-10 rounded-lg shrink-0
      ${variant === "accent" 
        ? "bg-stardust-gold/20 text-stardust-gold" 
        : variant === "info"
        ? "bg-celestial-blue/20 text-celestial-blue"
        : "bg-primary/10 text-primary"
      }
    `}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1 min-w-0">
      <span className="font-medium text-foreground block">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground block truncate">{description}</span>
      )}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
  </button>
);

const Profile = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("account");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isChangingMentor, setIsChangingMentor] = useState(false);
  const [viewingLegalDoc, setViewingLegalDoc] = useState<"terms" | "privacy" | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const isDeleteConfirmationValid = deleteConfirmationText.trim().toLowerCase() === "delete";

  // Check if we should open a specific tab from navigation state
  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab);
    }
  }, [location.state]);

  // Automatically open the delete dialog when deep-linked from the help page
  useEffect(() => {
    if (location.state?.showDeleteDialog) {
      setActiveTab("account");
      setShowDeleteDialog(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.showDeleteDialog, location.pathname, navigate]);


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


  const handleChangeMentor = async (mentorId: string) => {
    if (!user || isChangingMentor) return;
    setIsChangingMentor(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          selected_mentor_id: mentorId,
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

  const handleDeleteAccount = async () => {
    if (!user || isDeletingAccount || !isDeleteConfirmationValid) return;

    setIsDeletingAccount(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Session expired. Please sign in again.");
      }

      const { error } = await supabase.functions.invoke("delete-user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error) {
        throw new Error(error.message || "Unable to delete account");
      }

      queryClient.clear();
      setShowDeleteDialog(false);
      setDeleteConfirmationText("");
      toast({
        title: "Account deleted",
        description: "Your account and saved progress have been permanently removed.",
      });

      await signOut();
      navigate("/auth", {
        replace: true,
        state: { message: "Your account has been deleted." },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong deleting your account.";
      if (errorMessage.toLowerCase().includes("jwt") || errorMessage.toLowerCase().includes("token")) {
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        await signOut();
        navigate("/auth", { replace: true });
      } else {
        toast({
          title: "Account deletion failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };



  if (!user) {
    return (
      <PageTransition>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe flex items-center justify-center relative z-10">
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
      <StarfieldBackground />
      
      <div className="min-h-screen pb-nav-safe relative">
        {/* Header */}
        <div className="sticky top-0 z-40 cosmiq-glass-header safe-area-top">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Command Center
                </h1>
                <p className="text-sm text-muted-foreground">Your account & settings</p>
              </div>
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative z-10">
          {/* Quick Actions Grid */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <QuickActionCard 
                icon={Search} 
                label="Search" 
                description="Find quotes, pep talks & more"
                onClick={() => navigate("/search")} 
                variant="info"
              />
              <QuickActionCard 
                icon={BookHeart} 
                label="Library" 
                description="Favorites & downloads"
                onClick={() => navigate("/library")} 
              />
              <QuickActionCard 
                icon={Sparkles} 
                label="Weekly Recaps" 
                description="Past reflections"
                onClick={() => navigate("/recaps")} 
                variant="accent"
              />
              <QuickActionCard 
                icon={HelpCircle} 
                label="Help Center" 
                description="Guides & tutorials"
                onClick={() => navigate("/help")} 
                variant="info"
              />
            </div>
          </section>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 cosmiq-glass-subtle border border-cosmiq-glow/20">
              <TabsTrigger value="account" className="text-xs sm:text-sm py-2">Account</TabsTrigger>
              <TabsTrigger value="rewards" className="text-xs sm:text-sm py-2">Rewards</TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">Alerts</TabsTrigger>
              <TabsTrigger value="preferences" className="text-xs sm:text-sm py-2">Prefs</TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-4">
              {/* Faction Badge - compact */}
              {profile?.faction && (
                <FactionBadge 
                  faction={profile.faction} 
                  variant="full"
                  showMotto={true}
                  showTraits={false}
                />
              )}

              {/* Account Info - compact */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate ml-4">{user.email}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Display Name Setting */}
              <DisplayNameSetting />

              <SubscriptionManagement />

              {/* Mentor Selection - cleaner */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Mentor</CardTitle>
                  <CardDescription className="text-xs">Change your AI mentor anytime</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedMentor && (
                    <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                      {selectedMentor.avatar_url && (
                        <img 
                          src={selectedMentor.avatar_url} 
                          alt={selectedMentor.name} 
                          className="w-10 h-10 rounded-full object-cover" 
                          loading="lazy" 
                          decoding="async" 
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{selectedMentor.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedMentor.tone_description}</p>
                      </div>
                    </div>
                  )}
                  <Select value={profile?.selected_mentor_id || ""} onValueChange={handleChangeMentor} disabled={isChangingMentor}>
                    <SelectTrigger disabled={isChangingMentor} className="h-9">
                      <SelectValue placeholder={isChangingMentor ? "Changing..." : "Select mentor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mentors?.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => navigate("/mentor-selection")} variant="outline" size="sm" className="text-xs h-8">
                      <User className="h-3 w-3 mr-1.5" />Browse All
                    </Button>
                    <Button onClick={() => navigate("/onboarding")} variant="outline" size="sm" className="text-xs h-8">
                      <Repeat className="h-3 w-3 mr-1.5" />Retake Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Companion Reset */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Companion</CardTitle>
                  <CardDescription className="text-xs">Reset to create a new companion</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResetCompanionButton />
                </CardContent>
              </Card>

              {/* Legal Documents */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => setViewingLegalDoc("terms")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    Terms of Service
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => setViewingLegalDoc("privacy")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    Privacy Policy
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    asChild
                  >
                    <a
                      href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                      Apple End User License Agreement
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Delete Account - moved to bottom, less prominent */}
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account, companion, and all progress.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      className="px-0 text-xs text-muted-foreground h-auto"
                      onClick={() => navigate("/account-deletion")}
                    >
                      Learn more
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-8"
                      disabled={isDeletingAccount}
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rewards Tab (Referrals moved here) */}
            <TabsContent value="rewards" className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Referrals & Rewards</h2>
                  <p className="text-xs text-muted-foreground">
                    Invite friends to unlock cosmetic companion skins
                  </p>
                </div>
              </div>
              
              <ReferralCodeRedeemCard />
              <ReferralDashboard />
              <CompanionSkins />
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4">
              <PushNotificationSettings />
              <DailyQuoteSettings />
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4">
              <SoundSettings />
              <AstrologySettings />
              
            </TabsContent>
          </Tabs>

          {/* Sign Out - subtle at bottom */}
          <div className="pt-4">
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-destructive"
              disabled={isSigningOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </div>
      <BottomNav />

      {/* Delete Account Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (isDeletingAccount) return;
          setShowDeleteDialog(open);
          if (!open) setDeleteConfirmationText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, companion, and progress. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation-input">Type "delete" to confirm</Label>
            <Input
              id="delete-confirmation-input"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder='Type "delete"'
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={isDeletingAccount}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || !isDeleteConfirmationValid}
            >
              {isDeletingAccount ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        title="About Command Center"
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
