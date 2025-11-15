import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Edit, Plus, Upload, X, Loader2, Music } from "lucide-react";
import { AudioGenerator } from "@/components/AudioGenerator";

interface PepTalk {
  id: string;
  title: string;
  category: string;
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at: string;
}

const Admin = () => {
  const { user, loading: authLoadingFromHook } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  const [mentors, setMentors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    topic_category: "",
    emotional_triggers: [] as string[],
    quote: "",
    description: "",
    audio_url: "",
    is_featured: false,
    mentor_id: "",
    tags: [] as string[],
    is_premium: false,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoadingFromHook) return; // wait for auth to resolve

      if (!user) {
        console.debug('Admin: no user after auth resolved');
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (error || !data) {
        console.debug('Admin check failed', { error, data, userId: user.id });
        toast.error("Access Denied: You don't have permission to access this page.");
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      setIsAdmin(true);
      setAuthLoading(false);
    };

    checkAdmin();
  }, [user, authLoadingFromHook, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchPepTalks();
      fetchMentors();
    }
  }, [isAdmin]);

  const fetchMentors = async () => {
    const { data, error } = await supabase
      .from("mentors")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load mentors");
      return;
    }
    setMentors(data || []);
  };

  const fetchPepTalks = async () => {
    const { data, error } = await supabase
      .from("pep_talks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load pep talks");
      return;
    }
    setPepTalks(data || []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setAudioFile(file);
    } else {
      toast.error("Please select a valid audio file");
    }
  };

  const uploadAudio = async (): Promise<string | null> => {
    if (!audioFile) return formData.audio_url || null;

    setUploading(true);
    try {
      const fileExt = audioFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("pep-talk-audio")
        .upload(filePath, audioFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("pep-talk-audio")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload audio file");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show preview instead of saving directly
    setPreviewData({
      ...formData,
      audioFile: audioFile,
    });
    setIsPreview(true);
    setIsEditing(false);
  };

  const handleApprove = async () => {
    setUploading(true);

    const audioUrl = await uploadAudio();
    if (!audioUrl && !formData.audio_url) {
      toast.error("Please upload an audio file");
      setUploading(false);
      return;
    }

    const pepTalkData: any = {
      ...formData,
      audio_url: audioUrl || formData.audio_url,
    };

    if (editingId) {
      const { error } = await supabase
        .from("pep_talks")
        .update(pepTalkData)
        .eq("id", editingId);

      if (error) {
        toast.error("Failed to update pep talk");
        setUploading(false);
        return;
      }
      toast.success("Pep talk updated successfully");
    } else {
      const { error } = await supabase.from("pep_talks").insert([pepTalkData]);

      if (error) {
        toast.error("Failed to create pep talk");
        setUploading(false);
        return;
      }
      toast.success("Pep talk created successfully");
    }

    setIsPreview(false);
    setPreviewData(null);
    resetForm();
    fetchPepTalks();
    setUploading(false);
  };

  const handleReject = () => {
    setIsPreview(false);
    setIsEditing(true);
    toast.info("Returned to editing");
  };

  const handleEdit = (pepTalk: any) => {
    setFormData({
      title: pepTalk.title,
      category: pepTalk.category,
      topic_category: pepTalk.topic_category || "",
      emotional_triggers: pepTalk.emotional_triggers || [],
      quote: pepTalk.quote,
      description: pepTalk.description,
      audio_url: pepTalk.audio_url,
      is_featured: pepTalk.is_featured,
      mentor_id: pepTalk.mentor_id || "",
      tags: pepTalk.tags || [],
      is_premium: pepTalk.is_premium || false,
    });
    setEditingId(pepTalk.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pep talk?")) return;

    const { error } = await supabase.from("pep_talks").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete pep talk");
      return;
    }

    toast.success("Pep talk deleted successfully");
    fetchPepTalks();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      category: "",
      topic_category: "",
      emotional_triggers: [],
      quote: "",
      description: "",
      audio_url: "",
      is_featured: false,
      mentor_id: "",
      tags: [],
      is_premium: false,
    });
    setEditingId(null);
    setIsEditing(false);
    setIsPreview(false);
    setPreviewData(null);
    setAudioFile(null);
  };

  const mentorPreviewTexts: Record<string, string> = {
    atlas: "Let's take a breath, get clear, and move with purpose.",
    darius: "You know what needs to be done. Let's get to it.",
    eli: "Hey, you're doing better than you think. Keep going.",
    nova: "Small steps today create big shifts over time.",
    sienna: "You're safe, you're growing, and you're allowed to take your time.",
    lumi: "You've got this. Your light reaches further than you realize.",
    kai: "Slow your mind. Focus your breath. Move with intention.",
    stryker: "Stand tall. Lock in. This is your moment to push.",
    solace: "Let your mind settle. Peace starts from within.",
  };

  const handleVoicePreview = async (mentorSlug: string) => {
    const previewText = mentorPreviewTexts[mentorSlug];
    if (!previewText) {
      toast.error("No preview text for this mentor");
      return;
    }

    setPreviewingVoice(mentorSlug);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mentor-audio", {
        body: {
          mentorSlug,
          script: previewText,
        },
      });

      if (error) throw error;

      // Play the audio
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

  const handleFullAIGenerate = async () => {
    if (!formData.mentor_id) {
      toast.error("Please select a mentor first");
      return;
    }

    const mentor = mentors.find(m => m.id === formData.mentor_id);
    if (!mentor) {
      toast.error("Invalid mentor selected");
      return;
    }

    setAiGenerating(true);
    try {
      // Step 1: Generate complete pep talk content
      toast.info("Generating pep talk content...");
      const { data: contentData, error: contentError } = await supabase.functions.invoke(
        "generate-complete-pep-talk",
        {
          body: {
            mentorSlug: mentor.slug,
            category: formData.category || "motivation",
          },
        }
      );

      if (contentError) throw contentError;

      // Step 2: Generate audio from the script
      toast.info("Generating audio...");
      const { data: audioData, error: audioError } = await supabase.functions.invoke(
        "generate-mentor-audio",
        {
          body: {
            mentorSlug: mentor.slug,
            script: contentData.script,
          },
        }
      );

      if (audioError) throw audioError;

      // Update form with all generated data
      setFormData(prev => ({
        ...prev,
        title: contentData.title,
        quote: contentData.quote,
        description: contentData.description,
        category: contentData.category,
        audio_url: audioData.audioUrl,
      }));

      setIsEditing(true);
      toast.success("Complete pep talk generated successfully!");
    } catch (error: any) {
      console.error("Error generating complete pep talk:", error);
      toast.error(error.message || "Failed to generate pep talk");
    } finally {
      setAiGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cream-glow to-petal-pink/30 flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-glow to-petal-pink/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage your pep talks</p>
        </div>

        {/* Voice Preview Section */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">Voice Preview</h2>
          <p className="text-muted-foreground mb-6">Test each mentor's voice before generating content</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="flex items-center justify-between p-4 border rounded-2xl bg-card">
                <div>
                  <p className="font-medium">{mentor.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{mentor.slug}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVoicePreview(mentor.slug)}
                  disabled={previewingVoice === mentor.slug}
                  className="rounded-full"
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
        </Card>

        {/* Full AI Generator */}
        <div className="mb-8">
          <AudioGenerator
            mentors={mentors}
            onFullPepTalkGenerated={(pepTalkData) => {
              setFormData({
                ...formData,
                title: pepTalkData.title,
                quote: pepTalkData.quote,
                description: pepTalkData.description,
                topic_category: pepTalkData.topic_category,
                emotional_triggers: pepTalkData.emotional_triggers,
                audio_url: pepTalkData.audio_url,
                mentor_id: pepTalkData.mentor_id,
              });
              setIsEditing(true);
              toast.success("Pep talk generated! Review and save when ready.");
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <Button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Pep Talk
          </Button>
        </div>

        {/* Form */}
        {isEditing && (
          <Card className="p-6 mb-8 rounded-3xl shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl font-semibold">
                {editingId ? "Edit Pep Talk" : "Create New Pep Talk"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  maxLength={200}
                  required
                  className="rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category (Legacy)</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., daily, heartbreak"
                    maxLength={50}
                    className="rounded-2xl"
                  />
                </div>

                <div>
                  <Label htmlFor="mentor">Mentor</Label>
                  <select
                    id="mentor"
                    value={formData.mentor_id}
                    onChange={(e) =>
                      setFormData({ ...formData, mentor_id: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-2xl border border-input bg-background"
                  >
                    <option value="">No specific mentor</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="topic-category">Topic Category</Label>
                <select
                  id="topic-category"
                  value={formData.topic_category}
                  onChange={(e) =>
                    setFormData({ ...formData, topic_category: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-2xl border border-input bg-background"
                >
                  <option value="">Select a topic category...</option>
                  <option value="discipline">Discipline</option>
                  <option value="confidence">Confidence</option>
                  <option value="physique">Physique</option>
                  <option value="focus">Focus</option>
                  <option value="mindset">Mindset</option>
                  <option value="business">Business</option>
                </select>
              </div>

              <div>
                <Label>Emotional Triggers (Optional)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Exhausted", "Avoiding Action", "Anxious & Overthinking", "Self-Doubt", 
                    "Feeling Stuck", "Frustrated", "Heavy or Low", "Emotionally Hurt", 
                    "Unmotivated", "In Transition", "Needing Discipline", "Motivated & Ready"].map((trigger) => (
                    <Button
                      key={trigger}
                      type="button"
                      variant={formData.emotional_triggers.includes(trigger) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const triggers = formData.emotional_triggers.includes(trigger)
                          ? formData.emotional_triggers.filter(t => t !== trigger)
                          : [...formData.emotional_triggers, trigger];
                        setFormData({ ...formData, emotional_triggers: triggers });
                      }}
                      className="rounded-full text-xs"
                    >
                      {trigger}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="quote">Quote</Label>
                <Textarea
                  id="quote"
                  value={formData.quote}
                  onChange={(e) =>
                    setFormData({ ...formData, quote: e.target.value })
                  }
                  maxLength={500}
                  required
                  className="rounded-2xl min-h-24"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  maxLength={1000}
                  required
                  className="rounded-2xl min-h-24"
                />
              </div>

              <div>
                <Label htmlFor="audio">Audio File (MP3)</Label>
                <div className="mt-2">
                  <Input
                    id="audio"
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="rounded-2xl"
                  />
                  {audioFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {audioFile.name}
                    </p>
                  )}
                  {formData.audio_url && !audioFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Current audio uploaded
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags.join(", ")}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })
                  }
                  placeholder="discipline, focus, motivation"
                  className="rounded-2xl"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_featured: checked })
                    }
                  />
                  <Label htmlFor="featured">Featured</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="premium"
                    checked={formData.is_premium}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_premium: checked })
                    }
                  />
                  <Label htmlFor="premium">Premium</Label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 rounded-full bg-gradient-to-r from-blush-rose to-lavender-mist hover:shadow-glow transition-all"
                >
                  Preview {editingId ? "Update" : "Creation"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="rounded-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Preview Mode */}
        {isPreview && previewData && (
          <Card className="p-6 mb-8 rounded-3xl shadow-soft border-2 border-royal-purple">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl font-semibold text-royal-purple">
                Preview: Approve Before Saving
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsPreview(false);
                  setIsEditing(true);
                }}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="text-lg font-semibold mt-1">{previewData.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="text-sm mt-1 uppercase font-medium">{previewData.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mentor</Label>
                  <p className="text-sm mt-1">
                    {previewData.mentor_id
                      ? mentors.find(m => m.id === previewData.mentor_id)?.name || "Unknown"
                      : "No specific mentor"}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Quote / Script</Label>
                <p className="text-base mt-1 italic">{previewData.quote}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-base mt-1">{previewData.description}</p>
              </div>

              {previewData.tags && previewData.tags.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {previewData.tags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-royal-purple/10 text-royal-purple rounded-full text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Audio Preview</Label>
                {previewData.audio_url ? (
                  <audio
                    controls
                    className="w-full mt-2 rounded-2xl"
                    src={previewData.audio_url}
                  >
                    Your browser does not support the audio element.
                  </audio>
                ) : previewData.audioFile ? (
                  <audio
                    controls
                    className="w-full mt-2 rounded-2xl"
                    src={URL.createObjectURL(previewData.audioFile)}
                  >
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No audio available</p>
                )}
              </div>

              <div className="flex gap-4">
                {previewData.is_featured && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-sm">
                    <span className="font-medium">⭐ Featured</span>
                  </div>
                )}
                {previewData.is_premium && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full text-sm">
                    <span className="font-medium">💎 Premium</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t">
                <Button
                  onClick={handleApprove}
                  disabled={uploading}
                  className="flex-1 rounded-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      ✓ Approve & Save to Catalog
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={uploading}
                  variant="outline"
                  className="rounded-full border-red-500 text-red-500 hover:bg-red-50"
                >
                  ✗ Edit More
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* List */}
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold text-foreground">
            All Pep Talks ({pepTalks.length})
          </h2>

          {pepTalks.map((pepTalk) => (
            <Card key={pepTalk.id} className="p-5 rounded-3xl shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {pepTalk.category}
                    </span>
                    {pepTalk.is_featured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gold-accent/20 text-warm-charcoal font-medium">
                        Featured
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
                    {pepTalk.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pepTalk.description}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(pepTalk)}
                    className="rounded-full hover:bg-secondary"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pepTalk.id)}
                    className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {pepTalks.length === 0 && (
            <Card className="p-12 text-center rounded-3xl shadow-soft">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No pep talks yet. Create your first one!
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
