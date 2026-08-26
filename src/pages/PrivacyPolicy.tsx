import { ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCT } from "@/config/product";

const sections = [
  ["1. Scope", `This policy explains how ${PRODUCT.legalEntity} collects, uses, and protects information when you use ${PRODUCT.name}.`],
  ["2. Information you provide", PRODUCT.mode === "christian"
    ? "We may collect account details such as email; onboarding preferences; completed daily practices; check-ins, prayers or reflections you choose to save; support messages; profile media; and purchase or subscription status. Please treat spiritual reflections as sensitive and share only what you are comfortable having processed by the service."
    : "We may collect account details such as email; onboarding and Guide preferences; plans, goals, actions, habits, check-ins, reflections, companion choices, and notes you choose to save; support messages; profile media; and purchase or subscription status."],
  ["3. Information collected automatically", "We may collect device and app version, operating system, timezone, notification token and delivery status, authentication and security events, feature usage, crash and performance diagnostics, and approximate network information such as IP address. For daily encouragements, feature usage can include when an encouragement is received or opened, whether playback starts, playback milestones, whether it is heard substantially, replay count, and the last interaction time. Limited first-party journey events may record that a focus was selected or a connected practice was completed, but their event properties exclude user-authored message and reflection text."],
  ["4. How we use information", PRODUCT.mode === "christian"
    ? "We use information to authenticate users; store and sync completed daily practices; maintain your private daily encouragement history so you can revisit what you received and heard; deliver reminders; generate requested reflections; provide support; process subscriptions; secure, debug, and improve the service; comply with law; and enforce our Terms. We do not use completion or listening data to assess a person’s holiness, worth, salvation, or God’s favor."
    : "We use information to authenticate users; store and sync plans, actions, habits, reflections, and companion progress; personalize requested Guide and companion experiences; deliver reminders; provide support; process subscriptions; secure, debug, and improve the service; comply with law; and enforce our Terms."],
  ["5. AI processing", "When you request an AI-assisted reflection or plan, the relevant prompt and context may be sent to an AI service provider, including OpenAI. If Companion memory is enabled, recent daily patterns and durable details you choose to share in Companion chat may personalize later Companion replies. You can turn memory off or clear chat-learned personal memory in Account & settings without deleting conversations or earned progress. Do not submit confidential pastoral communications, health records, or information about another person without permission. AI responses are subject to safety rules but may still be wrong."],
  ["6. Service providers and disclosures", "We use providers that support hosting, database and authentication services (including Supabase), AI processing (including OpenAI), app distribution and purchase processing, calendar or sign-in integrations you choose, notifications, and operational diagnostics. They process data for us under their terms. We may also disclose information when required by law, to protect safety and rights, or in a business transfer. We do not sell personal data."],
  [PRODUCT.mode === "christian" ? "7. Scripture content" : "7. Companion and progress content", PRODUCT.mode === "christian"
    ? "Daily Scripture excerpts are read from reviewed app records. Your reading activity and saved responses may be stored like other usage and reflection data. The app does not infer or certify your religious status or spiritual standing."
    : "Companion forms, progress, generated narratives, and earned media may be stored with your account so the experience can remain consistent across sessions and devices."],
  ["8. Retention and deletion", "We keep information while your account is active and as needed for the purposes above, legal obligations, security, dispute resolution, and backups. You can permanently delete your account and app data from Account & settings. Some limited records may remain when law, fraud prevention, transaction accounting, or backup rotation requires it."],
  ["9. Your choices", "You can update account preferences, turn Companion memory off, clear chat-learned personal memory, disable notifications in device settings, disconnect optional integrations, request access or correction, and delete your account. Depending on where you live, you may have additional rights to access, correct, erase, restrict, object, or receive a portable copy of personal data."],
  ["10. Security", "We use administrative, technical, and organizational safeguards designed to protect information. No internet service is completely secure, so we cannot guarantee absolute security. Contact us promptly if you believe your account is compromised."],
  ["11. Children", "The service is not directed to children under 13, and we do not knowingly collect their personal information. A higher minimum age may apply where required by local law. Contact us if you believe a child has provided information improperly."],
  ["12. International processing", "Information may be processed in the United States and other countries where our providers operate. Where required, we use appropriate safeguards for international transfers."],
  ["13. Changes", "We may update this policy as the product and law change. We will post the revised effective date and provide additional notice for material changes when required."],
] as const;

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="daily-way-page min-h-screen p-4 pb-safe pt-safe text-foreground sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Card className="mt-4 border-border/70 bg-card/90 p-5 sm:p-8">
          <header className="border-b border-border/60 pb-6">
            <div className="flex items-center gap-3"><Lock className="h-7 w-7 text-primary" /><h1 className="text-3xl font-semibold">Privacy policy</h1></div>
            <p className="mt-3 text-sm text-muted-foreground">Effective August 10, 2026 · {PRODUCT.legalEntity}</p>
          </header>
          <div className="allow-text-select mt-7 space-y-7">
            {sections.map(([title, content]) => <section key={title}><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-muted-foreground">{content}</p></section>)}
            <section><h2 className="text-lg font-semibold">14. Contact</h2><p className="mt-2 leading-7 text-muted-foreground">Privacy requests: <a className="text-primary underline underline-offset-4" href={`mailto:${PRODUCT.supportEmail}`}>{PRODUCT.supportEmail}</a>. {PRODUCT.legalEntity}, New Mexico, USA.</p></section>
          </div>
        </Card>
      </div>
    </div>
  );
}
