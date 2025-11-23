import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
}

interface NavLinkCompatProps extends Omit<NavLinkProps, "className" | "children"> {
  className?: string | ((props: NavLinkRenderProps) => string);
  activeClassName?: string;
  pendingClassName?: string;
  children?: ReactNode | ((props: NavLinkRenderProps) => ReactNode);
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, children, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) => {
          // Handle both string and function className
          const baseClassName = typeof className === 'function' 
            ? className({ isActive, isPending })
            : className;
          return cn(baseClassName, isActive && activeClassName, isPending && pendingClassName);
        }}
        {...props}
      >
        {typeof children === 'function'
          ? ({ isActive, isPending }: NavLinkRenderProps) => children({ isActive, isPending })
          : children
        }
      </RouterNavLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
