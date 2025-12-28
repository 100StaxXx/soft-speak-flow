import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Calendar,
  Clock,
  Target,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ClarifyingQuestion } from '@/hooks/useIntentClassifier';

interface EpicClarificationFlowProps {
  goal: string;
  questions: ClarifyingQuestion[];
  onSubmit: (answers: Record<string, string | number>) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function EpicClarificationFlow({
  goal,
  questions,
  onSubmit,
  onSkip,
  isLoading = false,
}: EpicClarificationFlowProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});

  const handleChange = (questionId: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const requiredQuestions = questions.filter(q => q.required);
  const allRequiredAnswered = requiredQuestions.every(q => {
    const answer = answers[q.id];
    return answer !== undefined && answer !== '';
  });

  const getIconForQuestion = (id: string) => {
    if (id.includes('date') || id.includes('exam') || id.includes('target')) {
      return Calendar;
    }
    if (id.includes('hours') || id.includes('time') || id.includes('days')) {
      return Clock;
    }
    if (id.includes('subject') || id.includes('level') || id.includes('status')) {
      return BookOpen;
    }
    return Target;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-br from-primary/5 via-background to-primary/5 rounded-xl border border-primary/20 p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Let's personalize your epic</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {goal}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const Icon = getIconForQuestion(question.id);
          
          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              <Label className="text-sm flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                {question.question}
                {question.required && <span className="text-destructive">*</span>}
              </Label>
              
              {question.type === 'select' && question.options && (
                <Select
                  value={answers[question.id]?.toString() || ''}
                  onValueChange={(value) => handleChange(question.id, value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {question.type === 'date' && (
                <Input
                  type="date"
                  value={answers[question.id]?.toString() || ''}
                  onChange={(e) => handleChange(question.id, e.target.value)}
                  className="h-9"
                  min={new Date().toISOString().split('T')[0]}
                />
              )}
              
              {question.type === 'number' && (
                <Input
                  type="number"
                  value={answers[question.id]?.toString() || ''}
                  onChange={(e) => handleChange(question.id, parseInt(e.target.value) || '')}
                  placeholder={question.placeholder || 'Enter a number...'}
                  className="h-9"
                  min={1}
                  max={24}
                />
              )}
              
              {question.type === 'text' && (
                <Input
                  type="text"
                  value={answers[question.id]?.toString() || ''}
                  onChange={(e) => handleChange(question.id, e.target.value)}
                  placeholder={question.placeholder || 'Type your answer...'}
                  className="h-9"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={!allRequiredAnswered || isLoading}
          className="flex-1 h-10"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate My Epic
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center">
        This helps create a personalized study plan just for you
      </p>
    </motion.div>
  );
}
