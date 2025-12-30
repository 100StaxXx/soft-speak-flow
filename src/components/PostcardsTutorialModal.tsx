import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Star, BookOpen, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface PostcardsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const storyPoints = [
  {
    icon: Mail,
    title: "Letters from the Cosmos",
    description: "As you progress through campaigns, your companion travels to mysterious places and sends you postcards!",
  },
  {
    icon: Star,
    title: "Chapter Milestones",
    description: "Special milestones unlock new chapters of your story — each one a stepping stone in your cosmic adventure.",
  },
  {
    icon: BookOpen,
    title: "An Unfolding Tale",
    description: "Each postcard reveals clues, prophecies, and characters in your unique journey through the stars.",
  },
  {
    icon: Sparkles,
    title: "Collect & Share",
    description: "View your growing collection anytime. Share your favorites and watch your story unfold!",
  },
];

export function PostcardsTutorialModal({ open, onClose }: PostcardsTutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-md bg-gradient-to-br from-amber-950/95 via-background to-orange-950/90 border-amber-500/30 overflow-hidden"
        hideCloseButton
      >
        {/* Floating sparkles decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-4 right-8 w-2 h-2 bg-amber-400 rounded-full blur-sm"
          />
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-12 left-12 w-1.5 h-1.5 bg-orange-300 rounded-full blur-sm"
          />
          <motion.div
            animate={{ 
              y: [0, -12, 0],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-20 right-16 w-2 h-2 bg-yellow-400 rounded-full blur-sm"
          />
        </div>

        <DialogHeader className="text-center pb-2">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
            className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30"
          >
            <Mail className="w-8 h-8 text-white" />
          </motion.div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300 bg-clip-text text-transparent">
            Your Companion's Journey
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            Discover the magic of cosmic postcards
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {storyPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.1, duration: 0.3 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 transition-colors"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <point.icon className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-amber-200/90 mb-0.5">
                  {point.title}
                </h4>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  {point.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Begin My Journey
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
