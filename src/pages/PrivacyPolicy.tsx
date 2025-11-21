import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: November 21, 2025</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you use our mentorship and personal development application. Please read this policy 
              carefully to understand our practices regarding your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Email address, name, and authentication credentials</li>
              <li><strong>Profile Data:</strong> Selected mentor, preferences, timezone, and onboarding responses</li>
              <li><strong>User Content:</strong> Reflections, journal entries, mood logs, habit tracking data, and notes</li>
              <li><strong>Progress Data:</strong> Mission completions, achievements, XP scores, and companion evolution data</li>
              <li><strong>Communication Data:</strong> Messages sent to AI mentors and chat interactions</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Features accessed, time spent in app, interaction patterns</li>
              <li><strong>Device Information:</strong> Browser type, device type, operating system</li>
              <li><strong>Analytics Data:</strong> App performance metrics, error logs, and feature usage statistics</li>
              <li><strong>Push Notification Tokens:</strong> If you enable push notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and personalize the Service</li>
              <li>Generate AI-powered mentorship content tailored to your needs</li>
              <li>Track your progress and achievements</li>
              <li>Send daily motivational content and reminders (if enabled)</li>
              <li>Improve and optimize the Service</li>
              <li>Process premium subscriptions and payments</li>
              <li>Send important service updates and notifications</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. AI and Data Processing</h2>
            <p>
              Your personal data and content may be processed by AI systems to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Generate personalized mentor responses and guidance</li>
              <li>Create daily missions and motivational content</li>
              <li>Analyze your mood and progress patterns</li>
              <li>Provide contextual recommendations</li>
            </ul>
            <p className="mt-3">
              We use industry-standard AI models and take measures to protect your privacy during AI processing. 
              Your personal data is never shared with AI providers in identifiable form.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">5.1 Service Providers</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cloud infrastructure providers (for hosting and storage)</li>
              <li>Payment processors (for premium subscriptions)</li>
              <li>AI service providers (for content generation)</li>
              <li>Analytics providers (for app improvement)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">5.2 Legal Requirements</h3>
            <p>We may disclose your information if required by law or to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal processes</li>
              <li>Protect our rights and property</li>
              <li>Prevent fraud or security issues</li>
              <li>Respond to emergency situations</li>
            </ul>

            <p className="mt-3">
              <strong>We do not sell your personal information to third parties.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication systems</li>
              <li>Regular security audits</li>
              <li>Access controls and monitoring</li>
              <li>Industry-standard database security practices</li>
            </ul>
            <p className="mt-3">
              However, no method of transmission over the internet is 100% secure, and we cannot guarantee 
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Privacy Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Download your data in a portable format</li>
              <li><strong>Opt-out:</strong> Disable push notifications and marketing communications</li>
              <li><strong>Withdraw consent:</strong> Revoke consent for data processing where applicable</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us through the app settings or support channels.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide 
              the Service. After account deletion:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Most personal data is deleted within 30 days</li>
              <li>Some data may be retained for legal or operational purposes</li>
              <li>Anonymized analytics data may be retained indefinitely</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p>
              The Service is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13. If we become aware of such collection, we will 
              delete the information immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure 
              appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Cookies and Tracking</h2>
            <p>
              We use local storage and similar technologies to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain your session and authentication</li>
              <li>Store your preferences and settings</li>
              <li>Remember your progress and data</li>
              <li>Analyze usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services. We are not responsible for 
              the privacy practices of these third parties. We encourage you to read their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes 
              via email or in-app notification. Continued use of the Service after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us 
              through the support channels provided in the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. GDPR Compliance (EU Users)</h2>
            <p>
              If you are located in the European Economic Area (EEA), you have additional rights under GDPR:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to restrict processing</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
            <p className="mt-3">
              Our legal basis for processing includes consent, contract performance, and legitimate interests.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
