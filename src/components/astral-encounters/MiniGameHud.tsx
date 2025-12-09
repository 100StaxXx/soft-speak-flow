import { ReactNode } from 'react';
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

export const MiniGameHud = ({
  title,
  subtitle,
  chips = [],
  children,
  statusBar,
  footerNote,
  className,
}: MiniGameHudProps) => {
  return (
    <div className={cn('w-full flex flex-col gap-4', className)}>
      <div className="space-y-1 text-center">
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {chips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {chips.map((chip) => {
            const tone = chip.tone ?? 'default';
            return (
              <div
                key={`${chip.label}-${chip.value}`}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-left backdrop-blur',
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
                    <span className="text-base leading-none text-muted-foreground">
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
              </div>
            );
          })}
        </div>
      )}

      {statusBar && (
        <div className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2 shadow-inner">
          {statusBar}
        </div>
      )}

      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-background/70 via-background to-background/80 p-4 sm:p-6 shadow-inner">
        {children}
      </div>

      {footerNote && (
        <div className="text-center text-xs text-muted-foreground">{footerNote}</div>
      )}
    </div>
  );
};
