import { memo, useCallback, type MouseEvent } from "react";
import { PawPrint, User, Compass, Inbox } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentorAvatar } from "@/components/MentorAvatar";
import { fetchCompanion, getCompanionQueryKey, useCompanion } from "@/hooks/useCompanion";
import { Badge } from "@/components/ui/badge";
import { getResolvedMentorId } from "@/utils/mentor";
import { haptics } from "@/utils/haptics";
import { CompanionNavPresence } from "@/components/companion/CompanionNavPresence";
import {
  fetchInboxCount,
  fetchInboxTasks,
  getInboxCountQueryKey,
  getInboxTasksQueryKey,
  useInboxCount,
} from "@/hooks/useInboxTasks";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motionTokens";
import {
  DAILY_TASKS_GC_TIME,
  DAILY_TASKS_STALE_TIME,
  fetchDailyTasks,
  getDailyTasksQueryKey,
} from "@/hooks/useTasksQuery";
import type { MainTabPath } from "@/utils/mainTabRefresh";

type PrefetchTarget = "mentor" | "inbox" | "journeys" | "companion";
const COMPANION_STALE_TIME_MS = 60 * 1000;
const COMPANION_GC_TIME_MS = 30 * 60 * 1000;
const MENTOR_STALE_TIME_MS = 10 * 60 * 1000;

