import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface DailyLessonProps {
  title: string;
  content: string;
  category: string;
}

export const DailyLesson = ({ title, content, category }: DailyLessonProps) => {
  return (
    <Card className="bg-gradient-to-br from-royal-gold/5 to-graphite border-royal-gold/20 p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-royal-gold/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-royal-gold" />
        </div>
        <div>
          <p className="text-xs text-royal-gold font-bold uppercase tracking-widest">
            Daily Lesson
          </p>
          <p className="text-xs text-steel">{category}</p>
        </div>
      </div>

      <h3 className="text-2xl font-heading font-black text-pure-white mb-4">
        {title}
      </h3>

      <p className="text-steel leading-relaxed">
        {content}
      </p>
    </Card>
  );
};
