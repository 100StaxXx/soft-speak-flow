/**
 * BlessingSendDialog Component
 * Dialog for sending magical blessings to guild members
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Zap, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlessingType } from "@/hooks/useGuildBlessings";

interface BlessingSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  blessingTypes: BlessingType[];
  chargesRemaining: number;
  onSend: (blessingTypeId: string, message?: string) => void;
  isSending: boolean;
}

export const BlessingSendDialog = ({
  open,
  onOpenChange,
  recipient,
  blessingTypes,
  chargesRemaining,
  onSend,
  isSending,
}: BlessingSendDialogProps) => {
  const [selectedBlessing, setSelectedBlessing] = useState<BlessingType | null>(null);
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!selectedBlessing) return;
    onSend(selectedBlessing.id, message || undefined);
    setSelectedBlessing(null);
    setMessage("");
    onOpenChange(false);
  };

  const getRarityGradient = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
      case 'rare':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'epic':
        return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'legendary':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      default:
        return 'from-primary/20 to-primary/10 border-primary/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Send Blessing
          </DialogTitle>
          <DialogDescription>
            Bestow magical power upon your ally
          </DialogDescription>
        </DialogHeader>

        {/* Recipient */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Avatar className="h-12 w-12">
            <AvatarImage src={recipient.avatarUrl} />
            <AvatarFallback>
              {recipient.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{recipient.name}</p>
            <p className="text-sm text-muted-foreground">Will receive your blessing</p>
          </div>
        </div>

        {/* Charges indicator */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">Daily charges</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Zap
                key={i}
                className={cn(
                  "h-4 w-4 transition-colors",
                  i < chargesRemaining ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>

        {/* Blessing types */}
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-2">
            <AnimatePresence>
              {blessingTypes.map((blessing, index) => (
                <motion.button
                  key={blessing.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedBlessing(blessing)}
                  disabled={chargesRemaining === 0}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-all",
                    "bg-gradient-to-r",
                    getRarityGradient(blessing.rarity),
                    selectedBlessing?.id === blessing.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    chargesRemaining === 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{blessing.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{blessing.name}</span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs capitalize",
                            blessing.rarity === 'legendary' && "border-yellow-500/50 text-yellow-500",
                            blessing.rarity === 'epic' && "border-purple-500/50 text-purple-500",
                            blessing.rarity === 'rare' && "border-blue-500/50 text-blue-500"
                          )}
                        >
                          {blessing.rarity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {blessing.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Lasts {blessing.effect_duration_hours} hours
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Optional message */}
        {selectedBlessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <Textarea
              placeholder="Add a personal message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </motion.div>
        )}

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!selectedBlessing || isSending || chargesRemaining === 0}
          className="w-full gap-2"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Casting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send {selectedBlessing?.name || 'Blessing'}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
