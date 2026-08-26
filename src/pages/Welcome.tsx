import { useEffect, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Heart,
  Leaf,
  LogIn,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sunrise,
  UserPlus,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import type { StaticBackgroundAsset } from "@/assets/backgrounds";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { PRODUCT, type ProductMode } from "@/config/product";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";
import { getAuthUserAccountEmail } from "@/utils/authUser";

export const getWelcomeProductContent = (mode: ProductMode) =>
  mode === "cosmiq"
    ? {
        eyebrow: "A living companion for meaningful momentum",
        heroCopy:
          "Turn intention into meaningful momentum with a companion that plans, focuses, and evolves through the story you create.",
        sectionEyebrow: "A story shaped by what you do",
        sectionTitle:
          "Set the intention. Take the action. Watch your companion become more.",
        finalTitle:
          "Every evolution should feel earned and unmistakably yours.",
        finalCopy:
          "Cosmiq remembers your choices, milestones, and companion history. Future forms are generated privately in the background and revealed as full cinematic moments when you earn them.",
        sectionLink: "See how it evolves",
        primaryAction: "Begin your story",
        featureGroups: [
          {
            icon: BookOpen,
            title: "A living history",
            text: "Your companion carries forward the traits, relics, memories, and visual identity shaped by your journey.",
          },
          {
            icon: CheckCircle2,
            title: "Cinematic evolution",
            text: "Every earned form arrives as a personalized portrait and full transition film with sound.",
          },
          {
            icon: Leaf,
            title: "Action with consequence",
            text: "Focus, Hunt, and Forge moments turn meaningful action into scenes, rewards, and lasting mythology.",
          },
        ],
      }
    : {
        eyebrow: "A Christian daily companion",
        heroCopy:
          "Grow in faith, one day at a time. Scripture, prayer, reflection, and faithful action for the day you actually have.",
        sectionEyebrow: "A practice for ordinary life",
        sectionTitle:
          "Receive the day. Practice what matters. Return with grace.",
        finalTitle: "Guidance without pretending to speak for God.",
        finalCopy:
          "Graceward supports daily reflection and practice. It does not replace Scripture, prayer, church, pastoral care, therapy, or medical help. AI-generated reflections are clearly identified and never presented as divine revelation.",
        sectionLink: "See the daily practice",
        primaryAction: "Begin today",
        featureGroups: [
          {
            icon: BookOpen,
            title: "Scripture & prayer",
            text: "Begin with reviewed Scripture, a grounded reflection, and a short prayer for the day in front of you.",
          },
          {
            icon: CheckCircle2,
            title: "Daily practice",
            text: "Receive one small, ready-made practice for faith, mind, body, relationships, service, stewardship, or rest.",
          },
          {
            icon: Leaf,
            title: "Faithful growth",
            text: "Build consistency without confusing a streak, score, or completed task with spiritual worth.",
          },
        ],
      };

const createLandingBackdrop = (
  src: string,
  src2x = src,
): StaticBackgroundAsset => ({
  src,
  src2x,
});

const cosmiqLandingBackdrops = {
  guide: createLandingBackdrop(
    "/landing-backdrops/guide.jpg",
    "/landing-backdrops/guide@2x.jpg",
  ),
  profile: createLandingBackdrop(
    "/landing-backdrops/profile.jpg",
    "/landing-backdrops/profile@2x.jpg",
  ),
  quests: createLandingBackdrop(
    "/landing-backdrops/quests.jpg",
    "/landing-backdrops/quests@2x.jpg",
  ),
};

interface CosmiqLandscapeSectionProps {
  background: StaticBackgroundAsset;
  children: ReactNode;
  contentClassName?: string;
  id?: string;
  imagePosition?: string;
  loading?: "eager" | "lazy";
}

const CosmiqLandscapeSection = ({
  background,
  children,
  contentClassName = "",
  id,
  imagePosition = "50% 50%",
  loading = "lazy",
}: CosmiqLandscapeSectionProps) => (
  <section
    id={id}
    className="relative isolate h-screen min-h-[100svh] snap-start snap-always overflow-hidden"
  >
    <StaticBackgroundImage
      background={background}
      className="pointer-events-none absolute inset-0 -z-20 h-full w-full select-none object-cover"
      loading={loading}
      objectPosition={imagePosition}
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,12,0.56)_0%,rgba(3,7,12,0.22)_42%,rgba(3,7,12,0.9)_100%),linear-gradient(90deg,rgba(3,7,12,0.82)_0%,rgba(3,7,12,0.24)_54%,rgba(3,7,12,0.68)_100%)]" />
    <div
      className={`relative mx-auto flex h-screen min-h-[100svh] w-full max-w-6xl px-5 ${contentClassName}`}
    >
      {children}
    </div>
  </section>
);

