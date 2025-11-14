import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export default function Lessons() {
  const navigate = useNavigate();

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('*').order('lesson_number');
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Lessons</h1>
        </div>

        <div className="grid gap-4">
          {lessons.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No lessons available yet.</p>
            </Card>
          ) : (
            lessons.map((lesson) => (
              <Card key={lesson.id} className="p-6 hover:border-primary/40 transition-all">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {lesson.lesson_number && lesson.total_lessons && (
                          <Badge variant="secondary">
                            Lesson {lesson.lesson_number}/{lesson.total_lessons}
                          </Badge>
                        )}
                        {lesson.category && <Badge variant="outline">{lesson.category}</Badge>}
                      </div>
                      <h3 className="text-xl font-heading text-foreground">{lesson.title}</h3>
                      <p className="text-muted-foreground mt-2">{lesson.description}</p>
                    </div>
                  </div>
                  {lesson.total_lessons && (
                    <Progress value={(lesson.lesson_number / lesson.total_lessons) * 100} />
                  )}
                  <Button className="w-full">Start Lesson</Button>
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
