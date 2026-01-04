import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Sparkles, 
  Swords, 
  Users, 
  Target, 
  MessageCircle, 
  Zap, 
  Gift, 
  BookOpen, 
  Settings, 
  HelpCircle,
  Star,
  Crown,
  Shield,
  Bell,
  ChevronRight,
  Map,
  Heart,
  TrendingUp,
  Calendar
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { haptics } from "@/utils/haptics";

const HelpCenter = () => {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Star,
      color: "text-amber-400",
      items: [
        {
          title: "What is Cosmiq?",
          content: "Cosmiq is your personal growth companion app that combines mentorship, habit tracking, and a gamified companion system. Your journey is guided by mentors who provide personalized wisdom, while your companion evolves as you complete daily quests and build positive habits. Think of it as having a wise mentor and a loyal sidekick helping you become your best self."
        },
        {
          title: "How does my Companion work?",
          content: "Your companion is a mystical creature that grows alongside you. As you complete quests, habits, and engage with the app, your companion earns XP and evolves through 21 unique stages. Each evolution unlocks new visual forms and represents your personal growth. Your companion's appearance reflects your journey—nurture it with consistent effort and watch it transform!"
        },
        {
          title: "Understanding XP & Evolution",
          content: "XP (Experience Points) is earned by completing quests, habits, and interacting with your mentor. Your companion needs specific XP thresholds to evolve to each new stage. Streak multipliers boost your XP gains—the longer your daily streak, the more XP you earn. Completing your Main Quest each day gives 3x XP bonus!"
        },
        {
          title: "What are Factions?",
          content: "During onboarding, you're assigned to one of four factions based on your personality: Luminary (visionary leaders), Sentinel (protectors and guardians), Wanderer (free spirits and explorers), or Sage (wisdom seekers). Your faction reflects your core traits and influences your journey's flavor."
        }
      ]
    },
    {
      id: "companion",
      title: "Your Companion",
      icon: Sparkles,
      color: "text-primary",
      items: [
        {
          title: "Evolution Stages",
          content: "Your companion evolves through 21 distinct stages, from a tiny spark to a majestic cosmic being. Each stage has unique artwork that's generated based on your companion's species and personality. When your companion reaches the required XP threshold, an 'Evolve Now' button appears on the Companion page—tap it when you're ready to witness the transformation!"
        },
        {
          title: "Earning XP",
          content: "Gain XP through: completing daily quests (10-50 XP each), maintaining habit streaks (bonus XP per day), completing your Main Quest (3x XP multiplier), and engaging with your mentor. Consistency is key—daily engagement compounds your growth!"
        },
        {
          title: "Companion Skins",
          content: "Unlock exclusive cosmetic skins for your companion through the referral program. When friends you refer reach Stage 3, you earn rare skin variants. Skins are purely cosmetic and change your companion's visual effects—frames, glows, and particle effects. Check your collection in Command Center."
        },
        {
          title: "Postcards & Stories",
          content: "As your companion evolves, it generates postcards—illustrated snapshots of your journey together. These chronicle your growth milestones and create a visual diary of your transformation. View your postcard collection on the Companion page."
        },
        {
          title: "Resetting Your Companion",
          content: "Want to start fresh? You can reset your companion in Command Center. This creates a new companion from scratch, but your account progress (mentors, settings) remains. Use this if you want to experience a different companion species or start the evolution journey again."
        }
      ]
    },
    {
      id: "quests",
      title: "Quests & Tasks",
      icon: Swords,
      color: "text-orange-400",
      items: [
        {
          title: "Daily Quests",
          content: "Each day you receive a set of quests—tasks ranging from self-reflection to productivity goals. Complete them to earn XP for your companion. Quests refresh daily at midnight in your timezone. Tap a quest to mark it complete and watch your XP grow!"
        },
        {
          title: "Main Quest Bonus",
          content: "One quest each day is marked as your 'Main Quest' with a special badge. Completing your Main Quest grants 3x the normal XP! This encourages you to prioritize your most important daily goal. Your Main Quest is highlighted at the top of your quest list."
        },
        {
          title: "Streak Multipliers",
          content: "Build a daily streak by completing at least one quest each day. Your streak multiplier increases your XP earnings: 7 days = 1.5x, 14 days = 2x, 30 days = 2.5x, 60+ days = 3x. Breaking your streak resets the multiplier, so consistency pays off!"
        },
        {
          title: "Custom Tasks",
          content: "Create your own tasks with the + button. Set difficulty levels (easy, medium, hard) which affect XP rewards. You can also schedule tasks for specific times and set reminders to help you stay on track."
        },
        {
          title: "Recurring Tasks",
          content: "Set tasks to repeat daily or on specific days of the week. Great for habits you want to build like 'Morning meditation' or 'Weekly review'. Recurring tasks appear automatically on scheduled days."
        }
      ]
    },
    {
      id: "epics",
      title: "Epics & Star Paths",
      icon: Target,
      color: "text-purple-400",
      items: [
        {
          title: "What are Epics?",
          content: "Epics are long-term goals with multiple milestones. Create an Epic for big objectives like 'Learn Spanish' or 'Run a Marathon'. Attach daily habits to your Epic, and as you complete them, your Epic progress grows. Reaching milestones unlocks story chapters and rewards."
        },
        {
          title: "Star Paths",
          content: "Star Paths are pre-designed Epics created by the Cosmiq team. They're curated journeys for common goals—stress reduction, fitness transformation, creative projects, and more. Start a Star Path for guided structure, or create custom Epics for personal goals."
        },
        {
          title: "Epic Stories",
          content: "Each Epic generates a unique narrative as you progress. Reach milestones to unlock story chapters featuring your companion. Complete an Epic to receive a final 'book' summarizing your journey—a keepsake of your achievement."
        },
        {
          title: "Shared Epics",
          content: "Invite friends to join your Epic with an invite code. Work toward goals together—everyone's progress contributes to shared milestones. See your guild's collective journey and encourage each other along the way."
        }
      ]
    },
    {
      id: "habits",
      title: "Habits",
      icon: TrendingUp,
      color: "text-green-400",
      items: [
        {
          title: "Creating Habits",
          content: "Habits are daily practices you want to build. Create habits like 'Drink 8 glasses of water' or 'Read for 20 minutes'. Set frequency (daily, specific days) and preferred time. Completing habits earns XP and builds your streak."
        },
        {
          title: "Habit Streaks",
          content: "Each habit tracks its own streak. Completing a habit on schedule extends its streak. Long streaks unlock bonus XP and contribute to your overall streak multiplier. The app shows your current and longest streak for each habit."
        },
        {
          title: "Habit Reminders",
          content: "Enable reminders for individual habits. Set how many minutes before your preferred time you want to be notified. Reminders help build consistency—the key to lasting habit formation."
        },
        {
          title: "Linking to Epics",
          content: "Connect habits to Epics to track progress toward bigger goals. When you complete a linked habit, it contributes to your Epic's milestone progress. This connects daily actions to long-term achievements."
        }
      ]
    },
    {
      id: "mentors",
      title: "Mentors",
      icon: MessageCircle,
      color: "text-blue-400",
      items: [
        {
          title: "Choosing a Mentor",
          content: "Cosmiq offers multiple mentors, each with unique personalities and wisdom styles. From stoic philosophers to motivational coaches, find a mentor whose voice resonates with you. Browse all mentors in Command Center or retake the mentor quiz for a new recommendation."
        },
        {
          title: "Mentor Chat",
          content: "Have conversations with your mentor anytime. Ask for advice, share your struggles, or seek wisdom. Your mentor responds in their unique voice and remembers your context. Access chat from the Mentor tab or Quick Chat prompts."
        },
        {
          title: "Quick Chat Prompts",
          content: "Don't know what to ask? Use Quick Chat prompts—pre-written conversation starters covering common situations. Tap a prompt to instantly start a focused conversation with your mentor. Find prompts on the Mentor page."
        },
        {
          title: "Daily Nudges",
          content: "Receive personalized push notifications from your mentor throughout the day. These contextual messages offer encouragement, reminders, and wisdom based on your activity. Configure nudge frequency and timing in Command Center notifications."
        },
        {
          title: "Switching Mentors",
          content: "Change your mentor anytime in Command Center. Your conversation history and progress are preserved—only the mentor's voice and personality change. Experiment to find the mentor that best supports your current needs."
        }
      ]
    },
    {
      id: "guilds",
      title: "Guilds & Community",
      icon: Users,
      color: "text-cyan-400",
      items: [
        {
          title: "Joining Guilds",
          content: "Guilds are communities of Cosmiq users working toward common goals. Join public guilds or create private ones for friends. Guild members can see each other's progress and encourage one another."
        },
        {
          title: "Guild Features",
          content: "In guilds, you can: view member activity and streaks, send 'shouts' to encourage others, set friendly rivalries for motivation, and collaborate on Shared Epics. Guilds add a social layer to your personal growth journey."
        },
        {
          title: "Creating a Guild",
          content: "Start your own guild with a custom name, description, and theme. Invite friends via invite code or make it public for anyone to join. As the owner, you can customize the guild's appearance and manage members."
        },
        {
          title: "Guild Stories",
          content: "Active guilds generate collective story chapters as members reach milestones together. These narratives feature all guild members' companions and celebrate shared achievements."
        }
      ]
    },
    {
      id: "referrals",
      title: "Referrals & Rewards",
      icon: Gift,
      color: "text-pink-400",
      items: [
        {
          title: "Your Referral Code",
          content: "Every user has a unique referral code found in Command Center. Share this code with friends when they sign up. When they enter your code during registration, they're tagged as your referral."
        },
        {
          title: "Earning Rewards",
          content: "When a friend you referred reaches Stage 3 with their companion, you automatically unlock an exclusive companion skin. Refer more friends to unlock rarer skins. Rewards are purely cosmetic—no gameplay advantages."
        },
        {
          title: "Redeeming Codes",
          content: "New users can enter a friend's referral code in Command Center. This tags you as their referral but doesn't unlock anything for you—the referrer earns the reward when you reach Stage 3. It's a way to credit the friend who introduced you!"
        },
        {
          title: "Available Skins",
          content: "View all referral skins (locked and unlocked) in Command Center under Companion Skins. Each skin offers unique visual effects: frames, glows, and particles. Some skins are ultra-rare and require multiple referrals."
        }
      ]
    },
    {
      id: "astrology",
      title: "Cosmiq Insight",
      icon: Star,
      color: "text-indigo-400",
      items: [
        {
          title: "Your Cosmic Profile",
          content: "Cosmiq calculates your astrological placements based on your birthdate, time, and location. Your profile includes Sun, Moon, Rising, Mercury, Venus, and Mars signs—each influencing different aspects of your personality."
        },
        {
          title: "Placement Deep Dives",
          content: "Tap any placement on your Horoscope page to explore its meaning in depth. Learn how each sign influences that area of your life. Personalized insights explain what each placement means for you."
        },
        {
          title: "Daily Horoscope",
          content: "Receive personalized daily horoscope readings based on your cosmic profile. These aren't generic—they're tailored to your specific placements and current planetary transits."
        },
        {
          title: "Updating Birth Info",
          content: "If you entered incorrect birth details, update them in Command Center → Preferences → Astrology Settings. Your cosmic profile regenerates with accurate placements. Birth time is optional but provides more detailed Rising and house placements."
        }
      ]
    },
    {
      id: "library",
      title: "Library & Recaps",
      icon: BookOpen,
      color: "text-emerald-400",
      items: [
        {
          title: "Saving Favorites",
          content: "Found a quote or pep talk you love? Tap the heart icon to save it to your Library. Access saved content anytime from Command Center → Library. Build a personal collection of wisdom that resonates with you."
        },
        {
          title: "Downloads",
          content: "Some content can be downloaded for offline access. Downloaded items appear in your Library and remain available without internet connection. Perfect for accessing mentor wisdom on the go."
        },
        {
          title: "Weekly Recaps",
          content: "Every week, Cosmiq generates a recap of your activity—quests completed, habits maintained, XP earned, and companion progress. Recaps include mentor reflections on your week and encouragement for the week ahead."
        },
        {
          title: "Past Recaps",
          content: "View previous weekly recaps in Command Center → Weekly Recaps. Track your growth over time by comparing weeks. See patterns in your productivity and celebrate consistent progress."
        }
      ]
    },
    {
      id: "settings",
      title: "Account & Settings",
      icon: Settings,
      color: "text-slate-400",
      items: [
        {
          title: "Notification Settings",
          content: "Configure push notifications in Command Center → Notifications. Set preferences for mentor nudges, daily quotes, habit reminders, and more. Choose your preferred time windows and frequency."
        },
        {
          title: "Sound Settings",
          content: "Toggle ambient music, sound effects, and haptic feedback in Command Center → Preferences. Customize your sensory experience or go silent for focused sessions."
        },
        {
          title: "Subscription Management",
          content: "View and manage your premium subscription in Command Center → Account. See your current plan, billing cycle, and available features. Upgrade or manage your subscription through the app stores."
        },
        {
          title: "Deleting Your Account",
          content: "Permanently delete your account and all data in Command Center → Account → Delete Account. This action is irreversible—your companion, progress, referrals, and saved content will be permanently removed."
        }
      ]
    }
  ];

  const tips = [
    {
      icon: Zap,
      title: "Complete your Main Quest daily",
      description: "It gives 3x XP—the biggest daily boost available!"
    },
    {
      icon: Calendar,
      title: "Build streaks for multipliers",
      description: "Consistent daily activity compounds your XP earnings over time."
    },
    {
      icon: Heart,
      title: "Chat with your mentor",
      description: "They remember your context and provide personalized guidance."
    },
    {
      icon: Map,
      title: "Try Star Paths for structure",
      description: "Pre-built Epics guide you through proven growth journeys."
    }
  ];

  return (
    <PageTransition>
      <StarfieldBackground />
      
      <div className="min-h-screen pb-nav-safe relative">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6 safe-area-top">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  haptics.light();
                  navigate(-1);
                }}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Help Center
                </h1>
                <p className="text-sm text-muted-foreground">Everything you need to know</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 space-y-8 relative z-10">
          {/* Quick Tips */}
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                Pro Tips
              </CardTitle>
              <CardDescription>Maximize your Cosmiq experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {tips.map((tip, index) => (
                  <div key={index} className="flex gap-3">
                    <tip.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{tip.title}</p>
                      <p className="text-xs text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Feature Sections */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Feature Guides
            </h2>
            
            {sections.map((section) => (
              <Card key={section.id} className="overflow-hidden">
                <Accordion type="single" collapsible value={expandedSection === section.id ? section.id : ""}>
                  <AccordionItem value={section.id} className="border-none">
                    <AccordionTrigger
                      className="px-4 py-3 hover:no-underline hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        haptics.light();
                        setExpandedSection(expandedSection === section.id ? null : section.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <section.icon className={`h-5 w-5 ${section.color}`} />
                        <span className="font-semibold">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="single" collapsible className="space-y-2">
                        {section.items.map((item, index) => (
                          <AccordionItem 
                            key={index} 
                            value={`${section.id}-${index}`}
                            className="border rounded-lg bg-accent/20"
                          >
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                              <span className="text-left">{item.title}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3 text-sm text-muted-foreground">
                              {item.content}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Jump to common actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  haptics.light();
                  navigate("/profile", { state: { openTab: "notifications" } });
                }}
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Notification Settings</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  haptics.light();
                  navigate("/mentor-selection");
                }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Browse Mentors</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  haptics.light();
                  navigate("/onboarding");
                }}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <span>Retake Onboarding Quiz</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between text-destructive hover:text-destructive"
                onClick={() => {
                  haptics.light();
                  navigate("/profile", { state: { showDeleteDialog: true } });
                }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Delete Account</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Need More Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Can't find what you're looking for? Chat with your mentor for personalized guidance, 
                or visit our support resources for additional assistance.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  haptics.light();
                  navigate("/mentor-chat");
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat with Your Mentor
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <BottomNav />
    </PageTransition>
  );
};

export default HelpCenter;
