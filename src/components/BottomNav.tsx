import { memo, useEffect, useRef } from "react";
import { Compass, MessageCircle, PawPrint, Sunrise } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { CompanionNavPresence } from "@/components/companion/CompanionNavPresence";
import { haptics } from "@/utils/haptics";
import { PRODUCT } from "@/config/product";
const navItems = PRODUCT.mode === "cosmiq" ? [
  { to: "/mentor", label: "Guide", icon: Sunrise, primary: false },
  { to: "/journeys", label: "Plan", icon: Compass, primary: true },
  { to: "/companion", label: "Companion", icon: PawPrint, primary: false },
] as const : [
  { to: "/mentor", label: "Today", icon: Sunrise, primary: false },
  { to: "/companion", label: "Companion", icon: PawPrint, primary: true },
  { to: "/guide", label: "Guide", icon: MessageCircle, primary: false },
] as const;

export const BottomNav = memo(() => {
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    const rootStyle = document.documentElement.style;
    const updateRuntimeOffset = () => {
      const navHeight = Math.max(0, Math.round(navElement.getBoundingClientRect().height));
      rootStyle.setProperty("--bottom-nav-runtime-offset", `${navHeight}px`);
    };

    updateRuntimeOffset();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateRuntimeOffset) : null;
    observer?.observe(navElement);
    if (!observer) window.addEventListener("resize", updateRuntimeOffset);

    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", updateRuntimeOffset);
      rootStyle.removeProperty("--bottom-nav-runtime-offset");
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/55 bg-background/[0.88] shadow-[0_-12px_40px_rgba(20,30,20,0.08)] backdrop-blur-2xl"
      role="navigation"
      aria-label="Main navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 items-end px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-muted-foreground transition active:scale-95 ${item.primary ? "font-semibold" : ""}`}
              activeClassName={item.primary ? "text-primary" : "bg-primary/[0.12] text-primary"}
              onClick={() => {
                haptics.light();
              }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={item.primary
                      ? `grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_5px_16px_hsl(var(--primary)/0.28)] ${isActive ? "ring-4 ring-primary/20" : ""}`
                      : "relative isolate grid h-8 w-8 place-items-center"}
                  >
                    {item.to === "/companion" ? <CompanionNavPresence isActive={isActive} /> : null}
                    <Icon className={item.primary ? "h-5.5 w-5.5" : `h-6 w-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </span>
                  <span className={`text-[11px] ${item.primary || isActive ? "font-semibold" : "font-medium"} ${isActive ? "text-primary" : item.primary ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
