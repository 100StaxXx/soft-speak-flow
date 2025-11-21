import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
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

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: November 21, 2025</p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this mentorship and personal development application ("the Service"), 
              you accept and agree to be bound by the terms and provisions of this agreement. If you do not 
              agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              The Service provides personal development tools including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI-powered mentorship and guidance</li>
              <li>Daily motivational content (pep talks, quotes, missions)</li>
              <li>Habit tracking and progress monitoring</li>
              <li>Personal companion system for growth tracking</li>
              <li>Reflection and journaling tools</li>
              <li>Premium content and features (subscription-based)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p>
              To access certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
              <li>Be at least 13 years of age (or the age of majority in your jurisdiction)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. User Content and Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload harmful, offensive, or illegal content</li>
              <li>Impersonate others or provide false information</li>
              <li>Violate any laws or regulations</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Use the Service for commercial purposes without authorization</li>
              <li>Share or distribute AI-generated content without proper attribution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Premium Subscriptions</h2>
            <p>
              Premium features require a paid subscription. By subscribing, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pay the applicable subscription fees</li>
              <li>Automatic renewal unless cancelled before the renewal date</li>
              <li>No refunds for partial subscription periods</li>
              <li>Subscription terms may change with 30 days notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
            <p>
              All content provided through the Service, including text, graphics, logos, audio, and software, 
              is the property of the Service or its licensors and is protected by copyright and other 
              intellectual property laws. You retain ownership of your personal content (reflections, notes) 
              but grant us a license to use it to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. AI-Generated Content Disclaimer</h2>
            <p>
              The Service uses artificial intelligence to generate personalized content. While we strive for 
              accuracy and helpfulness:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI-generated content is for informational and motivational purposes only</li>
              <li>It should not replace professional medical, psychological, or legal advice</li>
              <li>We do not guarantee the accuracy or suitability of AI-generated content</li>
              <li>You use AI-generated content at your own discretion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Medical Disclaimer</h2>
            <p>
              The Service is not a substitute for professional medical advice, diagnosis, or treatment. 
              If you are experiencing mental health issues or crisis, please contact a qualified healthcare 
              provider or emergency services immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, the Service and its operators shall not be liable for 
              any indirect, incidental, special, consequential, or punitive damages resulting from your use 
              of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these 
              Terms or for any other reason at our discretion. You may terminate your account at any time 
              through the settings page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Continued use of the Service after changes constitutes 
              acceptance of the modified Terms. We will notify users of significant changes via email or 
              in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
              in which the Service operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us through the support channels provided in 
              the application.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
