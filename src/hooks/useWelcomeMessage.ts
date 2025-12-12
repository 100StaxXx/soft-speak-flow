import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { getDocuments, getDocument, setDocument } from "@/lib/firebase/firestore";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

export const useWelcomeMessage = () => {
  const { user } = useAuth();
  const personality = useMentorPersonality();
  const hasChecked = useRef(false);

  useEffect(() => {
    const addWelcomeMessage = async () => {
      if (!user || !personality || hasChecked.current) return;
      hasChecked.current = true;

      // Check if welcome already exists in database
      const existingWelcomes = await getDocuments(
        'activity_feed',
        [
          ['user_id', '==', user.uid],
          ['activity_type', '==', 'welcome'],
        ]
      );
      
      if (existingWelcomes.length > 0) return;

      // Get user's name from profile
      const profile = await getDocument<{
        email: string | null;
        onboarding_data: Record<string, unknown> | null;
      }>('profiles', user.uid);

      const userName = getUserDisplayName(profile) || 'friend';

      // Create welcome message
      const welcomeMessages: Record<string, string> = {
        tough: `Listen up, ${userName}. You're here because you want to change. Good. I don't do hand-holding, but I will push you every single day. Let's see what you're made of.`,
        direct: `Welcome, ${userName}. I'm here to keep you on track, no distractions. We'll build your habits, stay consistent, and get results. Let's get started.`,
        empathetic: `Hey ${userName}, I'm glad you're here. This journey isn't always easy, but you don't have to do it alone. I'll be with you every step of the way. You've got this.`,
        supportive: `Welcome, ${userName}! I'm so excited to be part of your journey. Together, we're going to build something amazing. Remember, progress over perfection. Let's do this!`,
        wise: `Welcome, ${userName}. Every great journey begins with a single step. Today, you took that step. I'll be here to guide you, to listen, and to help you grow.`
      };

      const toneKeyword = personality.tone.toLowerCase();
      let welcomeText = welcomeMessages.supportive;
      
      if (toneKeyword.includes('tough') || toneKeyword.includes('hard')) {
        welcomeText = welcomeMessages.tough;
      } else if (toneKeyword.includes('direct')) {
        welcomeText = welcomeMessages.direct;
      } else if (toneKeyword.includes('empathetic')) {
        welcomeText = welcomeMessages.empathetic;
      } else if (toneKeyword.includes('wise') || toneKeyword.includes('calm')) {
        welcomeText = welcomeMessages.wise;
      }

      // Add welcome to activity feed
      try {
        const welcomeId = `${user.uid}_welcome_${Date.now()}`;
        await setDocument('activity_feed', welcomeId, {
          id: welcomeId,
          user_id: user.uid,
          activity_type: 'welcome',
          activity_data: {},
          mentor_comment: welcomeText,
          is_read: false,
        }, false);
      } catch (error) {
        console.error('Error adding welcome:', error);
      }
    };

    addWelcomeMessage();
  }, [user, personality]);
};
