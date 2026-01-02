import { memo } from "react";
import { Calendar, Sparkles, User, Compass } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentorAvatar } from "@/components/MentorAvatar";
import { useCompanion } from "@/hooks/useCompanion";
import { Badge } from "@/components/ui/badge";
import { getResolvedMentorId } from "@/utils/mentor";
// HIDDEN: Long press to arcade disabled
// import { useLongPress } from "@/hooks/useLongPress";
import { haptics } from "@/utils/haptics";

export const BottomNav = memo(() => {
  const { profile } = useProfile();
  const { companion, progressToNext } = useCompanion();

  const resolvedMentorId = getResolvedMentorId(profile);

  // HIDDEN: Long press arcade navigation disabled
  // const longPressHandlers = useLongPress({ ... });

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
        className="fixed bottom-0 left-0 right-0 cosmiq-glass-nav z-50 transition-transform duration-200"
        role="navigation"
        aria-label="Main navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 sm:px-4 py-3 sm:py-2.5">
        <NavLink
          to="/mentor"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px]"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
          onClick={() => haptics.light()}
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
                <User className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              )}
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Mentor
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/companion"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px] relative"
          activeClassName="bg-gradient-to-br from-stardust-gold/20 to-stardust-gold/5 shadow-soft"
          data-tour="companion-tab"
          onClick={() => haptics.light()}
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Sparkles className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-stardust-gold drop-shadow-[0_0_8px_hsl(45,100%,65%)]' : 'text-muted-foreground'}`} />
                {companion && progressToNext > 90 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-stardust-gold text-black animate-pulse">
                    !
                  </Badge>
                )}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-stardust-gold' : 'text-muted-foreground/80'}`}>
                Companion
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/journeys"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px]"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
          data-tour="tasks-tab"
          onClick={() => haptics.light()}
        >
          {({ isActive }) => (
            <>
              <Compass className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Quests
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/guilds"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px]"
          activeClassName="bg-gradient-to-br from-celestial-blue/20 to-celestial-blue/5 shadow-soft"
          onClick={() => haptics.light()}
        >
          {({ isActive }) => (
            <>
              <Calendar className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-celestial-blue drop-shadow-[0_0_8px_hsl(210,80%,50%)]' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-celestial-blue' : 'text-muted-foreground/80'}`}>
                Calendar
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px]"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
          onClick={() => haptics.light()}
        >
          {({ isActive }) => (
            <>
              <User className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Command
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
