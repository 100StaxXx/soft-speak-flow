import { Home, TrendingUp, MessageCircleHeart, Search } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/98 to-background/95 backdrop-blur-xl border-t border-border/50 shadow-glow z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 py-3">
        <NavLink
          to="/"
          end
          className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              <Home className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Home
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/progress"
          className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              <TrendingUp className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Progress
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/inspire"
          className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          activeClassName="bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft"
        >
          {({ isActive }) => (
            <>
              <MessageCircleHeart className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-primary drop-shadow-glow' : 'text-muted-foreground'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground/80'}`}>
                Inspire
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/search"
          className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95"
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
      </div>
    </nav>
  );
};
