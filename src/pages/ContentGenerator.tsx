import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, BookOpen, Quote, Music, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioGenerator } from "@/components/AudioGenerator";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TimedCaptions } from "@/components/TimedCaptions";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { toast } from "sonner";

interface Mentor {
  id: string;
  name: string;
  description: string;
  tone_description: string;
  slug: string;
}

const ContentGenerator = () => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    quote: "",
    description: "",
    topic_category: [] as string[],
    emotional_triggers: [] as string[],
    audio_url: "",
    mentor_id: "",
    category: "",
    is_featured: false,
    is_premium: false,
    transcript: [] as Array<{ word: string; start: number; end: number }>,
  });
  const { toast: toastHook } = useToast();
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
      toastHook({
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
      .select("*")
      .order("name");

    if (error) {
      toastHook({
        title: "Error",
        description: "Failed to load mentors",
        variant: "destructive",
      });
    } else {
      setMentors(data || []);
    }
  };

  const handleVoicePreview = async (mentorSlug: string) => {
    setPreviewingVoice(mentorSlug);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mentor-audio", {
        body: {
          mentorSlug,
          script: "This is a preview of my voice. I'm here to guide and support you on your journey.",
        },
      });

      if (error) throw error;

      const audio = new Audio(data.audioUrl);
      audio.play();

      audio.onended = () => {
        setPreviewingVoice(null);
      };
    } catch (error: any) {
      console.error("Error previewing voice:", error);
      toast.error(error.message || "Failed to preview voice");
      setPreviewingVoice(null);
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

      toastHook({
        title: "Success!",
        description: `Generated ${count} ${contentName}${pluralSuffix} successfully`,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      toastHook({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGeneratingFor(null);
    }
  };

  const generateBatchLessons = async (mentorId: string, mentorName: string) => {
    try {
      setGeneratingFor(mentorId);
      
      const { data, error } = await supabase.functions.invoke('batch-generate-lessons', {
        body: { mentor_id: mentorId, count: 10 }
      });

      if (error) throw error;

      toast.success(`Generated ${data.count} lessons for ${mentorName}`);
    } catch (error) {
      console.error('Error generating lessons:', error);
      toast.error(`Failed to generate lessons for ${mentorName}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleSavePepTalk = async () => {
    if (!formData.title || !formData.audio_url || !formData.mentor_id) {
      toast.error("Please ensure all required fields are filled");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("pep_talks").insert({
        title: formData.title,
        quote: formData.quote,
        description: formData.description,
        topic_category: formData.topic_category,
        emotional_triggers: formData.emotional_triggers,
        audio_url: formData.audio_url,
        mentor_id: formData.mentor_id,
        category: formData.category || formData.topic_category[0] || "mindset",
        is_featured: formData.is_featured,
        is_premium: formData.is_premium,
        transcript: formData.transcript,
      });

      if (error) throw error;

      toast.success("Pep talk saved successfully to library!");
      setShowEditor(false);
      setCurrentTime(0);
      setFormData({
        title: "",
        quote: "",
        description: "",
        topic_category: [],
        emotional_triggers: [],
        audio_url: "",
        mentor_id: "",
        category: "",
        is_featured: false,
        is_premium: false,
        transcript: [],
      });
    } catch (error: any) {
      console.error("Error saving pep talk:", error);
      toast.error(error.message || "Failed to save pep talk");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setCurrentTime(0);
    setFormData({
      title: "",
      quote: "",
      description: "",
      topic_category: [],
      emotional_triggers: [],
      audio_url: "",
      mentor_id: "",
      category: "",
      is_featured: false,
      is_premium: false,
      transcript: [],
    });
  };

  const generateAllQuotes = async () => {
    toast.info("Generating quotes for all mentors...");
    for (const mentor of mentors) {
      await generateContent(mentor.id, "quote", 3);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    toastHook({
      title: "Batch Complete",
      description: "Generated quotes for all mentors",
    });
  };

  const generateAllLessons = async () => {
    toast.info("Generating 10 lessons for each mentor...");
    for (const mentor of mentors) {
      await generateBatchLessons(mentor.id, mentor.name);
    }
    toast.success("All lessons generated successfully!");
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold mb-2">AI Content Generator</h1>
        <p className="text-muted-foreground">
          Generate mentor-specific quotes, lessons, and complete pep talks using AI
        </p>
      </div>

      {/* Voice Preview Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Voice Preview</CardTitle>
          <CardDescription>Test each mentor's voice before generating content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <p className="font-medium">{mentor.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{mentor.slug}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVoicePreview(mentor.slug)}
                  disabled={previewingVoice === mentor.slug}
                >
                  {previewingVoice === mentor.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Music className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full AI Pep Talk Generator */}
      <div className="mb-8">
        <AudioGenerator
          mentors={mentors}
          onFullPepTalkGenerated={(pepTalkData) => {
            setFormData({
              title: pepTalkData.title,
              quote: pepTalkData.quote,
              description: pepTalkData.description,
              topic_category: pepTalkData.topic_category,
              emotional_triggers: pepTalkData.emotional_triggers,
              audio_url: pepTalkData.audio_url,
              mentor_id: pepTalkData.mentor_id,
              category: pepTalkData.topic_category[0] || "mindset",
              is_featured: false,
              is_premium: false,
              transcript: pepTalkData.transcript || [],
            });
            setShowEditor(true);
            setCurrentTime(0);
            toast.success("Pep talk generated! Review and edit before saving.");
          }}
        />
      </div>

      {/* Editor Form */}
      {showEditor && (
        <Card className="mb-8 border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Review & Edit Pep Talk</CardTitle>
                <CardDescription>Make any changes before saving to library</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Pep talk title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote">Quote</Label>
              <Textarea
                id="quote"
                value={formData.quote}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                placeholder="Inspirational quote"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Main category"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
              />
              <Label htmlFor="featured">Featured</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="premium"
                checked={formData.is_premium}
                onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
              />
              <Label htmlFor="premium">Premium</Label>
            </div>

            {formData.audio_url && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Audio Preview</Label>
                  <AudioPlayer 
                    audioUrl={formData.audio_url} 
                    title={formData.title || "Pep Talk Preview"}
                    onTimeUpdate={setCurrentTime}
                  />
                </div>
                
                <TimedCaptions 
                  transcript={formData.transcript || []} 
                  currentTime={currentTime}
                />

                <TranscriptEditor
                  transcript={formData.transcript || []}
                  onChange={(newTranscript) => setFormData({ ...formData, transcript: newTranscript })}
                  audioUrl={formData.audio_url}
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSavePepTalk} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save to Library
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Generation Actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5" />
              Batch Quote Generation
            </CardTitle>
            <CardDescription>Generate 3 quotes for each mentor</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={generateAllQuotes}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate All Quotes"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Batch Lesson Generation
            </CardTitle>
            <CardDescription>Generate 10 lessons for each mentor</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={generateAllLessons}
              disabled={loading || generatingFor !== null}
              className="w-full"
            >
              {generatingFor ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate All Lessons (10 each)"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Individual Mentor Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Mentor Content</CardTitle>
          <CardDescription>Generate content for specific mentors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="border rounded-lg p-4">
                <div className="mb-4">
                  <h3 className="font-heading text-lg font-semibold">{mentor.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{mentor.description}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => generateContent(mentor.id, "quote", 1)}
                    disabled={generatingFor === `${mentor.id}-quote`}
                    variant="outline"
                    size="sm"
                  >
                    {generatingFor === `${mentor.id}-quote` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Quote className="mr-2 h-4 w-4" />
                    )}
                    Generate Quote
                  </Button>
                  <Button
                    onClick={() => generateBatchLessons(mentor.id, mentor.name)}
                    disabled={generatingFor === mentor.id}
                    variant="outline"
                    size="sm"
                  >
                    {generatingFor === mentor.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BookOpen className="mr-2 h-4 w-4" />
                    )}
                    Generate 10 Lessons
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentGenerator;
