import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8 pb-safe">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-2 sm:mb-4"
          aria-label="Go back to previous page"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        <Card className="shadow-sm">
          <CardHeader className="space-y-3 px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex items-center gap-2">
              <Lock className="h-6 w-6 sm:h-7 sm:w-7 text-primary" aria-hidden="true" />
              <CardTitle className="text-2xl sm:text-3xl leading-tight">Privacy Policy</CardTitle>
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Last Updated: November 21, 2025
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Cosmiq LLC • admin@cosmiq.quest
              </p>
            </div>
          </CardHeader>
          <CardContent className="allow-text-select prose dark:prose-invert max-w-none space-y-5 sm:space-y-6 px-4 sm:px-6 pb-6 text-sm sm:text-base">
            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                This Privacy Policy explains how Soft Speak Flow ("we," "us," or "our") collects, uses, and protects your personal information when you use our application and services.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                2. Information We Collect
              </h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Account Information:</p>
                  <p className="text-xs sm:text-sm">Email address, username, profile preferences</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Usage Data:</p>
                  <p className="text-xs sm:text-sm">Habits tracked, tasks completed, check-ins, reflections, mood logs</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Companion Data:</p>
                  <p className="text-xs sm:text-sm">Evolution progress, XP earned, companion customization choices</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Communication Data:</p>
                  <p className="text-xs sm:text-sm">Interactions with mentors, chat history, selected preferences</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Device Information:</p>
                  <p className="text-xs sm:text-sm">Device type, operating system, app version, timezone</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="font-medium text-foreground text-sm sm:text-base">Analytics:</p>
                  <p className="text-xs sm:text-sm">Usage patterns, feature engagement, performance metrics</p>
                </div>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                3. How We Use Your Information
              </h2>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Provide and improve our services</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Personalize your experience and companion evolution</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Provide personalized content and mentor responses</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Send notifications and motivational content (if enabled)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Analyze usage patterns to improve features</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Maintain security and prevent abuse</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Process payments for premium features</span>
                </p>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                4. Personalization and Data Processing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use advanced personalization to provide tailored mentorship, guide companion evolutions, and create motivational content. Your interaction data may be processed to improve personalization. We implement measures to protect your privacy during this processing, including data anonymization where appropriate.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                5. Data Sharing and Disclosure
              </h2>
              <div className="space-y-3">
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell your personal data. We may share information with service providers who help us operate the app (hosting, analytics, payment processing), but only to the extent necessary. We may disclose information if required by law or to protect our rights and safety.
                </p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm font-medium mb-2">Third-Party Services:</p>
                  <ul className="text-xs sm:text-sm space-y-1 list-none pl-0">
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">→</span>
                      <span>Supabase (database & authentication)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">→</span>
                      <span>Stripe (payment processing)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">→</span>
                      <span>Content personalization services</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                6. Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement industry-standard security measures to protect your data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                7. Your Rights and Choices
              </h2>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Access and update your personal information</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Delete your account and associated data</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Opt-out of marketing communications</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Disable push notifications</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Export your data</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary shrink-0">✓</span>
                  <span>Request data deletion (right to be forgotten)</span>
                </p>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                8. Data Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your data for as long as your account is active or as needed to provide services. When you delete your account, we will delete or anonymize your personal information within a reasonable timeframe, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                9. Children's Privacy
              </h2>
              <div className="space-y-3">
                <p className="text-muted-foreground leading-relaxed">
                  Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
                </p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-200">
                    Age Requirement: Users must be 13 or older
                  </p>
                </div>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                10. International Data Transfers
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                11. Cookies and Tracking
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar technologies to enhance your experience, remember preferences, and analyze usage. You can control cookie settings through your browser, though some features may not function properly if cookies are disabled.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                12. Third-Party Links
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our app may contain links to third-party services. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                13. Changes to Privacy Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Your continued use of the service after changes indicates acceptance of the updated policy.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                14. GDPR Compliance (EU Users)
              </h2>
              <div className="space-y-3">
                <p className="text-muted-foreground leading-relaxed">
                  For users in the European Union, we comply with GDPR requirements. You have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data.
                </p>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 sm:p-4 space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-purple-900 dark:text-purple-200">
                    EU Data Rights:
                  </p>
                  <ul className="text-xs sm:text-sm text-purple-800 dark:text-purple-300 space-y-1 list-none pl-0">
                    <li>• Right to access your data</li>
                    <li>• Right to rectification</li>
                    <li>• Right to erasure</li>
                    <li>• Right to data portability</li>
                    <li>• Right to object to processing</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                15. Contact Us
              </h2>
              <div className="space-y-2">
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-1">
                  <p className="text-sm font-medium">Cosmiq LLC</p>
                  <p className="text-sm text-muted-foreground">
                    Email:{" "}
                    <a
                      href="mailto:admin@cosmiq.quest"
                      className="text-primary hover:underline"
                      aria-label="Email Cosmiq LLC privacy team"
                    >
                      admin@cosmiq.quest
                    </a>
                  </p>
                  <p className="text-sm text-muted-foreground">Location: New Mexico, USA</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Subject Line: Please include "Privacy Request" for faster response
                  </p>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
