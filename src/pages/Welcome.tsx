import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, MoonStar, Sparkles, Telescope } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { PageLoader } from "@/components/PageLoader";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import type { StaticBackgroundAsset } from "@/assets/backgrounds";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectPath } from "@/utils/authRedirect";

const principles = [
  {
    title: "Quests give the day a shape",
    text: "Cosmiq turns goals, rituals, and responsibilities into small pieces of forward motion.",
  },
  {
    title: "Guidance keeps the tone human",
    text: "A personal guide helps you reflect, reset, and choose what deserves your attention next.",
  },
  {
    title: "Progress becomes visible",
    text: "XP, streaks, recaps, and companion growth make quiet consistency easier to recognize.",
  },
];

const rhythms = [
  "Begin with a focus for the day.",
  "Move through a short list of meaningful quests.",
  "Return for reflection when the day needs a reset.",
  "Watch your companion and story evolve with your effort.",
];

const createLandingBackdrop = (src: string): StaticBackgroundAsset => ({
  src,
  src2x: src,
});

const landingBackdrops = {
  campaigns: createLandingBackdrop(
    "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/wallpaper-catalog/campaigns/2026-05-11/rotate-2026-05-11-2026-05-11t11-05-03-078z/campaigns-forest-basin-storm-polished/e6a31687-c4b0-41f3-82d8-dfc29333b769.png",
  ),
  companion: createLandingBackdrop(
    "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/wallpaper-catalog/companion/2026-05-11/rotate-2026-05-11-2026-05-11t12-05-04-764z/companion-rooftop-garden-dawn-peace/71835e7c-8730-4e30-831b-0c4d880eb5ad.png",
  ),
  guide: createLandingBackdrop(
    "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/wallpaper-catalog/guide/2026-05-11/rotate-2026-05-11-2026-05-11t09-05-03-058z/guide-rooftop-study-silver-quiet/6a6e63b3-7132-48c7-9830-561eaff712be.png",
  ),
  profile: createLandingBackdrop(
    "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/wallpaper-catalog/profile/2026-05-11/rotate-2026-05-11-2026-05-11t13-05-02-781z/profile-desert-courtyard-slate-evening/26805edd-bfd8-45da-9029-d16efb60b4c8.png",
  ),
  quests: createLandingBackdrop(
    "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/wallpaper-catalog/quests/2026-05-11/rotate-2026-05-11-2026-05-11t10-05-02-962z/quests-coastal-switchbacks-cool-mist/a288151d-7c1b-4cd6-aaf1-fcf8009aa3cc.png",
  ),
};

interface LandscapeSectionProps {
  background: StaticBackgroundAsset;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  imagePosition?: string;
}

