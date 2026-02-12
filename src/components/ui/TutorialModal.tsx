import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TutorialFeature {
  icon: LucideIcon;
  text: string;
}

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: TutorialFeature[];
  footerHint?: string;
  buttonText?: string;
  accentColor?: string;
}

const ACCENT_STYLE_MAP = {
  primary: {
    glow: "bg-primary/30",
    iconWrap: "from-primary/20 to-primary/5",
    icon: "text-primary",
    featureWrap: "bg-primary/10",
    featureIcon: "text-primary",
    button: "bg-primary hover:bg-primary/90 shadow-primary/25",
  },
  accent: {
    glow: "bg-accent/30",
    iconWrap: "from-accent/20 to-accent/5",
    icon: "text-accent",
    featureWrap: "bg-accent/10",
    featureIcon: "text-accent",
    button: "bg-accent hover:bg-accent/90 shadow-accent/25",
  },
  "celestial-blue": {
    glow: "bg-celestial-blue/30",
    iconWrap: "from-celestial-blue/20 to-celestial-blue/5",
    icon: "text-celestial-blue",
    featureWrap: "bg-celestial-blue/10",
    featureIcon: "text-celestial-blue",
    button: "bg-celestial-blue hover:bg-celestial-blue/90 shadow-celestial-blue/25",
  },
  "stardust-gold": {
    glow: "bg-stardust-gold/25",
    iconWrap: "from-stardust-gold/20 to-stardust-gold/5",
    icon: "text-stardust-gold",
    featureWrap: "bg-stardust-gold/10",
    featureIcon: "text-stardust-gold",
    button: "bg-stardust-gold hover:bg-stardust-gold/90 shadow-stardust-gold/25 text-black",
  },
  destructive: {
    glow: "bg-destructive/25",
    iconWrap: "from-destructive/20 to-destructive/5",
    icon: "text-destructive",
    featureWrap: "bg-destructive/10",
    featureIcon: "text-destructive",
    button: "bg-destructive hover:bg-destructive/90 shadow-destructive/25",
  },
} as const;

export function TutorialModal({
  open,
  onClose,
  icon: Icon,
  title,
  subtitle,
  features,
  footerHint,
  buttonText = "Continue",
  accentColor = "primary",
}: TutorialModalProps) {
  const accent =
    ACCENT_STYLE_MAP[accentColor as keyof typeof ACCENT_STYLE_MAP] ??
    ACCENT_STYLE_MAP.primary;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-sm rounded-3xl border-border/70 bg-card/90 p-0 shadow-[0_24px_46px_rgba(0,0,0,0.34)] backdrop-blur-2xl overflow-hidden"
        hideCloseButton
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 300 
          }}
        >
          {/* Hero section with centered icon */}
          <div className="pt-8 pb-4 flex flex-col items-center">
            {/* Soft glow behind icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", damping: 15 }}
              className="relative"
            >
              <div className={cn("absolute inset-0 rounded-full blur-2xl scale-150", accent.glow)} />
              <div
                className={cn(
                  "relative w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center border border-white/10 shadow-lg",
                  accent.iconWrap,
                )}
              >
                <Icon className={cn("w-8 h-8", accent.icon)} />
              </div>
            </motion.div>
            
            {/* Title with clean typography */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-5 text-xl font-semibold tracking-tight text-foreground"
            >
              {title}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-muted-foreground text-center px-6 leading-relaxed"
            >
              {subtitle}
            </motion.p>
          </div>

          {/* Feature list (iOS Settings-style) */}
          <div className="px-5 pb-4">
            <div className="rounded-2xl bg-card/50 backdrop-blur-sm divide-y divide-border/30 overflow-hidden">
              {features.map((feature, i) => {
                const FeatureIcon = feature.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", accent.featureWrap)}>
                      <FeatureIcon className={cn("w-4 h-4", accent.featureIcon)} />
                    </div>
                    <span className="text-sm text-foreground/90">{feature.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer hint */}
          {footerHint && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="px-6 pb-2 text-xs text-muted-foreground text-center"
            >
              {footerHint}
            </motion.p>
          )}

          {/* CTA Button (Pill-shaped) */}
          <div className="px-5 pb-6 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button 
                onClick={onClose}
                className={cn("w-full h-12 rounded-full text-base shadow-lg transition-all duration-200 active:scale-[0.98]", accent.button)}
              >
                {buttonText}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
