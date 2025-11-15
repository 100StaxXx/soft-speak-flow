import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, BookOpen, Quote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Mentor {
  id: string;
  name: string;
  description: string;
  tone_description: string;
}

const ContentGenerator = () => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAndFetchMentors();
  }, []);

  const checkAdminAndFetchMentors = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });

    if (!roleData) {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    fetchMentors();
  };

  const fetchMentors = async () => {
    const { data, error } = await supabase
      .from("mentors")
      .select("id, name, description, tone_description")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load mentors",
        variant: "destructive",
      });
    } else {
      setMentors(data || []);
    }
  };

  const generateContent = async (mentorId: string, contentType: "quote" | "lesson", count: number = 1) => {
    setLoading(true);
    setGeneratingFor(`${mentorId}-${contentType}`);

    try {
      const { data, error } = await supabase.functions.invoke("generate-mentor-content", {
        body: { mentorId, contentType, count },
      });

      if (error) throw error;

      const contentName = contentType === "quote" ? "quote" : "lesson";
      const pluralSuffix = count > 1 ? "s" : "";

      toast({
        title: "Success!",
        description: `Generated ${count} ${contentName}${pluralSuffix} successfully`,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGeneratingFor(null);
    }
  };

  const generateAllQuotes = async () => {
    for (const mentor of mentors) {
      await generateContent(mentor.id, "quote", 3);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    toast({
      title: "Batch Complete",
      description: "Generated quotes for all mentors",
    });
  };

  const generateAllLessons = async () => {
    for (const mentor of mentors) {
      await generateContent(mentor.id, "lesson", 1);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    toast({
      title: "Batch Complete",
      description: "Generated lessons for all mentors",
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          AI Content Generator
        </h1>
        <p className="text-muted-foreground">
          Generate mentor-specific quotes and daily lessons using AI
        </p>
      </div>

      <div className="grid gap-4 mb-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Batch Generate</CardTitle>
            <CardDescription>Generate content for all mentors at once</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={generateAllQuotes}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Quote className="h-4 w-4 mr-2" />}
              Generate 3 Quotes for Each Mentor
            </Button>
            <Button
              onClick={generateAllLessons}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
              Generate 1 Lesson for Each Mentor
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mentors.map((mentor) => (
          <Card key={mentor.id}>
            <CardHeader>
              <CardTitle className="text-lg">{mentor.name}</CardTitle>
              <CardDescription className="text-sm">{mentor.tone_description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => generateContent(mentor.id, "quote", 1)}
                disabled={loading}
                className="w-full"
                size="sm"
                variant="outline"
              >
                {generatingFor === `${mentor.id}-quote` ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Quote className="h-4 w-4 mr-2" />
                )}
                Generate Quote
              </Button>
              <Button
                onClick={() => generateContent(mentor.id, "lesson", 1)}
                disabled={loading}
                className="w-full"
                size="sm"
                variant="outline"
              >
                {generatingFor === `${mentor.id}-lesson` ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BookOpen className="h-4 w-4 mr-2" />
                )}
                Generate Lesson
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ContentGenerator;
