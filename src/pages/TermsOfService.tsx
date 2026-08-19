import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCT } from "@/config/product";

const sections = [
  ["1. Agreement", `These Terms govern your use of ${PRODUCT.name}, a service operated by ${PRODUCT.legalEntity}. By using the service, you agree to these Terms and the Privacy Policy. You must be at least 13, or the minimum digital-consent age where you live, and able to form a binding agreement.`],
  ["2. What the service is", PRODUCT.mode === "christian"
    ? `${PRODUCT.name} provides Christian reflection, Scripture reading, prayer prompts, ready-made daily practices, reminders, and progress tools. It is a personal-support product—not a church, clergy relationship, sacrament, counseling service, medical service, or emergency service.`
    : `${PRODUCT.name} provides planning, focus, reflection, habit, companion-progression, reminder, and personal-growth tools. It is a personal-support product—not a counseling, medical, financial, legal, or emergency service.`],
  [PRODUCT.mode === "christian" ? "3. Scripture and AI-generated material" : "3. AI-generated material", PRODUCT.mode === "christian"
    ? "Reviewed Scripture excerpts identify their translation. Other reflections, prayers, practices, and responses may be generated or assisted by AI and can be incomplete or wrong. AI output is not divine revelation and does not speak for God. Verify important theological questions in Scripture and with a trusted pastor or qualified leader in your tradition."
    : "Plans, reflections, Guide responses, companion narratives, and other material may be generated or assisted by AI and can be incomplete or wrong. Review suggestions before acting on them and do not rely on AI output as professional advice."],
  ["4. Health, safety, and crisis limits", "Do not rely on the service for diagnosis, treatment, crisis response, abuse intervention, or decisions that could seriously affect health, safety, finances, or legal rights. Contact appropriate professionals or local emergency services when needed. In the U.S. and Canada, call or text 988 for suicide and crisis support."],
  ["5. Your account", "You are responsible for accurate account information, keeping credentials secure, and activity under your account. Notify us if you suspect unauthorized access. You may delete your account and saved app data from Account & settings."],
  ["6. Acceptable use", "Do not misuse the service, attempt unauthorized access, disrupt its operation, upload unlawful or infringing material, harass others, reverse engineer protected portions, or use automated means beyond documented interfaces. You retain rights in material you submit and grant us the limited rights needed to process it and operate the service."],
  ["7. Subscriptions", "If paid features are offered, prices and renewal terms are shown before purchase. App-store purchases are billed and managed by the applicable store. Cancel through that store before renewal. Refund rights depend on store rules and applicable law."],
  ["8. Availability and changes", "We may change, suspend, or discontinue features; correct errors; or limit access to protect users and the service. We do not promise uninterrupted or error-free operation. Material changes to these Terms will be communicated as required by law."],
  ["9. Intellectual property", `${PRODUCT.name}, its original design, software, and non-user content are owned by ${PRODUCT.legalEntity} or its licensors.${PRODUCT.mode === "christian" ? " Bible translations and" : ""} Third-party material remains subject to its respective rights and notices.`],
  ["10. Disclaimers and liability", "To the extent permitted by law, the service is provided “as is” and “as available,” without implied warranties. We are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service. These limits do not exclude rights or liabilities that law does not allow us to exclude."],
  ["11. Governing law", "These Terms are governed by the laws of New Mexico, USA, without regard to conflict-of-law rules, except where consumer-protection law in your location requires otherwise."],
] as const;

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="daily-way-page min-h-screen p-4 pb-safe pt-safe text-foreground sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Card className="mt-4 border-border/70 bg-card/90 p-5 sm:p-8">
          <header className="border-b border-border/60 pb-6">
            <div className="flex items-center gap-3"><Shield className="h-7 w-7 text-primary" /><h1 className="text-3xl font-semibold">Terms of service</h1></div>
            <p className="mt-3 text-sm text-muted-foreground">Effective August 7, 2026 · {PRODUCT.legalEntity}</p>
          </header>
          <div className="allow-text-select mt-7 space-y-7">
            {sections.map(([title, content]) => <section key={title}><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-muted-foreground">{content}</p></section>)}
            <section><h2 className="text-lg font-semibold">12. Contact</h2><p className="mt-2 leading-7 text-muted-foreground">Questions: <a className="text-primary underline underline-offset-4" href={`mailto:${PRODUCT.supportEmail}`}>{PRODUCT.supportEmail}</a>. {PRODUCT.legalEntity}, New Mexico, USA.</p></section>
          </div>
        </Card>
      </div>
    </div>
  );
}
