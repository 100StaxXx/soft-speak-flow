import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Mail, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import type { StaticBackgroundAsset } from "@/assets/backgrounds";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectPath } from "@/utils/authRedirect";

const createLandingBackdrop = (src: string, src2x = src): StaticBackgroundAsset => ({
  src,
  src2x,
});

const landingBackdrops = {
  companion: createLandingBackdrop("/landing-backdrops/companion.webp", "/landing-backdrops/companion@2x.webp"),
  guide: createLandingBackdrop("/landing-backdrops/guide.webp", "/landing-backdrops/guide@2x.webp"),
  profile: createLandingBackdrop("/landing-backdrops/profile.webp", "/landing-backdrops/profile@2x.webp"),
  quests: createLandingBackdrop("/landing-backdrops/quests.webp", "/landing-backdrops/quests@2x.webp"),
};

const featureGroups = [
  {
    title: "Quests",
    text: "Turn goals, habits, and responsibilities into a focused path for the day.",
  },
  {
    title: "Mentors",
    text: "Get a cleaner next step when motivation, planning, or reflection gets noisy.",
  },
  {
    title: "Companion",
    text: "Watch a personal myth grow around the consistency you are already building.",
  },
];

interface LandscapeSectionProps {
  background: StaticBackgroundAsset;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
  imagePosition?: string;
  loading?: "eager" | "lazy";
}

const LandscapeSection = ({
  background,
  children,
  className = "",
  contentClassName = "",
  id,
  imagePosition = "50% 50%",
  loading = "lazy",
}: LandscapeSectionProps) => (
  <section id={id} className={`relative isolate h-screen min-h-[100svh] snap-start snap-always overflow-hidden ${className}`}>
    <StaticBackgroundImage
      background={background}
      className="absolute inset-0 -z-20 h-full w-full object-cover pointer-events-none select-none"
      loading={loading}
      objectPosition={imagePosition}
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,12,0.56)_0%,rgba(3,7,12,0.22)_42%,rgba(3,7,12,0.9)_100%),linear-gradient(90deg,rgba(3,7,12,0.82)_0%,rgba(3,7,12,0.24)_54%,rgba(3,7,12,0.68)_100%)]" />
    <div className={`relative mx-auto flex h-screen min-h-[100svh] w-full max-w-6xl px-5 ${contentClassName}`}>
      {children}
    </div>
  </section>
);