const fetchSelectedMentorById = async (mentorId: string) => {
  const { data, error } = await supabase
    .from("mentors")
    .select("slug, name, primary_color")
    .eq("id", mentorId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const BottomNav = memo(() => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { capabilities } = useMotionProfile();
  const { companion, progressToNext } = useCompanion();
  const { inboxCount } = useInboxCount();
  const resolvedMentorId = getResolvedMentorId(profile);

  const prefetchMentorTab = useCallback(() => {
    if (!resolvedMentorId) return;

    void queryClient.prefetchQuery({
      queryKey: ["selected-mentor", resolvedMentorId],
      queryFn: () => fetchSelectedMentorById(resolvedMentorId),
      staleTime: MENTOR_STALE_TIME_MS,
    }).catch(() => undefined);
  }, [queryClient, resolvedMentorId]);

  const prefetchInboxTab = useCallback(() => {
    if (!user?.id) return;

    const inboxTasksPromise = queryClient.prefetchQuery({
      queryKey: getInboxTasksQueryKey(user.id),
      queryFn: () => fetchInboxTasks(user.id),
      staleTime: 30 * 1000,
      gcTime: 30 * 60 * 1000,
    });
    const inboxCountPromise = queryClient.prefetchQuery({
      queryKey: getInboxCountQueryKey(user.id),
      queryFn: () => fetchInboxCount(user.id),
      staleTime: 30 * 1000,
      gcTime: 30 * 60 * 1000,
    });

    void Promise.all([inboxTasksPromise, inboxCountPromise]).catch(() => undefined);
  }, [queryClient, user?.id]);

  const prefetchJourneysTab = useCallback(() => {
    if (!user?.id) return;

    const today = format(new Date(), "yyyy-MM-dd");
    void queryClient.prefetchQuery({
      queryKey: getDailyTasksQueryKey(user.id, today),
      queryFn: () => fetchDailyTasks(user.id, today),
      staleTime: DAILY_TASKS_STALE_TIME,
      gcTime: DAILY_TASKS_GC_TIME,
    }).catch(() => undefined);
  }, [queryClient, user?.id]);

  const prefetchCompanionTab = useCallback(() => {
    if (!user?.id) return;

    void queryClient.prefetchQuery({
      queryKey: getCompanionQueryKey(user.id),
      queryFn: () => fetchCompanion(user.id),
      staleTime: COMPANION_STALE_TIME_MS,
      gcTime: COMPANION_GC_TIME_MS,
    }).catch(() => undefined);
  }, [queryClient, user?.id]);

  // Prefetch on pointer intent/hover/focus for faster tab activation.
  const handlePrefetch = useCallback((page: PrefetchTarget) => {
    switch (page) {
      case "mentor":
        prefetchMentorTab();
        break;
      case "inbox":
        prefetchInboxTab();
        break;
      case "journeys":
        prefetchJourneysTab();
        break;
      case "companion":
        prefetchCompanionTab();
        break;
      default:
        break;
    }
  }, [prefetchCompanionTab, prefetchInboxTab, prefetchJourneysTab, prefetchMentorTab]);

  const handleTabClick = useCallback(
    (path: MainTabPath) => (event: MouseEvent<HTMLAnchorElement>) => {
      haptics.light();
      if (location.pathname === path) {
        event.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    },
    [location.pathname],
  );

  const { data: selectedMentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["selected-mentor", resolvedMentorId],
    enabled: !!resolvedMentorId,
    staleTime: MENTOR_STALE_TIME_MS,
    queryFn: async () => {
      if (!resolvedMentorId) {
        throw new Error('No mentor selected');
      }
      return fetchSelectedMentorById(resolvedMentorId);
    },
  });

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 cosmiq-glass-nav z-50 border-t border-border/40 transition-transform duration-200"
        role="navigation"
        aria-label="Main navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 sm:px-4 py-2.5">
          <NavLink
            to="/mentor"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px]"
            activeClassName="bg-orange-500/12"
            data-tour="mentor-tab"
            onClick={handleTabClick("/mentor")}
            onPointerDown={() => handlePrefetch("mentor")}
            onMouseEnter={() => handlePrefetch('mentor')}
            onFocus={() => handlePrefetch('mentor')}
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-orange-300/80"
                  initial={false}
                  animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.5 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                />
                <motion.div
                  className="flex flex-col items-center gap-1"
                  initial={false}
                  animate={capabilities.enableTabTransitions ? { y: isActive ? -1 : 0, scale: isActive ? 1.04 : 1 } : { y: 0, scale: 1 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                >
                  {mentorLoading ? (
                    <div className="h-7 w-7 rounded-full bg-muted animate-pulse" aria-hidden />
                  ) : selectedMentor ? (
                    <MentorAvatar
                      mentorSlug={selectedMentor.slug || ''}
                      mentorName={selectedMentor.name}
                      primaryColor={selectedMentor.primary_color || '#000'}
                      size="sm"
                      className="w-7 h-7"
                      showBorder={false}
                    />
                  ) : (
                    <User className={`h-6 w-6 transition-colors duration-200 ${isActive ? 'text-orange-300' : 'text-muted-foreground'}`} />
                  )}
                  <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-orange-200' : 'text-muted-foreground/85'}`}>
                    Mentor
                  </span>
                </motion.div>
              </>
            )}
          </NavLink>

          <NavLink
            to="/inbox"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px] relative"
            activeClassName="bg-celestial-blue/12"
            onClick={handleTabClick("/inbox")}
            onPointerDown={() => handlePrefetch("inbox")}
            onMouseEnter={() => handlePrefetch('inbox')}
            onFocus={() => handlePrefetch('inbox')}
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-celestial-blue/90"
                  initial={false}
                  animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.5 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                />
                <motion.div
                  className="flex flex-col items-center gap-1"
                  initial={false}
                  animate={capabilities.enableTabTransitions ? { y: isActive ? -1 : 0, scale: isActive ? 1.04 : 1 } : { y: 0, scale: 1 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                >
                  <div className="relative">
                    <Inbox className={`h-6 w-6 transition-colors duration-200 ${isActive ? 'text-celestial-blue' : 'text-muted-foreground'}`} />
                    {inboxCount > 0 && (
                      <Badge className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 p-0 flex items-center justify-center text-[9px] bg-celestial-blue text-white border-0">
                        {inboxCount > 9 ? '9+' : inboxCount}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-celestial-blue' : 'text-muted-foreground/85'}`}>
                    Inbox
                  </span>
                </motion.div>
              </>
            )}
          </NavLink>

          <NavLink
            to="/journeys"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px]"
            activeClassName="bg-cosmiq-glow/12"
            data-tour="quests-tab"
            onClick={handleTabClick("/journeys")}
            onPointerDown={() => handlePrefetch("journeys")}
            onMouseEnter={() => handlePrefetch('journeys')}
            onFocus={() => handlePrefetch('journeys')}
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-cosmiq-glow/90"
                  initial={false}
                  animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.5 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                />
                <motion.div
                  className="flex flex-col items-center gap-1"
                  initial={false}
                  animate={capabilities.enableTabTransitions ? { y: isActive ? -1 : 0, scale: isActive ? 1.04 : 1 } : { y: 0, scale: 1 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                >
                  <Compass className={`h-6 w-6 transition-colors duration-200 ${isActive ? 'text-cosmiq-glow' : 'text-muted-foreground'}`} />
                  <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-cosmiq-glow' : 'text-muted-foreground/85'}`}>
                    Quests
                  </span>
                </motion.div>
              </>
            )}
          </NavLink>

          <NavLink
            to="/companion"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px] relative"
            activeClassName="bg-stardust-gold/12"
            data-tour="companion-tab"
            onClick={handleTabClick("/companion")}
            onPointerDown={() => handlePrefetch("companion")}
            onMouseEnter={() => handlePrefetch('companion')}
            onFocus={() => handlePrefetch('companion')}
          >
          {({ isActive }) => (
              <>
                <motion.span
                  className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-stardust-gold/90"
                  initial={false}
                  animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.5 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                />
                <motion.div
                  className="flex flex-col items-center gap-1"
                  initial={false}
                  animate={capabilities.enableTabTransitions ? { y: isActive ? -1 : 0, scale: isActive ? 1.04 : 1 } : { y: 0, scale: 1 }}
                  transition={{
                    duration: MOTION_DURATION.quick,
                    ease: MOTION_EASE.standard,
                  }}
                >
                  <div className="relative">
                    <CompanionNavPresence isActive={isActive} />
                    <PawPrint fill="currentColor" className={`h-6 w-6 -rotate-45 transition-colors duration-200 ${isActive ? 'text-stardust-gold' : 'text-muted-foreground'}`} />
                    {companion && progressToNext > 90 && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-stardust-gold text-black animate-pulse">
                        !
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-stardust-gold' : 'text-muted-foreground/85'}`}>
                    Companion
                  </span>
                </motion.div>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </>
  );
});

BottomNav.displayName = 'BottomNav';
