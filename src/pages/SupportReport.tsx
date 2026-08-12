import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import { useResilience } from "@/contexts/ResilienceContext";
import type { SupportReportCategory, SupportReportPayload } from "@/types/resilience";

type SupportReportLocationState = {
  defaultCategory?: SupportReportCategory;
  defaultMessage?: string;
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
  const { toast } = useToast();
  const { reportIssue } = useResilience();

  const initialCategory = useMemo(() => resolveDefaultCategory(locationState), [locationState]);
  const initialMessage = typeof locationState?.defaultMessage === "string"
    ? locationState.defaultMessage
    : "";
  const [category, setCategory] = useState<SupportReportCategory>(initialCategory);
  const [message, setMessage] = useState(initialMessage);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  const isFeedbackCategory = category === "feedback";

  const pageTitle = isFeedbackCategory ? "Send Feedback" : "Report a Problem";
  const pageDescription = isFeedbackCategory
    ? "Share ideas, feature requests, or anything that would make Graceward better. If you're offline or services are down, this feedback will be queued and sent later."
    : "Tell us what happened. If you're offline or services are down, this report will be queued and sent later.";
  const messageLabel = isFeedbackCategory ? "What would you like to share?" : "What happened?";
  const messagePlaceholder = isFeedbackCategory
    ? "Idea, request, or general feedback"
    : "Describe the problem you're running into";
  const submitLabel = isFeedbackCategory ? "Submit feedback" : "Submit report";

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

    if (!message.trim()) {
      toast({
        title: "Message required",
        description: isFeedbackCategory
          ? "Please share your feedback before submitting."
          : "Please describe the issue before submitting.",
        variant: "destructive",
      });
      return;
    }

    const payload: SupportReportPayload = {
      correlationId: createCorrelationId(),
      category,
      summary: message.trim(),
      reproductionSteps: "",
      expectedBehavior: "",
      actualBehavior: "",
      screenshotDataUrl,
      consentDiagnostics: false,
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
      <div className="daily-way-page relative z-10 min-h-screen pb-nav-safe">
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
                  <Label htmlFor="message">{messageLabel}</Label>
                  <Textarea
                    id="message"
                    placeholder={messagePlaceholder}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-32"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="screenshot">Optional screenshot</Label>
                  <Input id="screenshot" type="file" accept="image/*" onChange={handleScreenshotChange} />
                  {screenshotDataUrl && (
                    <p className="text-xs text-muted-foreground">Screenshot attached</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={isSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Submitting..." : submitLabel}
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
