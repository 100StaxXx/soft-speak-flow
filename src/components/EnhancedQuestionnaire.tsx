import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUESTIONNAIRE } from "@/config/questionnaire";
import { ChevronLeft } from "lucide-react";

interface EnhancedQuestionnaireProps {
  onComplete: (answers: Record<string, string>) => void;
}

export const EnhancedQuestionnaire = ({ onComplete }: EnhancedQuestionnaireProps) => {
  const [currentStep, setCurrentStep] = useState<'welcome' | number>('welcome');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleStart = () => {
    setCurrentStep(0);
  };

  const handleAnswer = (questionId: string, optionId: string) => {
    const newAnswers = { ...answers, [questionId]: optionId };
    setAnswers(newAnswers);

    // Auto-advance after brief delay
    setTimeout(() => {
      const currentQuestionIndex = typeof currentStep === 'number' ? currentStep : 0;
      
      if (currentQuestionIndex < QUESTIONNAIRE.length - 1) {
        setCurrentStep(currentQuestionIndex + 1);
      } else {
        onComplete(newAnswers);
      }
    }, 400);
  };

  const handleBack = () => {
    if (typeof currentStep === 'number' && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setCurrentStep('welcome');
    }
  };

  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-12 animate-fade-in">
          <div className="space-y-6">
            <div className="h-1 w-32 bg-royal-gold mx-auto animate-scale-in" />
            <h1 className="text-6xl md:text-7xl font-black text-pure-white uppercase tracking-tight">
              Welcome to
              <br />
              A Lil Push
            </h1>
            <p className="text-2xl md:text-3xl text-steel max-w-xl mx-auto leading-relaxed">
              Let's match you with the mentor who speaks your language.
            </p>
          </div>

          <Button
            onClick={handleStart}
            size="lg"
            className="px-16 py-8 text-xl font-black uppercase tracking-wider bg-royal-gold hover:bg-royal-gold/90 text-obsidian shadow-[0_0_30px_rgba(255,215,0,0.5)] hover:shadow-[0_0_40px_rgba(255,215,0,0.7)] transition-all duration-300"
          >
            Start
          </Button>

          <p className="text-sm text-steel">
            Takes less than a minute
          </p>
        </div>
      </div>
    );
  }

  const questionIndex = currentStep as number;
  const question = QUESTIONNAIRE[questionIndex];
  const progress = ((questionIndex + 1) / QUESTIONNAIRE.length) * 100;

  return (
    <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-8 animate-fade-in">
        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm text-steel">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 hover:text-royal-gold transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="font-bold">
              Question {questionIndex + 1} of {QUESTIONNAIRE.length}
            </span>
          </div>
          <div className="h-2 bg-charcoal rounded-full overflow-hidden">
            <div
              className="h-full bg-royal-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-pure-white text-center leading-tight">
            {question.question}
          </h2>

          {/* Options */}
          <div className="space-y-4">
            {question.options.map((option) => (
              <Card
                key={option.id}
                onClick={() => handleAnswer(question.id, option.id)}
                className={`
                  p-6 cursor-pointer transition-all duration-300
                  bg-midnight border-2
                  ${answers[question.id] === option.id
                    ? 'border-royal-gold bg-royal-gold/10 scale-[1.02]'
                    : 'border-charcoal hover:border-steel hover:bg-charcoal/50'
                  }
                `}
              >
                <p className="text-lg text-pure-white font-medium">
                  {option.label}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
