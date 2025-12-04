import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ONBOARDING_QUESTIONS, OnboardingAnswer } from "@/utils/mentorMatching";

interface QuestionnaireProps {
  onComplete: (answers: OnboardingAnswer[]) => void;
}

export const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);

  // Scroll to top whenever question changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentQuestion]);

  const handleAnswer = (answerId: string, mentorTags: string[]) => {
    const question = ONBOARDING_QUESTIONS[currentQuestion];
    const newAnswer: OnboardingAnswer = { questionId: question.id, answerId, mentorTags };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (currentQuestion < ONBOARDING_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      onComplete(updatedAnswers);
    }
  };

  const question = ONBOARDING_QUESTIONS[currentQuestion];

  return (
    <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-10 animate-velocity-fade-in">
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-steel">
            <span className="tracking-wide">Question {currentQuestion + 1} of {ONBOARDING_QUESTIONS.length}</span>
            <span className="font-medium tabular-nums">{Math.round(((currentQuestion + 1) / ONBOARDING_QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-charcoal rounded-full overflow-hidden">
            <div className="h-full bg-royal-gold transition-all duration-300" style={{ width: `${((currentQuestion + 1) / ONBOARDING_QUESTIONS.length) * 100}%` }} />
          </div>
        </div>
        <Card className="border-2 border-charcoal bg-midnight hover:border-royal-gold/50 transition-all">
          <CardHeader>
            <CardTitle className="text-2xl text-pure-white leading-snug">{question.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {question.answers.map((answer) => (
              <Button key={answer.id} variant="outline" className="w-full justify-start text-left min-h-[56px] h-auto py-4 px-6 bg-charcoal/50 border-steel/30 text-pure-white hover:bg-royal-gold/20 hover:border-royal-gold transition-all" onClick={() => handleAnswer(answer.id, answer.mentorTags)}>
                <span className="text-base leading-snug">{answer.text}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
