import { ArrowLeft, BookHeart, BookOpen, Brain, Bell, HeartHandshake, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCT } from "@/config/product";

const topics = [
  {
    id: "scripture",
    icon: BookOpen,
    title: "Where does the Scripture text come from?",
    answer: "Graceward’s first release uses reviewed excerpts from the public-domain World English Bible (WEB). Passage text and references come from curated app records—not from a language model’s memory. The translation is always shown beside the reference.",
  },
  {
    id: "guidance",
    icon: Brain,
    title: "Is the reflection written by AI?",
    answer: "Some reflection responses may be AI-generated. When AI is used, it is an assistant for reflection—not a pastor, spiritual authority, or source of revelation. It must not claim to speak for God, tell you God’s private will, invent Scripture, pronounce forgiveness, or judge your salvation.",
  },
  {
    id: "church",
    icon: HeartHandshake,
    title: "Does Graceward replace church or pastoral care?",
    answer: "No. Graceward is a personal reflection and daily-practice tool. It cannot replace Scripture in context, prayer, Christian community, the sacraments or practices of your tradition, qualified pastoral care, therapy, medical care, or emergency help.",
  },
  {
    id: "reminders",
    icon: Bell,
    title: "How do reminders work?",
    answer: "Graceward can deliver one morning package with Scripture, Guide encouragement, and a ready-made activity. An Evening Reflection invitation is optional and appears after 6 PM in your local timezone. You can turn either reminder off at any time.",
  },
  {
    id: "encouragement-history",
    icon: BookHeart,
    title: "Does Graceward remember daily encouragements?",
    answer: "Yes. Graceward automatically saves each daily encouragement you receive and privately records when playback starts, listening progress, when at least 80% has been heard, and replays. There is no setup and this is not a spiritual score. Open Past encouragements from Today or Account & settings to revisit them. The history is removed when you delete your account.",
  },
  {
    id: "companion-memory",
    icon: Brain,
    title: "What does Companion memory remember?",
    answer: "When Companion memory is on, Graceward may use durable details you choose to share in Companion chat and recent daily patterns to make later replies feel connected. It does not turn your spiritual life into a score. Open Account & settings to turn memory off or clear chat-learned personal details without deleting conversations or earned progress.",
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Are reflections private?",
    answer: "Reflections and account data are stored to provide the service. Do not enter information you would not want processed by our hosting and AI service providers. We do not sell personal data. See the Privacy Policy for data categories, processors, retention, and your choices.",
  },
  {
    id: "delete",
    icon: Trash2,
    title: "How do I delete my account?",
    answer: "Open Account & settings, choose Delete account and data, then type “delete” to confirm. This permanently removes your account and saved app data and cannot be undone.",
  },
] as const;

export default function HelpCenter() {
  const navigate = useNavigate();

  return (
    <PageTransition mode="instant">
      <div className="daily-way-page min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
          <header className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{PRODUCT.name}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Help center</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Clear answers about Scripture, AI guidance, reminders, and your data.</p>
            </div>
          </header>

          <main className="mt-8 space-y-4">
            {topics.map(({ id, icon: Icon, title, answer }) => (
              <Card id={id} key={id} className="scroll-mt-6 border-border/70 bg-card/85 p-5 backdrop-blur-xl sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></span>
                  <div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{answer}</p></div>
                </div>
              </Card>
            ))}
          </main>

          <section className="mt-8 rounded-[24px] border border-primary/15 bg-primary/[0.06] p-5">
            <h2 className="font-semibold">Need a person?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Email <a className="font-medium text-primary underline underline-offset-4" href={`mailto:${PRODUCT.supportEmail}`}>{PRODUCT.supportEmail}</a>. If you may be in immediate danger or could harm yourself or someone else, contact local emergency services now. In the U.S. and Canada, call or text 988.</p>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
