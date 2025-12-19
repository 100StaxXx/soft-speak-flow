import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useCommunity, CommunityWithMembership } from "@/hooks/useCommunity";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { GuildCard, PublicGuildCard, GuildDetailHeader, GuildParticles } from "@/components/guild";
import { CommunityMembersSection } from "@/components/community/CommunityMembersSection";
import { CommunityInviteSection } from "@/components/community/CommunityInviteSection";
import { CommunityShoutsFeed } from "@/components/community/CommunityShoutsFeed";
import { CreateCommunityDialog } from "@/components/community/CreateCommunityDialog";
import { JoinCommunityDialog } from "@/components/community/JoinCommunityDialog";
import { CommunityTutorialModal } from "@/components/community/CommunityTutorialModal";
import { BottomNav } from "@/components/BottomNav";
import { Plus, UserPlus, Users, Compass, Loader2, Sparkles, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Community = () => {
  const { user } = useAuth();
  const { myCommunities, publicCommunities, isLoadingMyCommunities, isLoadingPublic } = useCommunity();
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityWithMembership | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('guilds');

  const { leaveCommunity, isLeaving, joinCommunity, isJoining, members } = useCommunityMembers(selectedCommunity?.id);

  const handleCommunityCreated = (communityId: string) => {
    setTimeout(() => {
      const newCommunity = myCommunities?.find(c => c.id === communityId);
      if (newCommunity) {
        setSelectedCommunity(newCommunity);
      }
    }, 500);
  };

  const handleJoinSuccess = (communityId: string) => {
    setTimeout(() => {
      const joinedCommunity = myCommunities?.find(c => c.id === communityId);
      if (joinedCommunity) {
        setSelectedCommunity(joinedCommunity);
      }
    }, 500);
  };

  const handleLeaveCommunity = async () => {
    if (!selectedCommunity) return;
    
    try {
      await leaveCommunity.mutateAsync(selectedCommunity.id);
      setSelectedCommunity(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleJoinPublicCommunity = async (communityId: string) => {
    try {
      await joinCommunity.mutateAsync(communityId);
      toast.success("Welcome to the guild!");
    } catch (error) {
      // Error handled by hook
    }
  };

  // Show selected community detail view
  if (selectedCommunity) {
    return (
      <CommunityDetailView
        community={selectedCommunity}
        onBack={() => setSelectedCommunity(null)}
        onLeave={handleLeaveCommunity}
        isLeaving={isLeaving}
        memberCount={members?.length}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-hidden">
      {/* Ambient background particles */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <GuildParticles effect="stars" intensity="low" />
      </div>
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="h-7 w-7 text-primary" />
                <Sparkles className="h-3 w-3 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Guilds
              </h1>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJoinDialog(true)}
                className="border-border/50 hover:border-primary/50 hover:bg-primary/10"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Join
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
        <Tabs defaultValue="my" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="my" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md">
              <Users className="h-4 w-4" />
              My Guilds
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md">
              <Compass className="h-4 w-4" />
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {isLoadingMyCommunities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !myCommunities || myCommunities.length === 0 ? (
              <EmptyState
                title="No guilds yet"
                description="Create your own guild or join one with an invite code."
                onCreateClick={() => setShowCreateDialog(true)}
                onJoinClick={() => setShowJoinDialog(true)}
              />
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {myCommunities.map((community, index) => (
                    <motion.div
                      key={community.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.08, type: "spring", stiffness: 300 }}
                    >
                      <GuildCard
                        community={community}
                        onClick={() => setSelectedCommunity(community)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover">
            {isLoadingPublic ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !publicCommunities || publicCommunities.length === 0 ? (
              <Card className="p-8 text-center guild-glass">
                <Compass className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2">No public guilds yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to create a public guild!
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {publicCommunities
                    .filter(c => !myCommunities?.some(mc => mc.id === c.id))
                    .map((community, index) => (
                      <motion.div
                        key={community.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: index * 0.08, type: "spring", stiffness: 300 }}
                      >
                        <PublicGuildCard
                          community={community}
                          onClick={() => handleJoinPublicCommunity(community.id)}
                          isJoining={isJoining}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCommunityCreated}
      />
      <JoinCommunityDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        onSuccess={handleJoinSuccess}
      />
      <CommunityTutorialModal open={showTutorial} onClose={dismissTutorial} />
      <BottomNav />
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  onCreateClick: () => void;
  onJoinClick: () => void;
}

const EmptyState = ({ title, description, onCreateClick, onJoinClick }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <Card className="p-8 text-center guild-glass-intense relative overflow-hidden">
      {/* Background particles */}
      <GuildParticles effect="divine" intensity="low" />
      
      <Shield className="h-16 w-16 mx-auto mb-4 text-primary/30" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={onCreateClick} className="shadow-lg shadow-primary/25">
          <Plus className="h-4 w-4 mr-2" />
          Create Guild
        </Button>
        <Button variant="outline" onClick={onJoinClick} className="border-border/50">
          <UserPlus className="h-4 w-4 mr-2" />
          Join with Code
        </Button>
      </div>
    </Card>
  </motion.div>
);

interface CommunityDetailViewProps {
  community: CommunityWithMembership;
  onBack: () => void;
  onLeave: () => void;
  isLeaving: boolean;
  memberCount?: number;
}

const CommunityDetailView = ({ community, onBack, onLeave, isLeaving, memberCount }: CommunityDetailViewProps) => {
  const isOwner = community.role === 'owner';

  return (
    <div className="min-h-screen bg-background pb-24 relative">
      {/* Guild Detail Header */}
      <GuildDetailHeader
        name={community.name}
        description={community.description}
        themeColor={community.theme_color}
        bannerStyle={community.banner_style}
        emblemIcon={community.emblem_icon}
        glowEffect={community.glow_effect}
        particleEffect={community.particle_effect}
        isOwner={isOwner}
        onBack={onBack}
        onLeave={onLeave}
        isLeaving={isLeaving}
        memberCount={memberCount}
      />

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Invite Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CommunityInviteSection
            inviteCode={community.invite_code}
            communityName={community.name}
          />
        </motion.div>

        {/* Shouts Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <CommunityShoutsFeed communityId={community.id} />
        </motion.div>

        {/* Members Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CommunityMembersSection communityId={community.id} maxHeight="400px" />
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Community;
