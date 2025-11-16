import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DailyLessonProps {
  title: string;
  content: string;
  category: string;
  actionStep?: string;
}

export const DailyLesson = ({ title, content, category, actionStep }: DailyLessonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-accent/10 to-card border-primary/20 overflow-hidden relative">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-6 md:p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="flex items-center justify-between gap-3 mb-6 relative z-10">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary font-bold uppercase tracking-widest">
                  Daily Lesson
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{category}</p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                {isOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <h3 className="text-lg md:text-xl font-heading font-black text-foreground mb-4 relative z-10 leading-tight break-words">
            {title}
          </h3>

          <CollapsibleContent className="space-y-4 animate-accordion-down">
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed relative z-10 break-words">
              {content}
            </p>

            {actionStep && (
              <div className="relative z-10 pt-4 border-t border-primary/10">
                <p className="text-xs text-primary/80 font-semibold uppercase tracking-wider mb-2">
                  Today's Action
                </p>
                <p className="text-sm font-medium text-foreground break-words">
                  {actionStep}
                </p>
              </div>
            )}
          </CollapsibleContent>

          {!isOpen && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full mt-4 relative z-10">
                Read Full Lesson
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </Collapsible>
    </Card>
  );
};
