# Mentor Recommendation System Setup

## Database Structure

The system has been upgraded with:
- **Questionnaire responses table** for storing user answers
- **Enhanced mentor profiles** with personality fields (style, themes, target_user_type, identity_description, welcome_message)
- **AI-powered mentor chat** using Lovable AI

## Sample Mentor Data

To test the system, you can add mentors with these tags in your database:

### Example Mentor 1: "The Warrior"
- **Tags**: `["discipline", "alpha", "tough", "gym", "physical", "athlete"]`
- **Style**: "firm"
- **Themes**: `["discipline", "gym", "physical"]`
- **Target User Type**: "Alpha masculine discipline seekers"
- **Identity Description**: "The Warrior · Unbreakable Discipline"
- **Welcome Message**: "There's no room for excuses here. Only results. Let's forge you into iron."

### Example Mentor 2: "The Sage"
- **Tags**: `["spiritual", "calm", "mindfulness", "wise", "grounded", "reflective"]`
- **Style**: "storytelling"
- **Themes**: `["spiritual", "mindfulness", "peace"]`
- **Target User Type**: "Those seeking spiritual calm and inner peace"
- **Identity Description**: "The Sage · Inner Peace Guide"
- **Welcome Message**: "Peace comes from within. Let me guide you to discover your true center."

### Example Mentor 3: "The Champion"
- **Tags**: `["hype", "energy", "athlete", "competitive", "uplifting", "motivation"]`
- **Style**: "hype"
- **Themes**: `["gym", "athlete", "motivation"]`
- **Target User Type**: "High-energy athletes and competitors"
- **Identity Description**: "The Champion · Relentless Energy"
- **Welcome Message**: "Let's GO! Every day is game day. Time to dominate!"

### Example Mentor 4: "The Strategist"
- **Tags**: `["business", "logical", "strategic", "success", "firm"]`
- **Style**: "logical"
- **Themes**: `["business", "success", "strategy"]`
- **Target User Type**: "Business-minded achievers"
- **Identity Description**: "The Strategist · Calculated Success"
- **Welcome Message**: "Success is a game of strategy. Let's build your empire, one move at a time."

### Example Mentor 5: "The Healer"
- **Tags**: `["heartbreak", "emotional", "calm", "supportive", "gentle", "affirmations"]`
- **Style**: "affirmations"
- **Themes**: `["heartbreak", "emotional", "recovery"]`
- **Target User Type**: "Those healing from heartbreak or emotional pain"
- **Identity Description**: "The Healer · Emotional Recovery"
- **Welcome Message**: "Healing takes time, but you're stronger than you know. I'm here with you."

## How the Matching Works

1. **User takes questionnaire** → Collects tags based on answers
2. **System finds mentors** → Counts overlapping tags with each mentor
3. **Best match selected** → Mentor with most overlapping tags
4. **Reveal experience** → Cinematic mentor introduction
5. **Personalized content** → Home feed shows mentor-specific content

## Testing the Flow

1. Sign up as a new user
2. You'll be redirected to `/onboarding`
3. Answer the 5 questions
4. System matches you with the best mentor
5. Experience the cinematic reveal
6. Enter your personalized home screen
7. Chat with your mentor using AI
8. Retake the quiz or browse other mentors anytime

## Features Implemented

✅ Guided questionnaire with 5 questions
✅ Tag-based mentor matching algorithm
✅ Cinematic "Meet Your Mentor" reveal page
✅ AI-powered mentor chat (using Lovable AI)
✅ Enhanced home screen with:
  - Daily Quote
  - Daily Lesson
  - Ask Your Mentor chat
  - Browse Other Mentors
  - Retake Quiz option
  - Category exploration
✅ Power Mode for intensity adjustment
✅ Masculine design system throughout
✅ Mentor-specific content personalization
