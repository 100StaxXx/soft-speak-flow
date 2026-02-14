/**
 * GuildArtifactsDisplay Component
 * Shows guild's unlocked artifacts and relics
 */

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Gem, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface GuildArtifact {
  id: string;
  name: string;
  description: string;
  icon: string;
  artifact_type: string;
  rarity: string;
  css_effect: Record<string, unknown> | null;
  unlock_requirement_type: string;
  unlock_requirement_value: number;
}

interface UnlockedArtifact {
  id: string;
  artifact_id: string;
  unlocked_at: string;
  unlocked_by: string;
  artifact: GuildArtifact;
  unlocker?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

interface GuildArtifactsDisplayProps {
  allArtifacts: GuildArtifact[];
  unlockedArtifacts: UnlockedArtifact[];
  isLoading: boolean;
}

export const GuildArtifactsDisplay = ({
  allArtifacts,
  unlockedArtifacts,
  isLoading,
}: GuildArtifactsDisplayProps) => {
  const unlockedIds = new Set(unlockedArtifacts.map(u => u.artifact_id));

  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          glow: '',
        };
      case 'rare':
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          glow: 'shadow-blue-500/20',
        };
      case 'epic':
        return {
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          glow: 'shadow-purple-500/30',
        };
      case 'legendary':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          glow: 'shadow-yellow-500/40',
        };
      default:
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
          glow: '',
        };
    }
  };

  if (isLoading) {
    return (
      <Card className="cosmic-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gem className="h-5 w-5 text-purple-400" />
          Guild Artifacts
          <Badge variant="outline" className="ml-auto text-xs">
            {unlockedArtifacts.length} / {allArtifacts.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <TooltipProvider>
          <ScrollArea className="h-[200px]">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {allArtifacts.map((artifact, index) => {
                const isUnlocked = unlockedIds.has(artifact.id);
                const unlockInfo = unlockedArtifacts.find(u => u.artifact_id === artifact.id);
                const config = getRarityConfig(artifact.rarity);

                return (
                  <Tooltip key={artifact.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "aspect-square rounded-lg border p-2 flex flex-col items-center justify-center gap-1",
                          "transition-all cursor-pointer",
                          isUnlocked
                            ? cn(config.bgColor, config.borderColor, "shadow-lg", config.glow)
                            : "bg-muted/30 border-muted-foreground/20 opacity-50"
                        )}
                      >
                        {isUnlocked ? (
                          <span className="text-2xl">{artifact.icon}</span>
                        ) : (
                          <Lock className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{artifact.name}</span>
                          <Badge variant="outline" className={cn("text-xs capitalize", config.color)}>
                            {artifact.rarity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {artifact.description}
                        </p>
                        {isUnlocked && unlockInfo ? (
                          <p className="text-xs text-green-400">
                            Unlocked by {getUserDisplayName(unlockInfo.unlocker)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Requires: {artifact.unlock_requirement_value} {artifact.unlock_requirement_type.replace('_', ' ')}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </ScrollArea>
        </TooltipProvider>

        {unlockedArtifacts.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 inline mr-1" />
              Complete guild achievements to unlock artifacts!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
