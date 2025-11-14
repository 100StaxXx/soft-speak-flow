import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface DailyLessonProps {
  title: string;
  content: string;
  category: string;
}

export const DailyLesson = ({ title, content, category }: DailyLessonProps) => {
  return (
    <Card className="bg-gradient-to-br from-accent/10 to-card border-primary/20 p-6 md:p-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-primary font-bold uppercase tracking-widest">
            Daily Lesson
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{category}</p>
        </div>
      </div>

      <h3 className="text-xl md:text-2xl font-heading font-black text-foreground mb-4 relative z-10 leading-tight">
        {title}
      </h3>

      <p className="text-sm md:text-base text-muted-foreground leading-relaxed relative z-10">
        {content}
      </p>
    </Card>
  );
};
