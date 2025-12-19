import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useCommunity, CommunityWithMembership } from "@/hooks/useCommunity";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { CommunityCard, PublicCommunityCard } from "@/components/community/CommunityCard";
import { CommunityMembersSection } from "@/components/community/CommunityMembersSection";
import { CommunityInviteSection } from "@/components/community/CommunityInviteSection";
import { CommunityShoutsFeed } from "@/components/community/CommunityShoutsFeed";
import { CreateCommunityDialog } from "@/components/community/CreateCommunityDialog";
import { JoinCommunityDialog } from "@/components/community/JoinCommunityDialog";
import { Plus, UserPlus, Users, Compass, Loader2, ArrowLeft, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Community = () => {
  const { user } = useAuth();
  const { myCommunities, publicCommunities, isLoadingMyCommunities, isLoadingPublic } = useCommunity();
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityWithMembership | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const { leaveCommunity, isLeaving, joinCommunity, isJoining } = useCommunityMembers(selectedCommunity?.id);

  const handleCommunityCreated = (communityId: string) => {
    // Find the newly created community and select it
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
      toast.success("Welcome to the community!");
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
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Community</h1>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJoinDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Join
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="my" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="my" className="gap-2">
              <Users className="h-4 w-4" />
              My Communities
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2">
              <Compass className="h-4 w-4" />
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {isLoadingMyCommunities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !myCommunities || myCommunities.length === 0 ? (
              <EmptyState
                title="No communities yet"
                description="Create your own community or join one with an invite code."
                onCreateClick={() => setShowCreateDialog(true)}
                onJoinClick={() => setShowJoinDialog(true)}
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {myCommunities.map((community, index) => (
                    <motion.div
                      key={community.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <CommunityCard
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
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !publicCommunities || publicCommunities.length === 0 ? (
              <Card className="p-8 text-center">
                <Compass className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2">No public communities yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to create a public community!
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {publicCommunities
                    .filter(c => !myCommunities?.some(mc => mc.id === c.id))
                    .map((community, index) => (
                      <motion.div
                        key={community.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <PublicCommunityCard
                          community={community}
                          onClick={() => handleJoinPublicCommunity(community.id)}
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
  <Card className="p-8 text-center">
    <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground mb-6">{description}</p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-2" />
        Create Community
      </Button>
      <Button variant="outline" onClick={onJoinClick}>
        <UserPlus className="h-4 w-4 mr-2" />
        Join with Code
      </Button>
    </div>
  </Card>
);

interface CommunityDetailViewProps {
  community: CommunityWithMembership;
  onBack: () => void;
  onLeave: () => void;
  isLeaving: boolean;
}

const CommunityDetailView = ({ community, onBack, onLeave, isLeaving }: CommunityDetailViewProps) => {
  const isOwner = community.role === 'owner';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with community color */}
      <div
        className="h-24 relative"
        style={{
          background: `linear-gradient(135deg, ${community.theme_color}, ${community.theme_color}88)`,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 text-white hover:bg-white/20"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {!isOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={onLeave}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>

      {/* Community Info */}
      <div className="max-w-2xl mx-auto px-4 -mt-8">
        <Card className="p-4 mb-6">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg"
              style={{ backgroundColor: community.theme_color }}
            >
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{community.name}</h1>
              {community.description && (
                <p className="text-muted-foreground mt-1">{community.description}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Invite Section */}
        <CommunityInviteSection
          inviteCode={community.invite_code}
          communityName={community.name}
        />

        {/* Shouts Feed */}
        <div className="mt-6">
          <CommunityShoutsFeed communityId={community.id} />
        </div>

        {/* Members Leaderboard */}
        <div className="mt-6">
          <CommunityMembersSection communityId={community.id} maxHeight="400px" />
        </div>
      </div>
    </div>
  );
};

export default Community;
