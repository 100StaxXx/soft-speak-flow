/**
 * ProphecyBoard Component
 * Displays guild prophecies and predictions
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Plus,
  Check,
  Clock,
  Sparkles,
  Star,
  Target,
  Flame,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface Prophecy {
  id: string;
  prophecy_type: string;
  prophecy_text: string;
  subject_id: string;
  prophet_id: string;
  target_value: number | null;
  expires_at: string;
  is_fulfilled: boolean;
  fulfilled_at: string | null;
  xp_reward: number;
  prophet?: {
    email: string | null;
    onboarding_data: unknown;
  };
  subject?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

interface GuildMember {
  user_id: string;
  email: string | null;
  onboarding_data: unknown;
}

interface ProphecyBoardProps {
  prophecies: Prophecy[];
  members: GuildMember[];
  onCreateProphecy: (data: {
    subjectId: string;
    prophecyType: string;
    prophecyText: string;
    targetValue?: number;
  }) => void;
  isCreating: boolean;
  canCreate: boolean;
}

export const ProphecyBoard = ({
  prophecies,
  members,
  onCreateProphecy,
  isCreating,
  canCreate,
}: ProphecyBoardProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [prophecyType, setProphecyType] = useState<string>("streak_milestone");
  const [prophecyText, setProphecyText] = useState<string>("");

  const handleCreate = () => {
    if (!selectedSubject || !prophecyText.trim()) return;
    onCreateProphecy({
      subjectId: selectedSubject,
      prophecyType,
      prophecyText: prophecyText.trim(),
    });
    setShowCreate(false);
    setSelectedSubject("");
    setProphecyText("");
  };

  const getProphecyTypeConfig = (type: string) => {
    switch (type) {
      case 'streak_milestone':
        return { icon: Flame, color: 'text-orange-400', label: 'Streak' };
      case 'boss_defeat':
        return { icon: Target, color: 'text-red-400', label: 'Boss' };
      case 'blessing_chain':
        return { icon: Sparkles, color: 'text-yellow-400', label: 'Blessing' };
      case 'habit_mastery':
        return { icon: Star, color: 'text-purple-400', label: 'Mastery' };
      default:
        return { icon: Eye, color: 'text-primary', label: 'Prophecy' };
    }
  };

  const activeProphecies = prophecies.filter(p => !p.is_fulfilled);
  const fulfilledProphecies = prophecies.filter(p => p.is_fulfilled);

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-400" />
            Prophecy Board
          </CardTitle>
          
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!canCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Prophesy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-400" />
                  Create Prophecy
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Choose subject</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a guild member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {getUserDisplayName(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Prophecy type</label>
                  <Select value={prophecyType} onValueChange={setProphecyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="streak_milestone">Streak Milestone</SelectItem>
                      <SelectItem value="boss_defeat">Boss Defeat</SelectItem>
                      <SelectItem value="blessing_chain">Blessing Chain</SelectItem>
                      <SelectItem value="habit_mastery">Habit Mastery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Your prophecy</label>
                  <Textarea
                    placeholder="I foresee that this hero shall..."
                    value={prophecyText}
                    onChange={(e) => setProphecyText(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={!selectedSubject || !prophecyText.trim() || isCreating}
                  className="w-full gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Casting...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Speak Prophecy
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {prophecies.length === 0 ? (
          <div className="p-6 text-center">
            <Eye className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No prophecies yet. Be the first to foresee the future!
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="p-4 space-y-3">
              {/* Active prophecies */}
              {activeProphecies.map((prophecy, index) => {
                const config = getProphecyTypeConfig(prophecy.prophecy_type);
                const Icon = config.icon;
                const expiresIn = formatDistanceToNow(new Date(prophecy.expires_at), { addSuffix: true });

                return (
                  <motion.div
                    key={prophecy.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm italic">"{prophecy.prophecy_text}"</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            About {getUserDisplayName(prophecy.subject)}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            by {getUserDisplayName(prophecy.prophet)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expires {expiresIn}
                          </div>
                          <Badge variant="outline" className="text-xs gap-1">
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                            {prophecy.xp_reward} XP
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Fulfilled prophecies */}
              {fulfilledProphecies.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Fulfilled</span>
                    <div className="flex-1 h-px bg-green-500/30" />
                  </div>

                  {fulfilledProphecies.map((prophecy) => {
                    return (
                      <motion.div
                        key={prophecy.id}
                        className="p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                      >
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm italic text-muted-foreground line-through">
                              "{prophecy.prophecy_text}"
                            </p>
                            <p className="text-xs text-green-400 mt-1">
                              Prophecy fulfilled! 
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
