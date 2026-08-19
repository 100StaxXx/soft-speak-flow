import { useEffect } from "react";
import { ArrowDown, BookOpen, CheckCircle2, Leaf, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { PRODUCT } from "@/config/product";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";

const featureGroups = [
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
] as const;

export default function Welcome() {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      getAuthRedirectPath(user.id, { email: user.email ?? null }).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [loading, navigate, user]);

  return (
    <div className="h-screen min-h-[100svh] overflow-hidden bg-[#f4efe3] text-[#203124]">
      <main className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <section className="daily-way-welcome-hero relative isolate flex h-screen min-h-[100svh] snap-start snap-always items-center overflow-hidden px-5">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_18%,rgba(195,162,93,0.2),transparent_34%),radial-gradient(circle_at_18%_78%,rgba(73,111,76,0.18),transparent_38%),linear-gradient(145deg,#f7f1e5_0%,#edf0e4_54%,#dfe8db_100%)]" />
          <div className="absolute -right-24 bottom-[-8rem] -z-10 h-[34rem] w-[34rem] rounded-full border border-[#496f4c]/15" />
          <div className="absolute -right-8 bottom-[-5rem] -z-10 h-[26rem] w-[26rem] rounded-full border border-[#496f4c]/15" />

          <motion.div
            initial={prefersReducedMotion ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
            className="mx-auto w-full max-w-6xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#496f4c]">A Christian daily companion</p>
            <h1 className="mt-5 max-w-4xl font-serif text-6xl leading-[0.92] tracking-[-0.035em] sm:text-7xl lg:text-8xl">
              {PRODUCT.name}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-[#3f4d41] sm:text-2xl sm:leading-9">
              {PRODUCT.tagline} Scripture, prayer, reflection, and faithful action for the day you actually have.
            </p>

            <div className="mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              <a
                href="/auth?mode=signup"
                className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#2f5938] px-6 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition hover:bg-[#24482d]"
              >
                <UserPlus className="h-4 w-4" />
                Begin
              </a>
              <a
                href="/auth"
                className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-[#2f5938]/25 bg-white/55 px-6 text-sm font-semibold uppercase tracking-[0.14em] text-[#294b31] backdrop-blur transition hover:bg-white/85"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </a>
            </div>

            <a href="#daily-practice" className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-[#496f4c]">
              See the daily practice <ArrowDown className="h-4 w-4" />
            </a>
          </motion.div>
        </section>

        <section id="daily-practice" className="relative flex h-screen min-h-[100svh] snap-start snap-always items-end overflow-hidden bg-[#203124] px-5 pb-14 pt-24 text-[#f8f4e8] sm:pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(183,151,80,0.18),transparent_34%),linear-gradient(180deg,transparent,rgba(0,0,0,0.2))]" />
          <motion.div
            initial={prefersReducedMotion ? false : { y: 16, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: false, amount: 0.55 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            className="relative mx-auto w-full max-w-6xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d7bd7b]">A practice for ordinary life</p>
            <h2 className="mt-4 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">
              Receive the day. Practice what matters. Return with grace.
            </h2>
            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              {featureGroups.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-sm">
                    <Icon className="h-5 w-5 text-[#d7bd7b]" />
                    <h3 className="mt-4 font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/[0.68]">{feature.text}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </section>

        <section className="relative flex h-screen min-h-[100svh] snap-start snap-always items-end overflow-hidden bg-[#e9e4d7] px-5 pb-10 pt-24 text-[#203124] sm:pb-14">
          <div className="mx-auto w-full max-w-6xl">
            <ShieldCheck className="h-8 w-8 text-[#496f4c]" />
            <h2 className="mt-5 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">Guidance without pretending to speak for God.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4d584f]">
              Graceward supports daily reflection and practice. It does not replace Scripture, prayer, church, pastoral care, therapy, or medical help. AI-generated reflections are clearly identified and never presented as divine revelation.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:w-fit sm:flex-row">
              <a href="/auth?mode=signup" className="inline-flex h-13 items-center justify-center rounded-full bg-[#2f5938] px-7 py-4 text-sm font-semibold text-white">
                Begin today
              </a>
              <a href="/auth" className="inline-flex h-13 items-center justify-center rounded-full border border-[#2f5938]/25 px-7 py-4 text-sm font-semibold text-[#294b31]">
                Sign in
              </a>
            </div>

            <footer className="mt-12 flex flex-col gap-3 border-t border-[#203124]/15 pt-5 text-sm text-[#58645a] sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 {PRODUCT.legalEntity} · {PRODUCT.name}</p>
              <div className="flex gap-5"><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
