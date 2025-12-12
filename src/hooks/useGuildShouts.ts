import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument, updateDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useEffect } from "react";
import { getShoutByKey, ShoutType } from "@/data/shoutMessages";
import { getUserDisplayName } from "@/utils/getUserDisplayName";
import { onSnapshot, query, where, collection, orderBy, limit } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export interface GuildShout {
  id: string;
  epic_id: string;
  sender_id: string;
  recipient_id: string;
  shout_type: ShoutType;
  message_key: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    email: string | null;
    onboarding_data?: unknown;
  };
  recipient?: {
    email: string | null;
    onboarding_data?: unknown;
  };
}

export const useGuildShouts = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch shouts for an epic
  const { data: shouts, isLoading } = useQuery<GuildShout[]>({
    queryKey: ["guild-shouts", epicId],
    queryFn: async () => {
      if (!epicId) return [];

      const shoutsData = await getDocuments<GuildShout>(
        "guild_shouts",
        [["epic_id", "==", epicId]],
        "created_at",
        "desc",
        50
      );

      // Fetch sender and recipient profiles
      const shoutsWithProfiles = await Promise.all(
        shoutsData.map(async (shout) => {
          const [sender, recipient] = await Promise.all([
            getDocument<{ email: string | null; onboarding_data?: unknown }>("profiles", shout.sender_id),
            getDocument<{ email: string | null; onboarding_data?: unknown }>("profiles", shout.recipient_id),
          ]);

          return {
            ...shout,
            created_at: timestampToISO(shout.created_at as any) || shout.created_at || new Date().toISOString(),
            sender: sender || undefined,
            recipient: recipient || undefined,
          };
        })
      );

      return shoutsWithProfiles;
    },
    enabled: !!epicId,
  });

  // Send a shout
  const sendShout = useMutation({
    mutationFn: async ({
      recipientId,
      shoutType,
      messageKey,
    }: {
      recipientId: string;
      shoutType: ShoutType;
      messageKey: string;
    }) => {
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      // Prevent sending shouts to yourself
      if (recipientId === user.uid) {
        throw new Error("You cannot send a shout to yourself");
      }

      const shoutId = `${epicId}_${user.uid}_${recipientId}_${Date.now()}`;
      const shoutData = {
        id: shoutId,
        epic_id: epicId,
        sender_id: user.uid,
        recipient_id: recipientId,
        shout_type: shoutType,
        message_key: messageKey,
        is_read: false,
      };

      await setDocument("guild_shouts", shoutId, shoutData, false);

      // Trigger push notification (fire and forget)
      const message = getShoutByKey(messageKey);
      
      // Fetch current user's profile to get their display name
      const userProfile = await getDocument<{ email: string | null; onboarding_data?: unknown }>("profiles", user.uid);
      
      const senderName = getUserDisplayName(userProfile);
      
      // TODO: Migrate to Firebase Cloud Function
      // fetch('https://YOUR-FIREBASE-FUNCTION/send-shout-notification', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     shoutId,
      //     senderId: user.uid,
      //     recipientId,
      //     epicId,
      //     senderName,
      //     shoutType,
      //     messageText: message?.text || 'Someone sent you a shout!',
      //   }),
      // }).catch(err => console.error('Push notification failed:', err));

      return shoutData as GuildShout;
    },
    onSuccess: (_, variables) => {
      const message = getShoutByKey(variables.messageKey);
      toast.success(`Shout sent! ${message?.emoji || '📢'}`);
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
    },
    onError: (error) => {
      toast.error("Failed to send shout");
      console.error("Shout error:", error);
    },
  });

  // Mark shouts as read
  const markAsRead = useMutation({
    mutationFn: async (shoutIds: string[]) => {
      if (!user) return;

      // Update each shout individually (Firestore doesn't support batch updates with filters)
      await Promise.all(
        shoutIds.map(async (shoutId) => {
          const shout = await getDocument<{ recipient_id: string }>("guild_shouts", shoutId);
          if (shout && shout.recipient_id === user.uid) {
            await updateDocument("guild_shouts", shoutId, { is_read: true });
          }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
    },
  });

  // Real-time subscription - only subscribe when we have both epicId and authenticated user
  useEffect(() => {
    if (!epicId) return;
    if (!user?.uid) return; // Wait for auth

    let isSubscribed = true;

    const shoutsQuery = query(
      collection(firebaseDb, "guild_shouts"),
      where("epic_id", "==", epicId),
      orderBy("created_at", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(shoutsQuery, (snapshot) => {
      if (!isSubscribed) return;
      
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
      
      // Show toast for new received shouts
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const shout = change.doc.data() as GuildShout;
          if (shout.recipient_id === user?.uid) {
            const message = getShoutByKey(shout.message_key);
            toast.info(`New shout: ${message?.emoji} ${message?.text || 'Someone sent you a shout!'}`);
          }
        }
      });
    }, (error: unknown) => {
      // Handle permission errors gracefully
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'permission-denied') {
        console.warn('Guild shouts: Permission denied');
      } else {
        console.warn('Guild shouts subscription error:', error);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [epicId, user?.uid, queryClient]);

  const unreadCount = shouts?.filter(s => s.recipient_id === user?.uid && !s.is_read).length || 0;
  const myShouts = shouts?.filter(s => s.recipient_id === user?.uid) || [];

  return {
    shouts,
    myShouts,
    unreadCount,
    isLoading,
    sendShout,
    markAsRead,
    isSending: sendShout.isPending,
  };
};
