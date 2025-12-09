import { ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type ChipTone = 'default' | 'accent' | 'positive' | 'warning';

export interface MiniGameInfoChip {
  label: string;
  value: string;
  tone?: ChipTone;
  icon?: ReactNode;
  helperText?: string;
}

interface MiniGameHudProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  chips?: MiniGameInfoChip[];
  children: ReactNode;
  statusBar?: ReactNode;
  footerNote?: ReactNode;
  className?: string;
}

const chipToneMap: Record<ChipTone, string> = {
  default: 'bg-muted/30 border-border/60',
  accent: 'bg-primary/10 border-primary/40',
  positive: 'bg-emerald-500/10 border-emerald-500/40',
  warning: 'bg-amber-500/10 border-amber-500/40',
};

const chipValueToneMap: Record<ChipTone, string> = {
  default: 'text-foreground',
  accent: 'text-primary',
  positive: 'text-emerald-400',
  warning: 'text-amber-400',
};

const twinkleKeyframes = `
@keyframes miniGameTwinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.9); }
  50% { opacity: 0.8; transform: scale(1.2); }
}
`;

export const MiniGameHud = ({
  title,
  subtitle,
  eyebrow,
  chips = [],
  children,
  statusBar,
  footerNote,
  className,
}: MiniGameHudProps) => {
  const starField = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, idx) => ({
        id: idx,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
      })),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('w-full flex flex-col gap-4', className)}
    >
      <div className="space-y-1 text-center">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
            {eyebrow}
          </p>
        )}
        <h3 className="text-xl font-bold text-foreground drop-shadow-sm">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {chips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {chips.map((chip) => {
            const tone = chip.tone ?? 'default';
            return (
              <motion.div
                key={`${chip.label}-${chip.value}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-left backdrop-blur shadow-sm shadow-black/5',
                  chipToneMap[tone]
                )}
              >
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {chip.label}
                </p>
                <div
                  className={cn(
                    'mt-1 flex items-center gap-1 text-sm font-semibold leading-tight',
                    chipValueToneMap[tone]
                  )}
                >
                  {chip.icon && (
                    <span className="text-base leading-none text-muted-foreground/70">
                      {chip.icon}
                    </span>
                  )}
                  <span>{chip.value}</span>
                </div>
                {chip.helperText && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    {chip.helperText}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {statusBar && (
        <div className="rounded-2xl border border-border/50 bg-gradient-to-r from-muted/40 via-background to-muted/30 px-4 py-3 shadow-inner">
          {statusBar}
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background/70 via-background to-background/80 p-4 sm:p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen">
          {starField.map((star) => (
            <span
              key={star.id}
              className="absolute rounded-full bg-white/40 blur-[1px]"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animation: `miniGameTwinkle 2.4s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}
          <div className="absolute inset-x-10 top-0 h-32 bg-gradient-to-b from-primary/15 to-transparent blur-3xl" />
        </div>
        <div className="relative z-10">{children}</div>
      </div>

      {footerNote && (
        <div className="text-center text-xs text-muted-foreground">{footerNote}</div>
      )}
      <style>{twinkleKeyframes}</style>
    </motion.div>
  );
};
