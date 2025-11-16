import { useMentorPersonality } from "@/hooks/useMentorPersonality";

interface ContextualTextProps {
  type: 'button' | 'empty' | 'encouragement' | 'nudge';
  context?: string;
  action?: string;
  fallback: string;
}

export const ContextualText = ({ type, context = '', action = '', fallback }: ContextualTextProps) => {
  const personality = useMentorPersonality();

  if (!personality) return <>{fallback}</>;

  switch (type) {
    case 'button':
      return <>{personality.buttonText(action || fallback)}</>;
    case 'empty':
      return <>{personality.emptyState(context || fallback)}</>;
    case 'encouragement':
      return <>{personality.encouragement()}</>;
    case 'nudge':
      return <>{personality.nudge()}</>;
    default:
      return <>{fallback}</>;
  }
};
