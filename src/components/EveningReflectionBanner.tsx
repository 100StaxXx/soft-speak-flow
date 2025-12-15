import { Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import { EveningReflectionDrawer } from "./EveningReflectionDrawer";

export const EveningReflectionBanner = () => {
  const { shouldShowBanner, isDrawerOpen, setIsDrawerOpen } = useEveningReflection();

  if (!shouldShowBanner) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4"
      >
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-500/30 backdrop-blur-sm hover:border-purple-500/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
              <Moon className="h-5 w-5 text-purple-300" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Evening Reflection</p>
              <p className="text-sm text-muted-foreground">How was your day? ✨</p>
            </div>
            <div className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
              +3 XP
            </div>
          </div>
        </button>
      </motion.div>

      <EveningReflectionDrawer 
        open={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen} 
      />
    </>
  );
};