const LandscapeSection = ({
  background,
  children,
  className = "",
  contentClassName = "",
  imagePosition = "50% 50%",
}: LandscapeSectionProps) => (
  <section className={`relative isolate overflow-hidden ${className}`}>
    <StaticBackgroundImage
      background={background}
      className="absolute inset-0 -z-20 h-full w-full object-cover pointer-events-none select-none"
      objectPosition={imagePosition}
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,12,0.54)_0%,rgba(3,7,12,0.24)_42%,rgba(3,7,12,0.86)_100%),linear-gradient(90deg,rgba(3,7,12,0.76)_0%,rgba(3,7,12,0.18)_50%,rgba(3,7,12,0.64)_100%)]" />
    <div className={`relative mx-auto w-full max-w-6xl px-5 ${contentClassName}`}>
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

  if (loading) {
    return <PageLoader message="Preparing your journey..." />;
  }

  return (
    <div className="min-h-screen bg-[#05080d] text-white">
      <header className="fixed left-0 right-0 top-0 z-30 px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/14 pb-4">
          <a href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-cyan-100" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.24em]">
              Cosmiq
            </span>
          </a>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-white/70 sm:block">
            Habit quests and companion growth
          </p>
        </div>
      </header>

      <main>
        <LandscapeSection
          background={landingBackdrops.quests}
          className="min-h-[100svh]"
          contentClassName="flex min-h-[100svh] items-end pb-16 pt-[calc(env(safe-area-inset-top,0px)+7rem)] sm:pb-20"
          imagePosition="50% 40%"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.32 }}
            className="max-w-3xl"
          >
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">
              A cinematic habit companion
            </p>
            <h1 className="text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
              Cosmiq Quest
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/84 sm:text-xl">
              An atmospheric self-improvement app where everyday habits become quests, guidance feels personal, and progress unfolds like a living journey.
            </p>
          </motion.div>
        </LandscapeSection>

        <LandscapeSection
          background={landingBackdrops.guide}
          className="min-h-[82svh]"
          contentClassName="grid min-h-[82svh] items-center gap-10 py-20 lg:grid-cols-[0.85fr_1.15fr]"
          imagePosition="50% 44%"
        >
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
              What it is
            </p>
            <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
              A daily path through the noise.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            {principles.map((principle) => (
              <div key={principle.title} className="max-w-xl border-t border-white/18 pt-5">
                <h3 className="text-xl font-semibold">{principle.title}</h3>
                <p className="mt-3 text-base leading-7 text-white/78">{principle.text}</p>
              </div>
            ))}
          </div>
        </LandscapeSection>

        <LandscapeSection
          background={landingBackdrops.companion}
          className="min-h-[86svh]"
          contentClassName="flex min-h-[86svh] flex-col justify-center py-20"
          imagePosition="50% 50%"
        >
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-amber-100">
              The rhythm
            </p>
            <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Less dashboard. More journey.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {rhythms.map((rhythm, index) => (
              <div key={rhythm} className="flex gap-4 border-t border-white/18 pt-5">
                <span className="text-sm font-semibold text-cyan-100">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="max-w-sm text-lg leading-7 text-white/84">{rhythm}</p>
              </div>
            ))}
          </div>
        </LandscapeSection>

        <LandscapeSection
          background={landingBackdrops.campaigns}
          className="min-h-[86svh]"
          contentClassName="grid min-h-[86svh] items-end gap-10 py-20 md:grid-cols-[1fr_0.85fr]"
          imagePosition="50% 45%"
        >
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
              The world
            </p>
            <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Guides, companions, campaigns, and quiet momentum.
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/80">
              Cosmiq is built around the feeling that self-improvement should be less sterile and more alive: part planner, part story, part mirror.
            </p>
          </div>
          <div className="grid gap-5 text-white/82">
            <div className="border-t border-white/18 pt-5">
              <MoonStar className="mb-4 h-6 w-6 text-cyan-100" />
              <p className="text-base leading-7">
                Mentors frame the day with reflection and encouragement.
              </p>
            </div>
            <div className="border-t border-white/18 pt-5">
              <Compass className="mb-4 h-6 w-6 text-cyan-100" />
              <p className="text-base leading-7">
                Campaigns turn bigger goals into a sequence of reachable milestones.
              </p>
            </div>
            <div className="border-t border-white/18 pt-5">
              <Telescope className="mb-4 h-6 w-6 text-cyan-100" />
              <p className="text-base leading-7">
                Recaps help the journey feel remembered, not merely tracked.
              </p>
            </div>
          </div>
        </LandscapeSection>

        <LandscapeSection
          background={landingBackdrops.profile}
          className="min-h-[62svh]"
          contentClassName="flex min-h-[62svh] flex-col justify-end py-16"
          imagePosition="50% 55%"
        >
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
              Cosmiq Quest
            </p>
            <p className="text-3xl font-semibold leading-tight sm:text-5xl">
              A more imaginative way to stay with the person you are becoming.
            </p>
          </div>
        </LandscapeSection>
      </main>

      <footer className="bg-[#05080d] px-5 py-8 text-sm text-white/56">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Cosmiq. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
