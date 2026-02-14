/**
 * Fallback responses for when AI mentor chat fails
 * Provides contextual, helpful responses based on user message and mentor tone
 */

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
  if (isTough) {
    return "Consistency isn't built overnight. Track your habits daily, hold yourself accountable, and don't make excuses. Small actions compound over time - but only if you show up.";
  }
  if (isEmpathetic) {
    return "Building habits takes time and patience. Start with one small habit and be gentle with yourself when you miss a day. What matters is that you keep coming back. You're doing great!";
  }
  return "The key to building strong habits is consistency. Start small - even 5 minutes a day makes a difference. Track your progress and celebrate small wins along the way.";
}

function getMotivationResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "You don't need motivation - you need discipline. Motivation fades, but habits and systems last. Stop waiting to feel ready and start taking action now.";
  }
  if (isEmpathetic) {
    return "I know it can be tough sometimes. Remember why you started this journey. You have everything you need within you to succeed. Take a deep breath and tackle one small thing today.";
  }
  return "Every expert was once a beginner. Focus on progress, not perfection. Each step forward, no matter how small, is moving you closer to your goals.";
}

function getStartDayResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "Stop overthinking and start doing. Plan your top 3 priorities and execute them. No distractions, no excuses. Your future self will thank you.";
  }
  if (isEmpathetic) {
    return "Good morning! Today is a fresh start full of possibilities. Take a moment to set a clear intention for what you want to accomplish. You've got this!";
  }
  return "Start your day with clarity. Choose your top 3 priorities and tackle them first. Build momentum with small wins and maintain that energy throughout the day.";
}

function getReflectionResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "Be honest with yourself. What actually got done today versus what you planned? Learn from it and adjust tomorrow. No sugar-coating - just honest assessment leads to real growth.";
  }
  if (isEmpathetic) {
    return "Take a moment to appreciate what you accomplished today. Even small victories count. What did you learn? What are you grateful for? Rest well - you earned it.";
  }
  return "Reflection is powerful. Think about what worked well today and what you'd do differently. Each day is a learning opportunity. What's one insight you can carry forward?";
}

function getStruggleResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "Struggling means you're pushing your limits - that's good. The question is: will you push through or give up? Discomfort is where growth happens. Keep going.";
  }
  if (isEmpathetic) {
    return "It's okay to struggle - it means you're challenging yourself. Be kind to yourself during difficult times. Break things down into smaller steps and ask for help when needed. You're stronger than you think.";
  }
  return "Challenges are part of growth. When things feel hard, break them into smaller, manageable steps. Focus on what you can control and take it one step at a time.";
}

function getGoalResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "Goals without action are just wishes. Break your goal into concrete steps and start executing today. Track your progress ruthlessly and adjust as needed.";
  }
  if (isEmpathetic) {
    return "Your goals are within reach. Start by making them specific and achievable. Celebrate each milestone along the way. Remember - progress over perfection!";
  }
  return "Clear goals drive focused action. Make your goals specific, measurable, and break them into weekly milestones. Review regularly and adjust your approach based on what you learn.";
}

function getDefaultResponse(isTough: boolean, isEmpathetic: boolean): string {
  if (isTough) {
    return "I hear you. Remember - you're capable of more than you think. The path forward is action, not overthinking. What's one concrete step you can take right now?";
  }
  if (isEmpathetic) {
    return "Thank you for sharing with me. You're on a meaningful journey of growth. Whatever you're facing, remember that small consistent steps lead to big changes. What feels most important to focus on right now?";
  }
  return "I understand. Progress comes from consistent effort in the right direction. Focus on what you can control, take one step at a time, and trust the process. What's your next move?";
}

/**
 * Get a connection error fallback message
 */
export const getConnectionErrorFallback = (_mentorName: string): FallbackResponse => {
  return {
    content: `I'm having trouble connecting right now, but I'm here for you. While we work on restoring the connection, remember: you already have the strength and wisdom within you to move forward. Trust yourself and take action on what you know you need to do.`,
    isFallback: true
  };
};

/**
 * Get a rate limit fallback message
 */
export const getRateLimitFallback = (_mentorName: string): FallbackResponse => {
  return {
    content: `You've been very active today - that's great commitment! While you've reached today's message limit, use this time to take action on the guidance we've discussed. Sometimes doing is more powerful than talking about doing. See you tomorrow!`,
    isFallback: true
  };
};
