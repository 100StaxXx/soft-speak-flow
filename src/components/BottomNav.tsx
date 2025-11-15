import { Home, Video, MessageCircleHeart, Heart, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border shadow-medium z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        <NavLink
          to="/"
          end
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
          activeClassName="bg-primary/10"
        >
          {({ isActive }) => (
            <>
              <Home className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                Home
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/videos"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
          activeClassName="bg-primary/10"
        >
          {({ isActive }) => (
            <>
              <Video className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                Library
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/quotes"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
          activeClassName="bg-primary/10"
        >
          {({ isActive }) => (
            <>
              <MessageCircleHeart className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                Quotes
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/saved"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
          activeClassName="bg-primary/10"
        >
          {({ isActive }) => (
            <>
              <Heart className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                Saved
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
          activeClassName="bg-primary/10"
        >
          {({ isActive }) => (
            <>
              <User className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                Profile
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
