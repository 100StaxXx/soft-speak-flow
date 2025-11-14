import { Home, Video, MessageCircleHeart, Heart, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-medium z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-3">
        <NavLink
          to="/"
          end
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all"
          activeClassName="bg-gradient-to-br from-blush-rose/20 to-petal-pink/20"
        >
          {({ isActive }) => (
            <>
              <Home className={`h-5 w-5 ${isActive ? 'text-blush-rose' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                Home
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/videos"
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all"
          activeClassName="bg-gradient-to-br from-blush-rose/20 to-petal-pink/20"
        >
          {({ isActive }) => (
            <>
              <Video className={`h-5 w-5 ${isActive ? 'text-blush-rose' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                Library
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/quotes"
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all"
          activeClassName="bg-gradient-to-br from-blush-rose/20 to-petal-pink/20"
        >
          {({ isActive }) => (
            <>
              <MessageCircleHeart className={`h-5 w-5 ${isActive ? 'text-blush-rose' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                Quotes
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/saved"
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all"
          activeClassName="bg-gradient-to-br from-blush-rose/20 to-petal-pink/20"
        >
          {({ isActive }) => (
            <>
              <Heart className={`h-5 w-5 ${isActive ? 'text-blush-rose' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                Saved
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all"
          activeClassName="bg-gradient-to-br from-blush-rose/20 to-petal-pink/20"
        >
          {({ isActive }) => (
            <>
              <User className={`h-5 w-5 ${isActive ? 'text-blush-rose' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                Profile
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
