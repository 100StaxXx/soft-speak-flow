import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
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
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary" aria-hidden="true" />
              <CardTitle className="text-2xl sm:text-3xl leading-tight">Terms of Service</CardTitle>
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
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using Soft Speak Flow ("the App"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                2. Description of Service
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Soft Speak Flow is a personal development platform that provides habit tracking, personalized mentorship, motivational content, companion evolution features, and guidance to help users achieve their goals.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                3. User Accounts
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                4. User Content and Conduct
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you create or submit. By using our service, you grant us a license to use, store, and process your content to provide and improve our services. You agree not to use the service for any unlawful purposes or in any way that could harm the service or other users.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                5. Premium Subscriptions
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Premium features are available through subscription. Subscriptions automatically renew unless cancelled. Refunds are handled on a case-by-case basis. We reserve the right to modify pricing with advance notice to subscribers.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                6. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of Soft Speak Flow, including but not limited to text, graphics, logos, and software, are owned by Cosmiq LLC or our licensors and are protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                7. Personalized Content
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our service creates personalized content, mentor responses, and companion interactions tailored to your journey. This content is provided for informational and motivational purposes only. While we strive for accuracy and helpfulness, personalized content may not always be perfect or applicable to your specific situation.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                8. Medical and Professional Disclaimer
              </h2>
              <div className="space-y-3">
                <p className="text-muted-foreground leading-relaxed font-medium">
                  ⚠️ Important: Soft Speak Flow is NOT a substitute for professional medical, psychological, or therapeutic services.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our content and mentor guidance are for motivational and educational purposes only. If you are experiencing mental health issues, please consult with qualified healthcare professionals.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 sm:p-4 space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Crisis Resources:
                  </p>
                  <ul className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 space-y-1 list-none pl-0">
                    <li>• National Suicide Prevention: 988</li>
                    <li>• Crisis Text Line: Text HOME to 741741</li>
                    <li>• Emergency Services: 911</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                9. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, Cosmiq LLC and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                10. Termination
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to terminate or suspend your account and access to the service at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                11. Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of significant changes via email or in-app notification. Continued use of the service after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                12. Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms of Service shall be governed by and construed in accordance with the laws of the State of New Mexico, United States of America, without regard to conflict of law principles.
              </p>
            </section>

            <section className="scroll-mt-20 space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                13. Contact Information
              </h2>
              <div className="space-y-2">
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-1">
                  <p className="text-sm font-medium">Cosmiq LLC</p>
                  <p className="text-sm text-muted-foreground">
                    Email:{" "}
                    <a
                      href="mailto:admin@cosmiq.quest"
                      className="text-primary hover:underline"
                      aria-label="Email Cosmiq LLC support"
                    >
                      admin@cosmiq.quest
                    </a>
                  </p>
                  <p className="text-sm text-muted-foreground">Location: New Mexico, USA</p>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
