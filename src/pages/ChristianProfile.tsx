import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  BookHeart,
  BookOpen,
  ChevronRight,
  CircleHelp,
  FileText,
  LogOut,
  MessageSquareText,
  MessagesSquare,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { PageTransition } from "@/components/PageTransition";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { CompanionMemorySettings } from "@/components/CompanionMemorySettings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT } from "@/config/product";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  deleteCurrentAccount,
  getAccountDeletionFailureMessage,
  isAccountDeletionAuthError,
} from "@/services/accountDeletion";
import { useToast } from "@/hooks/use-toast";

const SettingLink = ({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof User;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-4 rounded-2xl border border-input bg-card/80 p-4 text-left transition hover:border-primary hover:bg-card"
  >
    <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold">{title}</span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
    </span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </button>
);

export default function ChristianProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (location.state?.showDeleteDialog) {
      setShowDeleteDialog(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (location.hash !== "#reminders") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("reminders")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  const onboarding = profile?.onboarding_data as Record<string, unknown> | null;
  const translation = typeof onboarding?.bible_translation === "string"
    ? onboarding.bible_translation
    : "WEB";

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      toast({
        title: "Could not sign out",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  }, [isSigningOut, navigate, signOut, toast]);

  const handleDelete = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isDeleting || deleteConfirmation.trim().toLowerCase() !== "delete") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        title: "Connection required",
        description: "Account deletion requires a live connection.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { warnings } = await deleteCurrentAccount({ queryClient, userId: user.id, signOut });
      setShowDeleteDialog(false);
      setDeleteConfirmation("");
      toast({
        title: "Account deleted",
        description: warnings.length > 0
          ? "Your account was deleted. Some file cleanup will finish in the background."
          : "Your account and saved data have been permanently removed.",
      });
      navigate("/auth", { replace: true, state: { message: "Your account has been deleted." } });
    } catch (error) {
      if (isAccountDeletionAuthError(error)) {
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        await signOut().catch(() => undefined);
        navigate("/auth", { replace: true });
      } else {
        toast({
          title: "Account deletion failed",
          description: getAccountDeletionFailureMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmation, isDeleting, navigate, queryClient, signOut, toast, user]);

  return (
    <PageTransition mode="instant">
      <div className="daily-way-page min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
          <header className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{PRODUCT.name}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Account & settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your daily practice, privacy, and support.</p>
            </div>
          </header>

          <main className="mt-7 space-y-6">
            <Card className="border-border/70 bg-card/85 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user?.email ?? "Graceward account"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{translation} Scripture · Daily practice prepared for you</p>
                </div>
              </div>
            </Card>

            <section className="space-y-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Daily practice</p>
              <SettingLink icon={BookOpen} title="Today’s Scripture" description="Return to today’s reviewed passage and prayer." onClick={() => navigate("/mentor")} />
              <SettingLink icon={BookHeart} title="Past encouragements" description="Revisit the daily words you’ve received and heard." onClick={() => navigate("/encouragements")} />
              <SettingLink icon={MessagesSquare} title="Your Guide" description="Meet or change the Guide who supports your reflections." onClick={() => navigate("/mentor-selection")} />
              <SettingLink
                icon={Bell}
                title="Reminders"
                description="Choose whether and when Graceward sends your daily encouragement."
                onClick={() => navigate("/profile#reminders")}
              />
            </section>

            <section id="reminders" className="scroll-mt-24" aria-label="Reminder settings">
              <PushNotificationSettings />
            </section>

            <section className="space-y-3" aria-label="Privacy and personalization settings">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Privacy & personalization</p>
              <CompanionMemorySettings />
            </section>

            <section className="space-y-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trust & support</p>
              <SettingLink icon={CircleHelp} title="Help center" description="How Graceward handles Scripture, guidance, and your data." onClick={() => navigate("/help")} />
              <SettingLink icon={MessageSquareText} title="Contact support" description={PRODUCT.supportEmail} onClick={() => navigate("/support/report")} />
              <SettingLink icon={FileText} title="Terms of service" description="Terms for using Graceward." onClick={() => navigate("/terms")} />
              <SettingLink icon={ShieldCheck} title="Privacy policy" description="What is collected, why, and how to delete it." onClick={() => navigate("/privacy")} />
            </section>

            <section className="space-y-3">
              <Button variant="outline" className="h-12 w-full justify-start rounded-2xl" disabled={isSigningOut} onClick={() => void handleSignOut()}>
                <LogOut className="mr-3 h-4 w-4" />{isSigningOut ? "Signing out…" : "Sign out"}
              </Button>
              <Button variant="ghost" className="h-12 w-full justify-start rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-3 h-4 w-4" />Delete account and data
              </Button>
            </section>
          </main>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        if (isDeleting) return;
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmation("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes your account, reflections, completed practices, and saved progress. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <form className="space-y-4" onSubmit={handleDelete}>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">Type “delete” to confirm</Label>
              <Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" autoCapitalize="none" disabled={isDeleting} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={isDeleting}>Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={isDeleting || deleteConfirmation.trim().toLowerCase() !== "delete"}>
                {isDeleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
