import { ListChecks, Search, Sparkles, User, Swords } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentorAvatar } from "@/components/MentorAvatar";
import { useCompanion } from "@/hooks/useCompanion";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export const BottomNav = () => {
  const { profile } = useProfile();
  const { companion, progressToNext } = useCompanion();
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  useEffect(() => {
    const handleTutorialStep = (e: CustomEvent) => {
      setTutorialStep(e.detail.step);
    };
    
    window.addEventListener('tutorial-step-change' as any, handleTutorialStep);
    return () => window.removeEventListener('tutorial-step-change' as any, handleTutorialStep);
  }, []);

  const { data: selectedMentor } = useQuery({
    queryKey: ["selected-mentor", profile?.selected_mentor_id],
    enabled: !!profile?.selected_mentor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .eq("id", profile!.selected_mentor_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Determine if navigation should be blocked
  const isTutorialActive = tutorialStep !== null;
  const canClickCompanion = tutorialStep === 1; // Step 1: XP Celebration - Click Companion tab
  const canClickQuests = tutorialStep === 2 || tutorialStep === 3; // Steps 2-3: Companion intro + Quest creation
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleModalChange = (e: CustomEvent) => {
      setIsModalOpen(e.detail.isOpen);
    };
    
    window.addEventListener('tutorial-modal-change' as any, handleModalChange);
    return () => window.removeEventListener('tutorial-modal-change' as any, handleModalChange);
  }, []);

  // Highlights should only show when the user can interact (no modal blocking)
  const shouldHighlightCompanion = canClickCompanion && !isModalOpen;
  const shouldHighlightQuests = canClickQuests && !isModalOpen;
  
  // Remove console logs for production
  
  const handleNavClick = (e: React.MouseEvent, route: string) => {
    if (!isTutorialActive) return;
    
    // Allow Companion click on step 2
    if (route === '/companion' && canClickCompanion) {
      return;
    }
    
    // Allow Quests click on steps 3-4
    if (route === '/tasks' && canClickQuests) {
      return;
    }
    
    // Block all other navigation during tutorial
    e.preventDefault();
    e.stopPropagation();
  };

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
          to="/"
          id="nav-home"
          end
          onClick={(e) => handleNavClick(e, '/')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isTutorialActive ? 'opacity-50' : ''}`}
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              {selectedMentor ? (
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
          id="nav-companion"
          onClick={(e) => handleNavClick(e, '/companion')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 relative ${
            shouldHighlightCompanion ? 'ring-4 ring-primary/50 animate-pulse bg-primary/10 shadow-glow' : ''
          } ${
            isTutorialActive && !canClickCompanion ? 'opacity-50' : ''
          }`}
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
          id="nav-tasks"
          onClick={(e) => handleNavClick(e, '/tasks')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            shouldHighlightQuests ? 'ring-4 ring-primary/50 animate-pulse bg-primary/10 shadow-glow' : ''
          } ${
            isTutorialActive && !canClickQuests ? 'opacity-50' : ''
          }`}
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
          id="nav-search"
          onClick={(e) => handleNavClick(e, '/search')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isTutorialActive ? 'opacity-50' : ''}`}
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
          id="nav-profile"
          onClick={(e) => handleNavClick(e, '/profile')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isTutorialActive ? 'opacity-50' : ''}`}
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
};
