/**
 * GuildTitlesDisplay Component
 * Shows user's earned titles and allows selection
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Check, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuildTitle, MemberTitle } from "@/hooks/useGuildTitles";

interface GuildTitlesDisplayProps {
  activeTitle: GuildTitle | null;
  myTitles: MemberTitle[];
  allTitles: GuildTitle[];
  onSelectTitle: (titleId: string | null) => void;
  isUpdating: boolean;
  getRarityColor: (rarity: string) => string;
}

export const GuildTitlesDisplay = ({
  activeTitle,
  myTitles,
  allTitles,
  onSelectTitle,
  isUpdating,
  getRarityColor,
}: GuildTitlesDisplayProps) => {
  const [open, setOpen] = useState(false);
  const earnedTitleIds = new Set(myTitles?.map(t => t.title_id) || []);

  const getRarityBg = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'from-gray-500/10 to-gray-600/10 border-gray-500/30';
      case 'rare':
        return 'from-blue-500/10 to-cyan-500/10 border-blue-500/30';
      case 'epic':
        return 'from-purple-500/10 to-pink-500/10 border-purple-500/30';
      case 'legendary':
        return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/30';
      default:
        return 'from-primary/10 to-primary/5 border-primary/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 h-auto py-1 px-2",
            activeTitle && getRarityColor(activeTitle.rarity)
          )}
        >
          {activeTitle ? (
            <>
              <span className="text-sm">{activeTitle.icon}</span>
              <span className="text-xs font-medium">{activeTitle.name}</span>
            </>
          ) : (
            <>
              <Crown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">No Title</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Guild Titles
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {/* No title option */}
            <motion.button
              onClick={() => {
                onSelectTitle(null);
                setOpen(false);
              }}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all",
                "bg-muted/50 border-border/50 hover:border-primary/50",
                !activeTitle && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Crown className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">No title displayed</span>
              </div>
            </motion.button>

            {allTitles?.map((title, index) => {
              const isEarned = earnedTitleIds.has(title.id);
              const isActive = activeTitle?.id === title.id;

              return (
                <motion.button
                  key={title.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    if (isEarned) {
                      onSelectTitle(title.id);
                      setOpen(false);
                    }
                  }}
                  disabled={!isEarned || isUpdating}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-all",
                    "bg-gradient-to-r",
                    getRarityBg(title.rarity),
                    isEarned ? "cursor-pointer hover:scale-[1.01]" : "opacity-50 cursor-not-allowed",
                    isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isEarned ? getRarityBg(title.rarity) : "bg-muted"
                    )}>
                      <span className="text-xl">{title.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", getRarityColor(title.rarity))}>
                          {title.name}
                        </span>
                        <Badge variant="outline" className={cn("text-xs capitalize", getRarityColor(title.rarity))}>
                          {title.rarity}
                        </Badge>
                        {isActive && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {title.description}
                      </p>
                    </div>

                    {!isEarned && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Earn titles by completing guild achievements</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
