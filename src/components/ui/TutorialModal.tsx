import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

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
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-sm rounded-3xl bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/20 p-0 overflow-hidden"
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
              <div className={`absolute inset-0 bg-${accentColor}/30 rounded-full blur-2xl scale-150`} />
              <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br from-${accentColor}/20 to-${accentColor}/5 flex items-center justify-center border border-white/10 shadow-lg`}>
                <Icon className={`w-8 h-8 text-${accentColor}`} />
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
                    <div className={`w-8 h-8 rounded-xl bg-${accentColor}/10 flex items-center justify-center flex-shrink-0`}>
                      <FeatureIcon className={`w-4 h-4 text-${accentColor}`} />
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
                className={`w-full h-12 rounded-full bg-${accentColor} hover:bg-${accentColor}/90 font-medium text-base shadow-lg shadow-${accentColor}/25 transition-all duration-200 active:scale-[0.98]`}
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
