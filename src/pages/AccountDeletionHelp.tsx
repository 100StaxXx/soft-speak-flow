import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Trash2, Info, ArrowLeft, Mail } from "lucide-react";

const deletionSteps = [
  {
    title: "Open the Profile tab",
    description: "Tap Profile in the bottom navigation once you're signed in.",
  },
  {
    title: "Choose the Account section",
    description: "Scroll to Account ▸ Danger Zone and tap Delete Account.",
  },
  {
    title: "Confirm the permanent deletion",
    description: "Review the warning and confirm. We sign you out and remove all saved progress immediately.",
  },
];

const dataTypes = [
  "Profile + onboarding answers",
  "Mentor chat history and nudges",
  "Companion evolutions, postcards, and XP events",
  "Quests, epics, and streak progress",
  "Referral codes, payouts, and applied tags",
];

export default function AccountDeletionHelp() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const primaryCta = useMemo(() => {
    if (user) {
      return {
        label: "Go to Profile",
        action: () => navigate("/profile"),
      };
    }

    return {
      label: "Sign in to delete",
      action: () => navigate("/auth"),
    };
  }, [user, navigate]);

  return (
    <div className="relative min-h-screen pb-nav-safe bg-background text-foreground">
      <StarfieldBackground />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 space-y-8">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Delete your Cosmiq account</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Cosmiq lets you permanently delete your account at any time, right inside the app. Follow the steps below or start the flow directly from the Profile tab.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={primaryCta.action}>
              {primaryCta.label}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/profile", { state: { showDeleteDialog: true } })}
              disabled={!user}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Open Delete dialog
            </Button>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Immediate, irreversible deletion</AlertTitle>
          <AlertDescription>
            Once confirmed, we call our Supabase edge function that erases every row tied to your user ID and then removes your authentication profile. There is no way to restore the data.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>How to delete your account</CardTitle>
            <CardDescription>All actions happen on-device—there is no need to email support.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {deletionSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What gets removed</CardTitle>
            <CardDescription>We wipe every table that references your user ID before deleting the profile row.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {dataTypes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Can't sign in?</CardTitle>
            <CardDescription>We still support direct removal if you lost access to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Email our team from the address tied to your account and include "Cosmiq account deletion" in the subject. We will verify ownership and run the same deletion routine on your behalf.
            </p>
            <Button asChild variant="outline">
              <a href="mailto:admin@cosmiq.quest">
                <Mail className="h-4 w-4 mr-2" />
                admin@cosmiq.quest
              </a>
            </Button>
          </CardContent>
        </Card>

        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle>Need more details?</AlertTitle>
          <AlertDescription>
            Read our <Link to="/privacy" className="underline font-medium">Privacy Policy</Link> for additional context on data retention and backups.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
