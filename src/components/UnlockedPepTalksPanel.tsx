import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAchievementPepTalks } from "@/hooks/useAchievementPepTalks";
import { AchievementPepTalkModal } from "./AchievementPepTalkModal";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tierColors = {
  bronze: "bg-amber-700/20 text-amber-300 border-amber-600",
  silver: "bg-slate-400/20 text-slate-200 border-slate-400",
  gold: "bg-yellow-500/20 text-yellow-300 border-yellow-500",
  platinum: "bg-cyan-400/20 text-cyan-200 border-cyan-400",
};

export const UnlockedPepTalksPanel = () => {
  const { unlockedPepTalks, isLoading, getPepTalksByTier } = useAchievementPepTalks();
  const [selectedPepTalk, setSelectedPepTalk] = useState<typeof unlockedPepTalks[0] | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Unlocked Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (unlockedPepTalks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Unlocked Messages
          </CardTitle>
          <CardDescription>
            Earn achievements to unlock special messages from your mentor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No messages unlocked yet. Keep growing!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Unlocked Messages
          </CardTitle>
          <CardDescription>
            {unlockedPepTalks.length} special message{unlockedPepTalks.length !== 1 ? 's' : ''} from your achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="bronze">Bronze</TabsTrigger>
              <TabsTrigger value="silver">Silver</TabsTrigger>
              <TabsTrigger value="gold">Gold</TabsTrigger>
              <TabsTrigger value="platinum">Platinum</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-4">
              {unlockedPepTalks.map((pepTalk) => (
                <PepTalkCard
                  key={pepTalk.id}
                  pepTalk={pepTalk}
                  onClick={() => setSelectedPepTalk(pepTalk)}
                />
              ))}
            </TabsContent>

            {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => (
              <TabsContent key={tier} value={tier} className="space-y-3 mt-4">
                {getPepTalksByTier(tier).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No {tier} messages unlocked yet
                  </p>
                ) : (
                  getPepTalksByTier(tier).map((pepTalk) => (
                    <PepTalkCard
                      key={pepTalk.id}
                      pepTalk={pepTalk}
                      onClick={() => setSelectedPepTalk(pepTalk)}
                    />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <AchievementPepTalkModal
        open={!!selectedPepTalk}
        onOpenChange={(open) => !open && setSelectedPepTalk(null)}
        achievement={selectedPepTalk}
      />
    </>
  );
};

const PepTalkCard = ({
  pepTalk,
  onClick,
}: {
  pepTalk: any;
  onClick: () => void;
}) => {
  const tierColor = tierColors[pepTalk.tier as keyof typeof tierColors] || tierColors.bronze;

  return (
    <Button
      variant="outline"
      className="w-full h-auto p-4 justify-start text-left hover:bg-accent/50"
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{pepTalk.title}</span>
          <Badge className={tierColor}>
            {pepTalk.tier}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {pepTalk.pepTalkDuration && (
            <span>{pepTalk.pepTalkDuration}</span>
          )}
          {pepTalk.pepTalkCategory && (
            <Badge variant="outline" className="capitalize text-xs">
              {pepTalk.pepTalkCategory}
            </Badge>
          )}
          <span className="ml-auto">
            {formatDistanceToNow(new Date(pepTalk.earnedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Button>
  );
};
