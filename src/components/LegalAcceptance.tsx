import { useState } from "react";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/utils/storage";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDocumentViewer } from "./LegalDocumentViewer";
import { Shield, FileText, Lock } from "lucide-react";

interface LegalAcceptanceProps {
  onAccept: () => void;
}

export const LegalAcceptance = ({ onAccept }: LegalAcceptanceProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [age13Confirmed, setAge13Confirmed] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<"terms" | "privacy" | null>(null);

  const canProceed = termsAccepted && privacyAccepted && age13Confirmed;

  const handleAccept = () => {
    if (canProceed) {
      // Store acceptance timestamp
      safeLocalStorage.setItem('legal_accepted_at', new Date().toISOString());
      safeLocalStorage.setItem('legal_accepted_version', '2025-11-21');
      onAccept();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">Welcome to Soft Speak Flow</CardTitle>
            <CardDescription className="text-base">
              Before we begin your wellness journey, please review and accept our legal agreements
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Age Confirmation */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="age-confirm"
                  checked={age13Confirmed}
                  onCheckedChange={(checked) => setAge13Confirmed(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="age-confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I confirm that I am at least 13 years old
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Users under 13 are not permitted to use this app in compliance with COPPA
                  </p>
                </div>
              </div>
            </div>

            {/* Terms of Service */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I have read and agree to the Terms of Service
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review our terms covering app usage, payments, and legal agreements
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingDocument("terms")}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Read Terms of Service
              </Button>
            </div>

            {/* Privacy Policy */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="privacy"
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="privacy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I have read and agree to the Privacy Policy
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Learn how we collect, use, and protect your personal information
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingDocument("privacy")}
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                Read Privacy Policy
              </Button>
            </div>

            {/* Important Health Disclaimer */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-900 dark:text-amber-200 font-medium mb-1">
                ⚠️ Important Health Disclaimer
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                This app is for general wellness purposes only and is not a substitute for professional
                medical advice, diagnosis, or treatment. If you are experiencing a mental health crisis,
                please contact emergency services (988 or 911).
              </p>
            </div>

            {/* Continue Button */}
            <Button
              onClick={handleAccept}
              disabled={!canProceed}
              className="w-full"
              size="lg"
            >
              Accept and Continue
            </Button>

            {!canProceed && (
              <p className="text-xs text-center text-muted-foreground">
                Please accept all agreements and confirm your age to continue
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legal Document Viewer */}
      {viewingDocument && (
        <LegalDocumentViewer
          open={viewingDocument !== null}
          onOpenChange={(open) => !open && setViewingDocument(null)}
          documentType={viewingDocument}
        />
      )}
    </>
  );
};
