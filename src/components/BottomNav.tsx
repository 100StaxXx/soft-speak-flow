import { memo } from "react";
import { Search, Sparkles, User, Swords } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { MentorAvatar } from "@/components/MentorAvatar";
import { getMentor } from "@/lib/firebase/mentors";
import { useCompanion } from "@/hooks/useCompanion";
import { Badge } from "@/components/ui/badge";
import { getResolvedMentorId } from "@/utils/mentor";

export const BottomNav = memo(() => {
  const { profile } = useProfile();
  const { companion, progressToNext } = useCompanion();

  const resolvedMentorId = getResolvedMentorId(profile);

  const { data: selectedMentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["selected-mentor", resolvedMentorId],
    enabled: !!resolvedMentorId,
    staleTime: 10 * 60 * 1000, // Cache mentor data for 10 minutes
    queryFn: async () => {
      if (!resolvedMentorId) {
        throw new Error('No mentor selected');
      }

      const mentor = await getMentor(resolvedMentorId);
      if (!mentor) return null;
      
      return {
        slug: mentor.slug,
        name: mentor.name,
        primary_color: mentor.primary_color,
      };
    },
  });

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/98 to-background/95 backdrop-blur-xl border-t border-border/50 shadow-glow z-50 transition-transform duration-300"
        role="navigation"
        aria-label="Main navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 sm:px-4 py-3 sm:py-2.5">
        <NavLink
          to="/mentor"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
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
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 relative"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
          data-tour="companion-tab"
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Sparkles className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
                {companion && progressToNext > 75 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-primary text-primary-foreground animate-pulse">
                    !
                  </Badge>
                )}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Companion
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/tasks"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
          data-tour="tasks-tab"
        >
          {({ isActive }) => (
            <>
              <Swords className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Quests
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/search"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              <Search className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Search
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              <User className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Profile
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
