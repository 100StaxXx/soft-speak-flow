import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, Sparkles, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLessonNotifications } from "@/hooks/useLessonNotifications";

export default function Lessons() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAllLessons, setShowAllLessons] = useState(false);
  
  // Enable lesson notifications
  useLessonNotifications();

  // Auto-generate today's lesson on page load
  useEffect(() => {
    const generateDailyLesson = async () => {
      try {
        setIsGenerating(true);
        const { data, error } = await supabase.functions.invoke('generate-lesson', {
          body: {},
        });
        
        if (error) throw error;
        
        if (data?.created) {
          toast.success("New lesson available!");
        }
      } catch (error) {
        console.error('Error generating lesson:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    generateDailyLesson();
  }, []);

  const { data: lessons = [], refetch } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lessons')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const todayLesson = lessons[0];
  const displayLessons = showAllLessons ? lessons : (todayLesson ? [todayLesson] : []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-4xl font-heading text-foreground">Lessons</h1>
          </div>
          {!showAllLessons && lessons.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllLessons(true)}>
              <List className="w-4 h-4 mr-2" />
              All Lessons
            </Button>
          )}
          {showAllLessons && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllLessons(false)}>
              Today Only
            </Button>
          )}
        </div>

        <div className="grid gap-4">
          {isGenerating && lessons.length === 0 && (
            <Card className="p-12 text-center">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground">Generating today's lesson...</p>
            </Card>
          )}
          
          {!isGenerating && lessons.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No lessons available yet.</p>
            </Card>
          ) : showAllLessons ? (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {lessons.map((lesson, index) => (
                <AccordionItem key={lesson.id} value={lesson.id} className="border rounded-lg px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col items-start text-left flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {index === 0 && (
                          <Badge className="bg-gradient-to-r from-blush-rose to-soft-mauve text-xs">
                            Today
                          </Badge>
                        )}
                        {lesson.lesson_number && (
                          <Badge variant="secondary" className="text-xs">
                            Day {lesson.lesson_number}
                          </Badge>
                        )}
                        {lesson.category && (
                          <Badge variant="outline" className="text-xs">{lesson.category}</Badge>
                        )}
                      </div>
                      <h3 className="text-base font-heading text-foreground">{lesson.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(lesson.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4 space-y-3">
                      <p className="text-sm text-muted-foreground">{lesson.description}</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{lesson.content}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            displayLessons.map((lesson, index) => (
              <Card key={lesson.id} className="p-6 hover:border-primary/40 transition-all">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-gradient-to-r from-blush-rose to-soft-mauve">
                          Today's Lesson
                        </Badge>
                        {lesson.lesson_number && (
                          <Badge variant="secondary">
                            Day {lesson.lesson_number}
                          </Badge>
                        )}
                        {lesson.category && (
                          <Badge variant="outline">{lesson.category}</Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-heading text-foreground">{lesson.title}</h3>
                      <p className="text-muted-foreground mt-2">{lesson.description}</p>
                    </div>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{lesson.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lesson.created_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
