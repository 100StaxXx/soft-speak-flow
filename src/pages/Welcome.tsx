import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import type { StaticBackgroundAsset } from "@/assets/backgrounds";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";

const createLandingBackdrop = (src: string, src2x = src): StaticBackgroundAsset => ({
  src,
  src2x,
});

const landingBackdrops = {
  companion: createLandingBackdrop("/landing-backdrops/companion.jpg", "/landing-backdrops/companion@2x.jpg"),
  guide: createLandingBackdrop("/landing-backdrops/guide.jpg", "/landing-backdrops/guide@2x.jpg"),
  profile: createLandingBackdrop("/landing-backdrops/profile.jpg", "/landing-backdrops/profile@2x.jpg"),
  quests: createLandingBackdrop("/landing-backdrops/quests.jpg", "/landing-backdrops/quests@2x.jpg"),
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
  <section id={id} className={`relative isolate min-h-[100svh] snap-start overflow-hidden ${className}`}>
    <StaticBackgroundImage
      background={background}
      className="absolute inset-0 -z-20 h-full w-full object-cover pointer-events-none select-none"
      loading={loading}
      objectPosition={imagePosition}
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,12,0.56)_0%,rgba(3,7,12,0.22)_42%,rgba(3,7,12,0.9)_100%),linear-gradient(90deg,rgba(3,7,12,0.82)_0%,rgba(3,7,12,0.24)_54%,rgba(3,7,12,0.68)_100%)]" />
    <div className={`relative mx-auto flex min-h-[100svh] w-full max-w-6xl px-5 ${contentClassName}`}>
      {children}
    </div>
  </section>
);

const Welcome = () => {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      getAuthRedirectPath(user.id, {
        email: user.email ?? null,
      }).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [user, loading, navigate]);

  return (
    <div className="h-[100svh] overflow-hidden bg-[#05080d] text-white">
      <main
        data-landing-scroll
        className="h-full snap-y snap-proximity overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:snap-mandatory"
      >
        <LandscapeSection
          id="start"
          background={landingBackdrops.quests}
          contentClassName="items-center justify-center pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)]"
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
              Start your quest
            </p>
            <h1 className="text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
              Cosmiq Quest
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-7 text-white/84 sm:text-2xl sm:leading-8">
              A cinematic habit app for building better days like a mythic journey.
            </p>

            <div className="pointer-events-auto mx-auto mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/auth?mode=signup"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 border border-cyan-100/70 bg-cyan-100 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white sm:max-w-[16rem] sm:flex-1"
              >
                <UserPlus className="h-4 w-4" />
                Register
              </a>
              <a
                href="/auth"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 border border-white/24 bg-black/28 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white/48 hover:bg-white/12 sm:max-w-[16rem] sm:flex-1"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </a>
            </div>
          </motion.div>
        </LandscapeSection>

        <LandscapeSection
          id="features"
          background={landingBackdrops.guide}
          contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+3.25rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)] sm:pb-16"
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
          contentClassName="flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-[calc(env(safe-area-inset-top,0px)+2rem)] sm:pb-14"
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
