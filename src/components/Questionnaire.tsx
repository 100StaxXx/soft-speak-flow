import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Question {
  id: string;
  question: string;
  options: {
    label: string;
    tags: string[];
  }[];
}

const questions: Question[] = [
  {
    id: "goal",
    question: "What do you want to improve right now?",
    options: [
      { label: "Discipline & Consistency", tags: ["discipline", "consistency", "firm"] },
      { label: "Confidence & Self-Worth", tags: ["confidence", "self-worth", "affirmations"] },
      { label: "Physique & Physical Strength", tags: ["physique", "fitness", "athlete", "physical"] },
      { label: "Heartbreak Recovery", tags: ["heartbreak", "emotional", "calm"] },
      { label: "Business & Success Focus", tags: ["business", "success", "logical"] },
      { label: "Spiritual Calm & Peace", tags: ["spiritual", "calm", "mindfulness"] },
    ],
  },
  {
    id: "motivation_style",
    question: "How do you prefer to be motivated?",
    options: [
      { label: "Tough Love & Direct Truth", tags: ["tough", "firm", "direct"] },
      { label: "Calm & Patient Guidance", tags: ["calm", "patient", "gentle"] },
      { label: "High Energy & Hype", tags: ["hype", "energy", "athlete"] },
      { label: "Humor & Lightheartedness", tags: ["humor", "comedic", "lighthearted"] },
      { label: "Logical & Strategic Advice", tags: ["logical", "strategic", "business"] },
    ],
  },
  {
    id: "energy",
    question: "Which energy resonates most with you?",
    options: [
      { label: "Alpha Masculine Discipline", tags: ["alpha", "masculine", "discipline"] },
      { label: "Spiritual Grounding", tags: ["spiritual", "grounded", "mindfulness"] },
      { label: "Comedic Inspiration", tags: ["comedic", "humor", "lighthearted"] },
      { label: "Athlete Mentality", tags: ["athlete", "physical", "competitive"] },
      { label: "Wise Teacher", tags: ["wise", "calm", "storytelling"] },
    ],
  },
  {
    id: "obstacle",
    question: "What is your current biggest obstacle?",
    options: [
      { label: "Lack of Motivation", tags: ["motivation", "hype", "energy"] },
      { label: "Overthinking & Anxiety", tags: ["anxiety", "calm", "mindfulness"] },
      { label: "Procrastination", tags: ["discipline", "firm", "consistency"] },
      { label: "Self-Doubt", tags: ["confidence", "affirmations", "self-worth"] },
      { label: "Physical Weakness", tags: ["physique", "physical", "athlete"] },
    ],
  },
  {
    id: "tone",
    question: "What tone speaks to you?",
    options: [
      { label: "Firm & Commanding", tags: ["firm", "commanding", "alpha"] },
      { label: "Warm & Supportive", tags: ["warm", "supportive", "gentle"] },
      { label: "Energetic & Uplifting", tags: ["energetic", "hype", "uplifting"] },
      { label: "Witty & Entertaining", tags: ["witty", "comedic", "humor"] },
      { label: "Deep & Reflective", tags: ["deep", "reflective", "spiritual"] },
    ],
  },
];

interface QuestionnaireProps {
  onComplete: (collectedTags: string[]) => void;
}

export const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [collectedTags, setCollectedTags] = useState<string[]>([]);

  const handleAnswer = (option: { label: string; tags: string[] }) => {
    const newAnswers = [...answers, option.label];
    const newTags = [...collectedTags, ...option.tags];
    
    setAnswers(newAnswers);
    setCollectedTags(newTags);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      onComplete(newTags);
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-1 bg-steel/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-royal-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-steel text-sm mt-2 text-center">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>

        {/* Question Card */}
        <Card className="bg-graphite border-steel/20 p-8">
          <h2 className="text-3xl font-heading font-black text-pure-white mb-8 text-center">
            {questions[currentQuestion].question}
          </h2>

          <div className="space-y-4">
            {questions[currentQuestion].options.map((option, index) => (
              <Button
                key={index}
                onClick={() => handleAnswer(option)}
                variant="outline"
                className="w-full h-auto py-6 px-6 text-base sm:text-lg font-semibold bg-obsidian hover:bg-royal-purple/10 border-steel/30 hover:border-royal-purple text-pure-white rounded-lg transition-all duration-300 hover:scale-[1.02] whitespace-normal text-left leading-relaxed"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
