import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, getDocuments, setDocument, updateDocument } from "@/lib/firebase/firestore";
import { firebaseAuth } from "@/lib/firebase/auth";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Crown, User, Bell, Repeat, LogOut, BookHeart, FileText, Shield, Gift, Moon, Trash2, Sparkles, MessageCircle, Info } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  const { data: adaptivePushSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["adaptive-push-settings", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const data = await getDocument("adaptive_push_settings", user.uid);
      return data;
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["mentors", "active"],
    queryFn: async () => {
      const data = await getDocuments(
        "mentors",
        [["is_active", "==", true]],
        "name",
        "asc"
      );
      const map = new Map<string, any>();
      for (const m of data) {
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
      
      const data = await getDocument("mentors", profile.selected_mentor_id);
      return data;
    },
  });

  const handleToggleAdaptivePush = async () => {
    if (!user) return;
    try {
      const newState = !adaptivePushSettings?.enabled;
      if (adaptivePushSettings) {
        await updateDocument("adaptive_push_settings", user.uid, { enabled: newState });
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
      await updateDocument("profiles", user.uid, {
        selected_mentor_id: mentorId,
        // Also ensure timezone is set if not already
        timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      });
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
      // Import the helper function
      const { deleteUserAccount } = await import("@/lib/firebase/functions");

      // Call the Cloud Function (this will delete the user from Firebase Auth)
      await deleteUserAccount();

      queryClient.clear();
      setShowDeleteDialog(false);
      setDeleteConfirmationText("");
      toast({
        title: "Account deleted",
        description: "Your account and saved progress have been permanently removed.",
      });

      // Try to sign out (may fail if user is already deleted, which is fine)
      try {
        await signOut();
      } catch (signOutError) {
        // User may already be deleted by the Cloud Function, which is expected
        console.log("Sign out after deletion:", signOutError);
      }

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

  const handleCreateAdaptivePushSettings = async () => {
    if (!user) return;
    try {
      await setDocument("adaptive_push_settings", user.uid, {
        id: user.uid,
        user_id: user.uid,
        enabled: true,
        mentor_id: profile?.selected_mentor_id,
      }, false);
      refetchSettings();
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
              {/* Faction Identity Card */}
              {profile?.faction && (
                <FactionBadge 
                  faction={profile.faction} 
                  variant="full"
                  showMotto={true}
                  showTraits={true}
                />
              )}

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

              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 border-primary/20 shadow-inner">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Why Cosmiq is different
                  </CardTitle>
                  <CardDescription>
                    App Review feedback called out saturated horoscope apps—here&apos;s what makes Cosmiq unique.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Adaptive mentor chat + nudges</p>
                      <p>Choose an AI mentor, fire off one-tap prompts from Quick Chat, and receive mentor-authored nudges stored per user in Firebase.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Evolving companion game loop</p>
                      <p>Story-driven onboarding assigns a faction, zodiac profile, and living companion that unlocks 21 visual evolutions and quests.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Referral cosmetics, not fortune spam</p>
                      <p>Referral rewards only unlock limited companion skins—no recycled horoscope feeds or paywalled readings.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                    <p className="text-sm text-muted-foreground">
                      Refer friends to unlock cosmetic companion skins for yourself. Applying a code just tags them so they earn a skin when you reach Stage 3—your access stays the same.
                    </p>
                  </div>
                </div>
                
                <ReferralCodeRedeemCard />
                <ReferralDashboard />
                <Card className="border-dashed border-primary/40 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Referral FAQ
                    </CardTitle>
                    <CardDescription>Answers to App Review&apos;s questions about codes vs. rewards.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li>
                        <span className="font-semibold text-foreground">Referral code:</span> a unique tag minted on signup so friends can credit you. Entering a code never unlocks extra content for the new user—it just ties their profile to the referrer for rewards tracking.
                      </li>
                      <li>
                        <span className="font-semibold text-foreground">Referral rewards:</span> purely cosmetic companion skins automatically delivered to the referrer once a tagged friend reaches Stage 3. No paywalled horoscopes, chats, or quests unlock.
                      </li>
                      <li>
                        <span className="font-semibold text-foreground">Digital content unlocked:</span> limited-run skin variants listed below in Companion Skins. They only change appearance for the referrer and never impact the recipient&apos;s access tier.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
                <CompanionSkins />
              </div>

              {/* Danger Zone */}
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive">Delete Account</CardTitle>
                  <CardDescription>
                    Permanently remove your profile, mentor progress, and saved data from Cosmiq.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. You will lose access to your companion, streaks, referrals, and any
                    personalized content tied to this account.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can delete your account at any time. This will permanently remove your data from our servers.
                  </p>
                  <Button
                    variant="link"
                    className="px-0 text-sm text-primary"
                    onClick={() => navigate("/account-deletion")}
                  >
                    How account deletion works
                  </Button>
                  <AlertDialog
                    open={showDeleteDialog}
                    onOpenChange={(open) => {
                      if (isDeletingAccount) return;
                      setShowDeleteDialog(open);
                      if (!open) {
                        setDeleteConfirmationText("");
                      }
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-destructive/60 text-destructive hover:bg-destructive/10"
                        disabled={isDeletingAccount}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeletingAccount ? "Deleting..." : "Delete account"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your account, your companion, and your progress. This can&apos;t be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="delete-confirmation-input">Type "delete" to confirm</Label>
                        <Input
                          id="delete-confirmation-input"
                          value={deleteConfirmationText}
                          onChange={(event) => setDeleteConfirmationText(event.target.value)}
                          placeholder='Type "delete"'
                          autoComplete="off"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          disabled={isDeletingAccount}
                        />
                        <p className="text-xs text-muted-foreground">
                          This extra step prevents accidental deletions.
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleDeleteAccount}
                          disabled={isDeletingAccount || !isDeleteConfirmationValid}
                        >
                          {isDeletingAccount ? "Deleting..." : "Delete account"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

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
                  <CardTitle>Gameplay</CardTitle>
                  <CardDescription>Customize your game experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="astral-encounters">Astral Encounters</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable mini-game boss battles that appear as you complete quests
                      </p>
                    </div>
                    <Switch
                      id="astral-encounters"
                      checked={profile?.astral_encounters_enabled !== false}
                      onCheckedChange={async (checked) => {
                        if (!user?.id) return;
                        const { error } = await supabase
                          .from('profiles')
                          .update({ astral_encounters_enabled: checked })
                          .eq('id', user.id);
                        if (error) {
                          sonnerToast.error('Failed to update setting');
                        } else {
                          queryClient.invalidateQueries({ queryKey: ['profile'] });
                          sonnerToast.success(checked ? 'Astral Encounters enabled' : 'Astral Encounters disabled');
                        }
                      }}
                    />
                  </div>
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
