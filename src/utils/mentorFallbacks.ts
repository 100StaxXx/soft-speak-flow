/**
 * Fallback responses for when AI mentor chat fails
 * Provides contextual, helpful responses based on user message and mentor tone
 */

import { PRODUCT } from "@/config/product";

const IS_GRACEWARD = PRODUCT.mode === "christian";

export interface FallbackResponse {
  content: string;
  isFallback: true;
}

/**
 * Get a contextual fallback response based on user message and mentor tone
 */
export const getFallbackResponse = (
  userMessage: string,
  _mentorName: string,
  mentorTone: string
): FallbackResponse => {
  const lowerMessage = userMessage.toLowerCase();
  const isTough = /tough|direct/i.test(mentorTone);
  const isEmpathetic = /empathetic|supportive/i.test(mentorTone);

  // Context-specific responses
  if (lowerMessage.includes('habit') || lowerMessage.includes('consistent')) {
    return {
      content: getHabitResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  if (lowerMessage.includes('motivat') || lowerMessage.includes('boost') || lowerMessage.includes('encourage')) {
    return {
      content: getMotivationResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  if (lowerMessage.includes('start') || lowerMessage.includes('begin') || lowerMessage.includes('day')) {
    return {
      content: getStartDayResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  if (lowerMessage.includes('reflect') || lowerMessage.includes('think') || lowerMessage.includes('today')) {
    return {
      content: getReflectionResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  if (lowerMessage.includes('struggle') || lowerMessage.includes('hard') || lowerMessage.includes('difficult')) {
    return {
      content: getStruggleResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  if (lowerMessage.includes('goal') || lowerMessage.includes('challenge') || lowerMessage.includes('improve')) {
    return {
      content: getGoalResponse(isTough, isEmpathetic),
      isFallback: true
    };
  }

  // Default fallback response
  return {
    content: getDefaultResponse(isTough, isEmpathetic),
    isFallback: true
  };
};

function getHabitResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "Consistency is built one choice at a time. Choose one small action you can honestly keep today and follow through without excuses.";
    if (isEmpathetic) return "Growth takes patience. Start with one small action, learn from missed days, and begin again. What is one practical step you can take today?";
    return "Start small and make the action easy to repeat. Choose one useful practice for today and let consistency grow from there.";
  }
  if (isTough) {
    return "Faithfulness is built one choice at a time. Choose one small practice you can honestly keep today, ask God for help, and follow through without excuses.";
  }
  if (isEmpathetic) {
    return "Growth takes patience. Start with one small practice, receive God's grace when you miss a day, and begin again. What is one faithful step you can take today?";
  }
  return "Start small and stay faithful. Even five quiet minutes of prayer, Scripture, or a needed act of care can matter. Choose one practice for today and let consistency grow from there.";
}

function getMotivationResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "You may not feel ready, but you can still act. Choose the next useful step and do it now without waiting for perfect motivation.";
    if (isEmpathetic) return "This may feel heavy, and you do not have to solve it all at once. Take a breath and choose one gentle next step for today.";
    return "You do not need perfection to move forward. Pick the next small step you can control and take it with patience and courage.";
  }
  if (isTough) {
    return "You may not feel ready, but you can still act faithfully. Ask God for strength, choose the next right step, and do it now without waiting for perfect motivation.";
  }
  if (isEmpathetic) {
    return "This may feel heavy, and you do not have to carry it alone. Take a breath, ask God for the help you need, and choose one gentle next step for today.";
  }
  return "You do not need perfection to move forward. Offer God the next small step you can take, then take it with patience and courage.";
}

function getStartDayResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "Stop circling the day. Name the one responsibility that matters most and begin it before distraction takes over.";
    if (isEmpathetic) return "Today is a fresh start. Name what matters most and begin with one manageable step.";
    return "Begin with clarity. Choose one important responsibility, one act of care, and one moment of rest; then take the first step.";
  }
  if (isTough) {
    return "Stop circling the day. Pray briefly, name the one responsibility that matters most, and begin it before distraction takes over.";
  }
  if (isEmpathetic) {
    return "Today is a fresh mercy. Take a quiet moment with God, name what matters most, and begin with one manageable step.";
  }
  return "Begin with prayer and clarity. Choose one important responsibility, one act of care, and one moment of rest; then take the first step.";
}

function getReflectionResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "Be honest: where did you follow through, and where did you avoid what mattered? Learn from it and name one change for tomorrow.";
    if (isEmpathetic) return "Take a quiet moment to notice what supported you today. What are you grateful for, what did you learn, and what can you release before you rest?";
    return "Reflect with honesty: what worked today, what needs repair, and what can wait until tomorrow?";
  }
  if (isTough) {
    return "Be honest before God: where were you faithful, and where did you avoid what mattered? Receive grace, learn from it, and name one change for tomorrow.";
  }
  if (isEmpathetic) {
    return "Take a quiet moment to notice God's care today. What are you grateful for, what did you learn, and what can you release before you rest?";
  }
  return "Reflect with honesty and grace: what bore good fruit today, what needs repair, and what can you entrust to God tonight?";
}

function getStruggleResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "Struggle is information, not a verdict. Name what is in your control, ask for help where you need it, and take the next useful step.";
    if (isEmpathetic) return "It is okay to admit this is hard. You do not have to carry it alone. What is one small step—or one person you can contact—right now?";
    return "When things feel hard, separate what you can control from what you cannot and take one manageable step. Focus on what is yours to do today.";
  }
  if (isTough) {
    return "Struggle is not proof that God has left you. Name what is actually in your control, ask for help where you need it, and take the next faithful step.";
  }
  if (isEmpathetic) {
    return "It is okay to admit this is hard. God meets us in weakness, and trusted people can help carry the load. What is one small step—or one person you can contact—right now?";
  }
  return "When things feel hard, bring the truth to God and break the burden into one manageable step. Focus on what is yours to do today and release the rest.";
}

function getGoalResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "A good intention still needs action. Test the goal against what matters, choose one concrete step, and do it today.";
    if (isEmpathetic) return "Make the next step small and honest, and let steady progress matter more than perfection.";
    return "Check whether this goal still serves what matters most, then choose one clear next step. Review what works and adjust without shame.";
  }
  if (isTough) {
    return "A good intention still needs faithful action. Test the goal against what matters, choose one concrete step, and do it today.";
  }
  if (isEmpathetic) {
    return "Hold the goal with open hands. Make the next step small and honest, invite God into it, and let steady faithfulness matter more than perfection.";
  }
  return "Discern whether this goal serves what matters most, then choose one clear next step. Review the fruit as you go and adjust without shame.";
}

function getDefaultResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (!IS_GRACEWARD) {
    if (isTough) return "I hear you. Stop circling it: what is one useful action you can take right now?";
    if (isEmpathetic) return "Thank you for sharing this. Take a breath and notice what feels most important to tend right now.";
    return "I understand. Set aside what you cannot control and take one honest step with what is in front of you. What is your next move?";
  }
  if (isTough) {
    return "I hear you. Bring this honestly to God, then stop circling it: what is one faithful action you can take right now?";
  }
  if (isEmpathetic) {
    return "Thank you for sharing this. You are not alone in it. Take a breath, ask God for wisdom, and notice what feels most important to tend right now.";
  }
  return "I understand. Bring what you cannot control to God, then take one honest step with what has been placed in your care. What is your next move?";
}

/**
 * Get a connection error fallback message
 */
export const getConnectionErrorFallback = (_mentorName: string): FallbackResponse => {
  return {
    content: IS_GRACEWARD
      ? "Live guidance is unavailable right now. Pause, bring what is on your mind to God, and choose the next faithful step you already know to take. You can return here when the connection is restored."
      : "Live guidance is unavailable right now. Pause, notice what is in your control, and choose the next useful step you already know to take. You can return here when the connection is restored.",
    isFallback: true
  };
};

/**
 * Get a rate limit fallback message
 */
export const getRateLimitFallback = (_mentorName: string): FallbackResponse => {
  return {
    content: IS_GRACEWARD
      ? "You've reached today's Guide conversation limit. Use this pause to pray, revisit the guidance you already received, and take one faithful step. You can return tomorrow."
      : "You've reached today's Guide conversation limit. Use this pause to revisit the guidance you already received and take one practical step. You can return tomorrow.",
    isFallback: true
  };
};
