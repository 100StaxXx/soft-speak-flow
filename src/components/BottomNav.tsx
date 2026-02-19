import { memo, useCallback } from "react";
import { PawPrint, User, Compass, Inbox } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentorAvatar } from "@/components/MentorAvatar";
import { useCompanion } from "@/hooks/useCompanion";
import { Badge } from "@/components/ui/badge";
import { getResolvedMentorId } from "@/utils/mentor";
import { haptics } from "@/utils/haptics";
import { CompanionNavPresence } from "@/components/companion/CompanionNavPresence";
import { useInboxCount } from "@/hooks/useInboxTasks";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  DAILY_TASKS_GC_TIME,
  DAILY_TASKS_STALE_TIME,
  fetchDailyTasks,
  getDailyTasksQueryKey,
} from "@/hooks/useTasksQuery";

type PrefetchTarget = "mentor" | "inbox" | "journeys" | "companion";

export const BottomNav = memo(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { companion, progressToNext } = useCompanion();
  const { inboxCount } = useInboxCount();

  const prefetchJourneysTasks = useCallback(() => {
    if (!user?.id) return;

    const today = format(new Date(), "yyyy-MM-dd");
    void queryClient.prefetchQuery({
      queryKey: getDailyTasksQueryKey(user.id, today),
      queryFn: () => fetchDailyTasks(user.id, today),
      staleTime: DAILY_TASKS_STALE_TIME,
      gcTime: DAILY_TASKS_GC_TIME,
    }).catch(() => undefined);
  }, [queryClient, user?.id]);

  // Prefetch on hover/focus for even faster perceived navigation
  const handlePrefetch = useCallback((page: PrefetchTarget) => {
    if (page === "journeys") {
      prefetchJourneysTasks();
    }
  }, [prefetchJourneysTasks]);

  const resolvedMentorId = getResolvedMentorId(profile);

  const { data: selectedMentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["selected-mentor", resolvedMentorId],
    enabled: !!resolvedMentorId,
    staleTime: 10 * 60 * 1000, // Cache mentor data for 10 minutes
    queryFn: async () => {
      if (!resolvedMentorId) {
        throw new Error('No mentor selected');
      }

      const { data, error } = await supabase
        .from("mentors")
        .select("slug, name, primary_color") // Select only needed fields
        .eq("id", resolvedMentorId)
        .maybeSingle();
      if (error) throw error;
      return data;
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
            onClick={() => haptics.light()}
            onMouseEnter={() => handlePrefetch('mentor')}
            onFocus={() => handlePrefetch('mentor')}
          >
            {({ isActive }) => (
              <>
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
              </>
            )}
          </NavLink>

          <NavLink
            to="/inbox"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px] relative"
            activeClassName="bg-celestial-blue/12"
            onClick={() => haptics.light()}
            onMouseEnter={() => handlePrefetch('inbox')}
            onFocus={() => handlePrefetch('inbox')}
          >
            {({ isActive }) => (
              <>
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
              </>
            )}
          </NavLink>

          <NavLink
            to="/journeys"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px]"
            activeClassName="bg-cosmiq-glow/12"
            data-tour="quests-tab"
            onClick={() => haptics.light()}
            onPointerDown={prefetchJourneysTasks}
            onMouseEnter={() => handlePrefetch('journeys')}
            onFocus={() => handlePrefetch('journeys')}
          >
            {({ isActive }) => (
              <>
                <Compass className={`h-6 w-6 transition-colors duration-200 ${isActive ? 'text-cosmiq-glow' : 'text-muted-foreground'}`} />
                <span className={`text-[11px] font-medium transition-colors duration-200 ${isActive ? 'text-cosmiq-glow' : 'text-muted-foreground/85'}`}>
                  Quests
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/companion"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[58px] min-h-[56px] relative"
            activeClassName="bg-stardust-gold/12"
            data-tour="companion-tab"
            onClick={() => haptics.light()}
            onMouseEnter={() => handlePrefetch('companion')}
            onFocus={() => handlePrefetch('companion')}
          >
          {({ isActive }) => (
              <>
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
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </>
  );
});

BottomNav.displayName = 'BottomNav';
