import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using this application ("R-Evolution"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground">
                R-Evolution is a personal development platform that provides habit tracking, AI-powered mentorship, motivational content, companion evolution features, and personalized guidance to help users achieve their goals.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Content and Conduct</h2>
              <p className="text-muted-foreground">
                You retain ownership of any content you create or submit. By using our service, you grant us a license to use, store, and process your content to provide and improve our services. You agree not to use the service for any unlawful purposes or in any way that could harm the service or other users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Premium Subscriptions</h2>
              <p className="text-muted-foreground">
                Premium features are available through subscription. Subscriptions automatically renew unless cancelled. Refunds are handled on a case-by-case basis. We reserve the right to modify pricing with advance notice to subscribers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of R-Evolution, including but not limited to text, graphics, logos, and software, are owned by us or our licensors and are protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. AI-Generated Content</h2>
              <p className="text-muted-foreground">
                Our service uses artificial intelligence to generate personalized content, mentor responses, and companion interactions. AI-generated content is provided for informational and motivational purposes only. While we strive for accuracy and helpfulness, AI responses may not always be perfect or applicable to your specific situation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Medical and Professional Disclaimer</h2>
              <p className="text-muted-foreground">
                R-Evolution is not a substitute for professional medical, psychological, or therapeutic services. Our content and AI mentorship are for motivational and educational purposes only. If you are experiencing mental health issues, please consult with qualified healthcare professionals.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, R-Evolution and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to terminate or suspend your account and access to the service at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. We will notify users of significant changes via email or in-app notification. Continued use of the service after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms of Service shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have questions about these Terms of Service, please contact us through the app's support channels or settings page.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
