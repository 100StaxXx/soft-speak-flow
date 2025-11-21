import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
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
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                This Privacy Policy explains how R-Evolution ("we," "us," or "our") collects, uses, and protects your personal information when you use our application and services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <div className="text-muted-foreground space-y-2">
                <p><strong>Account Information:</strong> Email address, username, profile preferences</p>
                <p><strong>Usage Data:</strong> Habits tracked, tasks completed, check-ins, reflections, mood logs</p>
                <p><strong>Companion Data:</strong> Evolution progress, XP earned, companion customization choices</p>
                <p><strong>Communication Data:</strong> Interactions with AI mentors, chat history, selected preferences</p>
                <p><strong>Device Information:</strong> Device type, operating system, app version, timezone</p>
                <p><strong>Analytics:</strong> Usage patterns, feature engagement, performance metrics</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <div className="text-muted-foreground space-y-2">
                <p>• Provide and improve our services</p>
                <p>• Personalize your experience and companion evolution</p>
                <p>• Generate AI-powered content and mentor responses</p>
                <p>• Send notifications and motivational content (if enabled)</p>
                <p>• Analyze usage patterns to improve features</p>
                <p>• Maintain security and prevent abuse</p>
                <p>• Process payments for premium features</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. AI and Data Processing</h2>
              <p className="text-muted-foreground">
                We use artificial intelligence to provide personalized mentorship, generate companion evolutions, and create motivational content. Your interaction data may be processed by AI systems to improve personalization. We implement measures to protect your privacy during AI processing, including data anonymization where appropriate.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground">
                We do not sell your personal data. We may share information with service providers who help us operate the app (hosting, analytics, payment processing), but only to the extent necessary. We may disclose information if required by law or to protect our rights and safety.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Your Rights and Choices</h2>
              <div className="text-muted-foreground space-y-2">
                <p>• Access and update your personal information</p>
                <p>• Delete your account and associated data</p>
                <p>• Opt-out of marketing communications</p>
                <p>• Disable push notifications</p>
                <p>• Export your data</p>
                <p>• Request data deletion (right to be forgotten)</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your data for as long as your account is active or as needed to provide services. When you delete your account, we will delete or anonymize your personal information within a reasonable timeframe, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. International Data Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to enhance your experience, remember preferences, and analyze usage. You can control cookie settings through your browser, though some features may not function properly if cookies are disabled.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Third-Party Links</h2>
              <p className="text-muted-foreground">
                Our app may contain links to third-party services. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Changes to Privacy Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Your continued use of the service after changes indicates acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us through the app's support channels or settings page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">15. GDPR Compliance (EU Users)</h2>
              <p className="text-muted-foreground">
                For users in the European Union, we comply with GDPR requirements. You have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data. To exercise these rights, contact us through the app.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