interface WelcomePresentationProps {
  mode: ProductMode;
}

export const WelcomePresentation = ({ mode }: WelcomePresentationProps) => {
  const prefersReducedMotion = useReducedMotion();
  const content = getWelcomeProductContent(mode);

  if (mode === "cosmiq") {
    return (
      <div
        data-product-mode="cosmiq"
        className="h-screen min-h-[100svh] overflow-hidden bg-[#05080d] text-white"
      >
        <main className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CosmiqLandscapeSection
            id="start"
            background={cosmiqLandingBackdrops.quests}
            contentClassName="items-center justify-center pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)]"
            imagePosition="50% 42%"
            loading="eager"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.42,
                ease: "easeOut",
              }}
              className="w-full max-w-2xl text-center"
            >
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
                {content.eyebrow}
              </p>
              <h1 className="text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
                Cosmiq
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-7 text-white/85 sm:text-2xl sm:leading-8">
                {content.heroCopy}
              </p>

              <div className="pointer-events-auto mx-auto mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/auth?mode=signup"
                  className="inline-flex h-14 flex-1 items-center justify-center gap-2 border border-cyan-100/70 bg-cyan-100 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white sm:max-w-[16rem]"
                >
                  <UserPlus className="h-4 w-4" />
                  Begin
                </a>
                <a
                  href="/auth"
                  className="inline-flex h-14 flex-1 items-center justify-center gap-2 border border-white/25 bg-black/30 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white/50 hover:bg-white/10 sm:max-w-[16rem]"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </a>
              </div>

              <a
                href="#cosmiq-story"
                className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-cyan-100/85"
              >
                {content.sectionLink} <ArrowDown className="h-4 w-4" />
              </a>
            </motion.div>
          </CosmiqLandscapeSection>

          <CosmiqLandscapeSection
            id="cosmiq-story"
            background={cosmiqLandingBackdrops.guide}
            contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+3.25rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)] sm:pb-16"
            imagePosition="50% 44%"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { y: 14, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ amount: 0.58, once: false }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.38,
                ease: "easeOut",
              }}
              className="relative z-20 w-full"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
                {content.sectionEyebrow}
              </p>
              <h2 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
                {content.sectionTitle}
              </h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {content.featureGroups.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="border border-white/15 bg-black/25 p-4 backdrop-blur-sm"
                    >
                      <Icon className="h-5 w-5 text-cyan-100" />
                      <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-white/75 sm:text-base">
                        {feature.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </CosmiqLandscapeSection>

          <CosmiqLandscapeSection
            background={cosmiqLandingBackdrops.profile}
            contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)] sm:pb-14"
            imagePosition="50% 55%"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { y: 14, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ amount: 0.58, once: false }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.38,
                ease: "easeOut",
              }}
              className="relative z-20 w-full max-w-3xl"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
                Built for return
              </p>
              <h2 className="text-4xl font-semibold leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
                {content.finalTitle}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-7 text-white/80 sm:text-2xl sm:leading-8">
                {content.finalCopy}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:w-fit sm:flex-row">
                <a
                  href="/auth?mode=signup"
                  className="inline-flex h-14 items-center justify-center bg-cyan-100 px-7 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950"
                >
                  {content.primaryAction}
                </a>
                <a
                  href="/auth"
                  className="inline-flex h-14 items-center justify-center border border-white/30 bg-black/25 px-7 text-sm font-semibold uppercase tracking-[0.16em] text-white backdrop-blur"
                >
                  Sign in
                </a>
              </div>
            </motion.div>

            <footer className="relative z-20 mt-10 flex w-full flex-col gap-3 border-t border-white/20 pt-5 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 {PRODUCT.legalEntity} · Cosmiq</p>
              <div className="flex gap-5">
                <a href="/terms" className="hover:text-white">
                  Terms
                </a>
                <a href="/privacy" className="hover:text-white">
                  Privacy
                </a>
              </div>
            </footer>
          </CosmiqLandscapeSection>
        </main>
      </div>
    );
  }

  return (
    <div
      data-product-mode="graceward"
      className="min-h-screen overflow-x-hidden bg-[#f4efe3] text-[#203124] selection:bg-[#c9d8bd]"
    >
      <header className="absolute inset-x-0 top-0 z-40 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="#top" className="font-serif text-2xl font-semibold tracking-[-0.025em]">Graceward</a>
          <nav className="flex items-center gap-2" aria-label="Welcome navigation">
            <a href="/auth" className="hidden rounded-full px-5 py-2.5 text-sm font-semibold text-[#294b31] transition hover:bg-white/60 sm:inline-flex">Sign in</a>
            <a href="/auth?mode=signup" className="inline-flex items-center gap-2 rounded-full bg-[#264d31] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(38,77,49,0.18)] transition hover:bg-[#1e4028]">
              Begin free <ArrowRight className="h-4 w-4" />
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section id="top" className="relative isolate min-h-[920px] overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:min-h-[860px]">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_16%,rgba(218,194,137,0.44),transparent_26%),radial-gradient(circle_at_12%_78%,rgba(120,152,112,0.25),transparent_34%),linear-gradient(145deg,#faf7ee_0%,#edf1e5_58%,#dce6d9_100%)]" />
          <div className="absolute left-[6%] top-28 -z-10 h-52 w-52 rounded-full border border-[#315b3a]/10" />
          <div className="absolute left-[10%] top-36 -z-10 h-36 w-36 rounded-full border border-[#315b3a]/10" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-8">
            <motion.div initial={prefersReducedMotion ? false : { y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: prefersReducedMotion ? 0 : 0.55 }} className="relative z-10 max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#315b3a]/15 bg-white/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#416649] backdrop-blur">
                <Sunrise className="h-3.5 w-3.5" /> {content.eyebrow}
              </p>
              <h1 className="mt-7 font-serif text-[3.8rem] leading-[0.88] tracking-[-0.055em] sm:text-8xl lg:text-[7.6rem]">Graceward</h1>
              <p className="mt-7 max-w-xl font-serif text-3xl leading-[1.1] tracking-[-0.025em] text-[#35513a] sm:text-4xl">Faith for the day you actually have.</p>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#526156] sm:text-xl">Scripture, prayer, reflection, and faithful action for the day you actually have. A gentle daily rhythm, with a companion who grows alongside you.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="/auth?mode=signup" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#264d31] px-7 text-sm font-bold text-white shadow-[0_18px_40px_rgba(38,77,49,0.2)] transition hover:-translate-y-0.5 hover:bg-[#1e4028]">
                  <UserPlus className="h-4 w-4" /> Start your daily rhythm
                </a>
                <a href="#daily-practice" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#315b3a]/20 bg-white/60 px-7 text-sm font-bold text-[#294b31] backdrop-blur transition hover:bg-white">
                  See how it works <ArrowDown className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#617065]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#557d59]" /> Start free</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#557d59]" /> Built for iPhone</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#557d59]" /> Theologically bounded AI</span>
              </div>
            </motion.div>

            <motion.div initial={prefersReducedMotion ? false : { scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: prefersReducedMotion ? 0 : 0.65, delay: 0.08 }} className="relative mx-auto w-full max-w-3xl lg:translate-x-8">
              <div className="absolute -inset-10 -z-10 rounded-full bg-[#e2c47a]/20 blur-3xl" />
              <div className="relative ml-auto w-[92%] overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/55 p-2 shadow-[0_40px_100px_rgba(45,65,48,0.2)] backdrop-blur sm:w-[88%] sm:rounded-[3rem] sm:p-3">
                <img src="/marketing/graceward/today-screen.jpg" alt="Graceward Today screen with Scripture and daily formation practices" className="aspect-[780/989] w-full rounded-[1.8rem] object-cover sm:rounded-[2.4rem]" />
              </div>
              <motion.div animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-10 -left-2 w-[38%] min-w-36 overflow-hidden rounded-[2rem] border-[6px] border-[#f8f5ec] bg-[#f8f5ec] shadow-[0_28px_70px_rgba(35,60,41,0.3)] sm:-left-10 sm:w-[34%]">
                <img src="/graceward-motion/v1/lion/light/mind-1.jpg" alt="A Graceward lion companion beside an open Bible" className="aspect-square w-full object-cover" />
                <div className="bg-[#f8f5ec] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-[#46644b]">Your companion grows too</div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-[#315b3a]/10 bg-[#faf8f1] px-5 py-7 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="font-serif text-2xl text-[#2f4935]">A daily rule of life, made gentle.</p>
            <p className="max-w-xl text-sm leading-6 text-[#677269]">No shame loops. No spiritual scorekeeping. Just a thoughtful way to receive the day and take the next faithful step.</p>
          </div>
        </section>

        <section id="daily-practice" className="relative overflow-hidden bg-[#203124] px-5 py-24 text-[#f8f4e8] sm:px-8 sm:py-32">
          <div className="absolute right-[-10rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full border border-[#d7bd7b]/10" />
          <div className="mx-auto max-w-7xl">
            <div className="grid items-end gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#d7bd7b]">{content.sectionEyebrow}</p>
                <h2 className="mt-5 max-w-xl font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-7xl">Receive the day. Practice what matters. Return with grace.</h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-white/65 lg:ml-auto">Every morning begins with Scripture and a grounded reflection. GraceWard then turns one shared theme into three small formation practices for mind, body, and soul.</p>
            </div>
            <div className="mt-16 grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-3">
              {[
                { number: "01", icon: BookOpen, title: "Receive", text: "Start with reviewed Scripture, a short reflection, and prayer for the day in front of you." },
                { number: "02", icon: Heart, title: "Practice", text: "Move through three realistic practices with your companion: mind, body, and soul." },
                { number: "03", icon: Moon, title: "Notice", text: "Return in the evening to reflect honestly, without turning faithfulness into a score." },
              ].map((step) => {
                const Icon = step.icon;
                return <article key={step.title} className="relative bg-[#203124] p-7 sm:p-9">
                  <span className="text-xs font-bold tracking-[0.2em] text-white/35">{step.number}</span>
                  <Icon className="mt-12 h-7 w-7 text-[#d7bd7b]" />
                  <h3 className="mt-5 font-serif text-4xl">{step.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/60 sm:text-base">{step.text}</p>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#efe9dc] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-24">
            <div className="relative order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-4">
                <img src="/graceward-motion/v1/lion/light/mind-1.jpg" alt="Lion companion practicing Scripture" className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl" />
                <img src="/graceward-motion/v1/dove/nature/soul-2.jpg" alt="Dove companion in a peaceful garden" className="mt-12 aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl" />
              </div>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-[#fffdf7]/90 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#37563d] shadow-lg backdrop-blur">Made personal through practice</div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#55765b]">A companion with purpose</p>
              <h2 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-7xl">Grow together, without confusing growth with worth.</h2>
              <p className="mt-7 text-lg leading-8 text-[#59645b]">Choose a companion rooted in biblical imagery. It remembers your shared story, responds to the day, and changes as your daily formation becomes a lived rhythm.</p>
              <div className="mt-9 space-y-5">
                {[
                  [Sparkles, "Living presence", "Tap, talk, and receive small moments of encouragement throughout the day."],
                  [CalendarDays, "A shared daily thread", "Your Scripture theme carries naturally into each practice and evening reflection."],
                  [Leaf, "Earned evolution", "New forms mark consistency and care, never spiritual rank or divine favor."],
                ].map(([Icon, title, text]) => <div key={String(title)} className="flex gap-4 border-t border-[#294b31]/12 pt-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dbe4d3] text-[#365b3f]"><Icon className="h-5 w-5" /></span>
                  <div><h3 className="font-semibold">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-[#667168]">{String(text)}</p></div>
                </div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f8f5ec] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:gap-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#55765b]">A guide that remembers</p>
              <h2 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-7xl">Encouragement that meets you in context.</h2>
              <p className="mt-7 text-lg leading-8 text-[#59645b]">Talk with your Guide about what you are carrying. Ask questions, reflect on the day, or hear a personal word of encouragement connected to today’s Scripture.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Daily encouragement", "Voice conversations", "Prayerful reflection", "Weekly reviews"].map((item) => <span key={item} className="rounded-full border border-[#315b3a]/15 bg-white px-4 py-2 text-sm font-semibold text-[#49634e]">{item}</span>)}
              </div>
              <a href="/auth?mode=signup" className="mt-9 inline-flex items-center gap-2 text-sm font-bold text-[#2d5937]">Meet your Guide <ArrowRight className="h-4 w-4" /></a>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-[2.5rem] border border-[#315b3a]/10 bg-white p-2 shadow-[0_35px_90px_rgba(45,65,48,0.16)] sm:p-3">
                <img src="/marketing/graceward/guide-screen.jpg" alt="Graceward Guide screen with a daily shared thread and conversation" className="aspect-[780/989] w-full rounded-[2rem] object-cover" />
              </div>
              <div className="absolute -bottom-6 -left-3 max-w-[16rem] rounded-[1.5rem] bg-[#284d31] p-5 text-white shadow-xl sm:-left-8">
                <MessageCircle className="h-5 w-5 text-[#d7bd7b]" />
                <p className="mt-3 font-serif text-xl leading-tight">“What would faithfulness look like in this moment?”</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#dfe8da] px-5 py-24 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 rounded-[2.5rem] border border-[#315b3a]/12 bg-[#edf2e8] p-7 shadow-[0_30px_80px_rgba(48,75,52,0.1)] sm:p-12 lg:grid-cols-[0.7fr_1.3fr] lg:p-16">
            <div>
              <ShieldCheck className="h-10 w-10 text-[#416a49]" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-[#55765b]">A clear boundary</p>
            </div>
            <div>
              <h2 className="max-w-3xl font-serif text-4xl leading-[1.02] tracking-[-0.025em] sm:text-6xl">{content.finalTitle}</h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[#59665b]">{content.finalCopy}</p>
              <p className="mt-5 text-sm font-semibold text-[#426047]">AI reflections are identified. Scripture sources are cited. Your spiritual worth is never gamified.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#173021] px-5 py-24 text-white sm:px-8 sm:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(215,189,123,0.16),transparent_28%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d7bd7b]">Begin where you are</p>
            <h2 className="mt-6 font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-7xl">A little more rooted. A little more present. One day at a time.</h2>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/65">Your first Scripture, prayer, and companion are waiting. Start a daily rhythm that leaves room for real life and real grace.</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/auth?mode=signup" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#e1c984] px-8 text-sm font-bold text-[#173021] transition hover:bg-[#ecd99f]">{content.primaryAction} <ArrowRight className="h-4 w-4" /></a>
              <a href="/auth" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/20 px-8 text-sm font-bold text-white transition hover:bg-white/10"><LogIn className="h-4 w-4" /> Sign in</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#102519] px-5 py-8 text-sm text-white/55 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {PRODUCT.legalEntity} · Graceward</p>
          <div className="flex gap-6"><a href="/terms" className="hover:text-white">Terms</a><a href="/privacy" className="hover:text-white">Privacy</a></div>
        </div>
      </footer>
    </div>
  );
};

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      getAuthRedirectPath(user.id, {
        email: getAuthUserAccountEmail(user),
      }).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [loading, navigate, user]);

  return <WelcomePresentation mode={PRODUCT.mode} />;
}