const Welcome = () => {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && user) {
      getAuthRedirectPath(user.id, {
        email: user.email ?? null,
      }).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [user, loading, navigate]);

  const submitEarlyAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Enter your email to request access.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    if (website.trim()) {
      setStatus("success");
      setMessage("You are on the early access list. I will send the next opening your way.");
      setEmail("");
      setWebsite("");
      return;
    }

    const { error } = await supabase.rpc("record_early_access_signup", {
      p_email: normalizedEmail,
      p_source: window.location.pathname,
      p_referrer: document.referrer || null,
      p_user_agent: window.navigator.userAgent,
      p_request_metadata: {
        created_from: "landing_page",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message || "Something went sideways. Try again in a moment.");
      return;
    }

    setStatus("success");
    setMessage("You are on the early access list. I will send the next opening your way.");
    setEmail("");
    setWebsite("");
  };

  return (
    <div className="h-screen min-h-[100svh] overflow-hidden bg-[#05080d] text-white">
      <header className="pointer-events-none fixed left-0 right-0 top-0 z-30 px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/14 pb-4">
          <div className="flex items-center gap-3 text-white">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md"
            >
              <Sparkles className="h-4 w-4 text-cyan-100" />
            </span>
            <a href="/" className="pointer-events-auto text-sm font-semibold uppercase tracking-[0.24em]">
              Cosmiq
            </a>
          </div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-white/70 sm:block">
            Mythic habit quests
          </p>
        </div>
      </header>

      <main
        data-landing-scroll
        className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <LandscapeSection
          id="early-access"
          background={landingBackdrops.quests}
          contentClassName="items-center justify-center pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+6.5rem)]"
          imagePosition="50% 42%"
          loading="eager"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { y: 12, opacity: 1 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.72, once: false }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: "easeOut" }}
            className="w-full max-w-2xl text-center"
          >
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
              Early access
            </p>
            <h1 className="text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
              Cosmiq Quest
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-7 text-white/84 sm:text-2xl sm:leading-8">
              A cinematic habit app for building better days like a mythic journey.
            </p>

            <form
              onSubmit={submitEarlyAccess}
              className="pointer-events-auto mx-auto mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
            >
              <label className="sr-only" htmlFor="early-access-email">Email address</label>
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/52" />
                <input
                  id="early-access-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-14 w-full border border-white/22 bg-black/34 pl-12 pr-4 text-base text-white shadow-[0_20px_70px_rgba(0,0,0,0.25)] outline-none backdrop-blur-md transition placeholder:text-white/42 focus:border-cyan-200 focus:bg-black/44"
                  disabled={status === "submitting" || status === "success"}
                  required
                />
              </div>
              <label className="sr-only" htmlFor="early-access-website">Website</label>
              <input
                id="early-access-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className="hidden"
                aria-hidden="true"
              />
              <button
                type="submit"
                className="inline-flex h-14 items-center justify-center gap-2 border border-cyan-100/70 bg-cyan-100 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-72"
                disabled={status === "submitting" || status === "success"}
              >
                {status === "success" ? <Check className="h-4 w-4" /> : null}
                {status === "submitting" ? "Sending" : status === "success" ? "Requested" : "Request access"}
              </button>
            </form>
            {message ? (
              <p
                className={`mx-auto mt-4 max-w-xl text-sm leading-6 ${status === "error" ? "text-rose-100" : "text-cyan-50"}`}
                role={status === "error" ? "alert" : "status"}
              >
                {message}
              </p>
            ) : null}
          </motion.div>
        </LandscapeSection>

        <LandscapeSection
          id="features"
          background={landingBackdrops.guide}
          contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+3.25rem)] pt-[calc(env(safe-area-inset-top,0px)+6.5rem)] sm:pb-16"
          imagePosition="50% 44%"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { y: 12, opacity: 1 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.72, once: false }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: "easeOut" }}
            className="relative z-20 w-full"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
              What it is
            </p>
            <h2 className="max-w-3xl text-4xl font-semibold leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
              One place for quests, guidance, and momentum.
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {featureGroups.map((feature) => (
                <div key={feature.title} className="border border-white/16 bg-black/22 p-4 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/74 sm:text-base">
                    {feature.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </LandscapeSection>

        <LandscapeSection
          id="closing"
          background={landingBackdrops.profile}
          contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-[calc(env(safe-area-inset-top,0px)+6.5rem)] sm:pb-14"
          imagePosition="50% 55%"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { y: 12, opacity: 1 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ amount: 0.72, once: false }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: "easeOut" }}
            className="relative z-20 w-full max-w-3xl"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 sm:text-sm">
              Built for return
            </p>
            <h2 className="text-4xl font-semibold leading-[0.98] tracking-normal sm:text-6xl lg:text-7xl">
              The story is the system.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-7 text-white/82 sm:text-2xl sm:leading-8">
              Cosmiq is for people who want their routines to feel less like maintenance and more like a world they keep coming back to.
            </p>
          </motion.div>

          <footer className="relative z-20 mt-10 flex w-full flex-col gap-3 border-t border-white/18 pt-5 text-sm text-white/64 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Cosmiq</p>
            <div className="flex gap-5">
              <a href="/terms" className="hover:text-white">Terms</a>
              <a href="/privacy" className="hover:text-white">Privacy</a>
            </div>
          </footer>
        </LandscapeSection>
      </main>
    </div>
  );
};

export default Welcome;
