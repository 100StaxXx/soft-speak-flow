import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useResilience } from "@/contexts/ResilienceContext";
import type { SupportReportCategory, SupportReportPayload } from "@/types/resilience";

type SupportReportLocationState = {
  defaultCategory?: SupportReportCategory;
} | null;

const SUPPORT_REPORT_CATEGORIES: readonly SupportReportCategory[] = [
  "bug",
  "billing",
  "sync",
  "performance",
  "feedback",
  "other",
];

const isSupportReportCategory = (value: unknown): value is SupportReportCategory =>
  typeof value === "string" && SUPPORT_REPORT_CATEGORIES.includes(value as SupportReportCategory);

const resolveDefaultCategory = (state: SupportReportLocationState): SupportReportCategory => {
  const defaultCategory = state?.defaultCategory;
  return isSupportReportCategory(defaultCategory) ? defaultCategory : "bug";
};

const createCorrelationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `support-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function SupportReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as SupportReportLocationState) ?? null;
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    state,
    backendHealth,
    isOnline,
    queueCount,
    recentErrorFingerprints,
    reportIssue,
  } = useResilience();

  const initialCategory = useMemo(() => resolveDefaultCategory(locationState), [locationState]);
  const [category, setCategory] = useState<SupportReportCategory>(initialCategory);
  const [summary, setSummary] = useState("");
  const [reproductionSteps, setReproductionSteps] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [consentDiagnostics, setConsentDiagnostics] = useState(true);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const isFeedbackCategory = category === "feedback";

  const pageTitle = isFeedbackCategory ? "Send Feedback" : "Report a Problem";
  const pageDescription = isFeedbackCategory
    ? "Share ideas, feature requests, or anything that would make Cosmiq better. If you're offline or services are down, this feedback will be queued and sent later."
    : "Tell us what happened. If you're offline or services are down, this report will be queued and sent later.";
  const summaryLabel = isFeedbackCategory ? "What would you like to share?" : "Summary";
  const summaryPlaceholder = isFeedbackCategory ? "Idea, request, or general feedback" : "Short issue summary";
  const reproductionLabel = isFeedbackCategory ? "More details (optional)" : "Reproduction steps";
  const reproductionPlaceholder = isFeedbackCategory ? "What prompted this feedback?" : "Step-by-step reproduction";
  const expectedLabel = isFeedbackCategory ? "What would you love to see? (optional)" : "Expected behavior";
  const actualLabel = isFeedbackCategory ? "Anything getting in the way? (optional)" : "Actual behavior";
  const submitLabel = isFeedbackCategory ? "Submit feedback" : "Submit report";
  const emailLabel = isFeedbackCategory ? "Email feedback" : "Email support";

  const diagnostics = useMemo(() => {
    return {
      appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? import.meta.env.MODE,
      platform: Capacitor.getPlatform(),
      route: `${location.pathname}${location.search}`,
      authState: user ? "authenticated" : "unauthenticated",
      connectivity: {
        isOnline,
        resilienceState: state,
        backendHealth,
      },
      queueDepth: queueCount,
      recentErrorFingerprints,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      capturedAt: new Date().toISOString(),
    } as const;
  }, [backendHealth, isOnline, location.pathname, location.search, queueCount, recentErrorFingerprints, state, user]);

  const mailtoHref = useMemo(() => {
    const body = [
      `Category: ${category}`,
      `Summary: ${summary || "(none)"}`,
      "",
      "Reproduction Steps:",
      reproductionSteps || "(none)",
      "",
      "Expected:",
      expectedBehavior || "(none)",
      "",
      "Actual:",
      actualBehavior || "(none)",
      "",
      consentDiagnostics ? `Diagnostics:\n${JSON.stringify(diagnostics, null, 2)}` : "Diagnostics: not attached",
    ].join("\n");

    const subject = isFeedbackCategory ? "Cosmiq Feedback" : "Cosmiq Support Report";
    return `mailto:admin@cosmiq.quest?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [actualBehavior, category, consentDiagnostics, diagnostics, expectedBehavior, isFeedbackCategory, reproductionSteps, summary]);

  const handleScreenshotChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setScreenshotDataUrl(undefined);
      return;
    }

    if (file.size > 1_500_000) {
      toast({
        title: "Screenshot too large",
        description: "Please choose an image under 1.5 MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setScreenshotDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!summary.trim()) {
      toast({
        title: "Summary required",
        description: isFeedbackCategory
          ? "Please share a short summary of your feedback."
          : "Please provide a short description of the issue.",
        variant: "destructive",
      });
      return;
    }

    const payload: SupportReportPayload = {
      correlationId: createCorrelationId(),
      category,
      summary: summary.trim(),
      reproductionSteps: reproductionSteps.trim(),
      expectedBehavior: expectedBehavior.trim(),
      actualBehavior: actualBehavior.trim(),
      screenshotDataUrl,
      consentDiagnostics,
      diagnostics,
    };

    setIsSubmitting(true);
    try {
      const result = await reportIssue(payload);

      if (result.queued) {
        toast({
          title: isFeedbackCategory ? "Feedback saved locally" : "Report saved locally",
          description: isFeedbackCategory
            ? "We'll send your feedback when connected."
            : "We'll send when connected.",
        });
      } else {
        toast({
          title: isFeedbackCategory ? "Feedback sent" : "Report sent",
          description: isFeedbackCategory
            ? "Thanks. We received your feedback."
            : "Thanks. Support has received your report.",
        });
      }

      navigate(-1);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : (isFeedbackCategory ? "Unable to send feedback" : "Unable to send support report");
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen pb-nav-safe">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="pt-safe-top">
            <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{pageTitle}</CardTitle>
              <CardDescription>{pageDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as SupportReportPayload["category"])}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="bug">Bug</option>
                    <option value="billing">Billing</option>
                    <option value="sync">Sync/Offline</option>
                    <option value="performance">Performance</option>
                    <option value="feedback">Feedback</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">{summaryLabel}</Label>
                  <Input
                    id="summary"
                    placeholder={summaryPlaceholder}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="steps">{reproductionLabel}</Label>
                  <Textarea
                    id="steps"
                    placeholder={reproductionPlaceholder}
                    value={reproductionSteps}
                    onChange={(event) => setReproductionSteps(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected">{expectedLabel}</Label>
                  <Textarea
                    id="expected"
                    value={expectedBehavior}
                    onChange={(event) => setExpectedBehavior(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual">{actualLabel}</Label>
                  <Textarea
                    id="actual"
                    value={actualBehavior}
                    onChange={(event) => setActualBehavior(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="screenshot">Optional screenshot</Label>
                  <Input id="screenshot" type="file" accept="image/*" onChange={handleScreenshotChange} />
                  {screenshotDataUrl && (
                    <p className="text-xs text-muted-foreground">Screenshot attached</p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent"
                    checked={consentDiagnostics}
                    onCheckedChange={(checked) => setConsentDiagnostics(Boolean(checked))}
                  />
                  <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                    Include diagnostics (platform, route, connectivity state, queue depth, recent error fingerprints)
                  </Label>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={isSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Submitting..." : submitLabel}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <a href={mailtoHref}>
                      <Mail className="mr-2 h-4 w-4" />
                      {emailLabel}
                    </a>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
