import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Edit, Plus, Upload, X } from "lucide-react";

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
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [mentors, setMentors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    quote: "",
    description: "",
    audio_url: "",
    is_featured: false,
    mentor_id: "",
    tags: [] as string[],
    is_premium: false,
  });

  useEffect(() => {
    fetchPepTalks();
    fetchMentors();
  }, []);

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

    const audioUrl = await uploadAudio();
    if (!audioUrl && !formData.audio_url) {
      toast.error("Please upload an audio file");
      return;
    }

    const pepTalkData = {
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
        return;
      }
      toast.success("Pep talk updated successfully");
    } else {
      const { error } = await supabase.from("pep_talks").insert([pepTalkData]);

      if (error) {
        toast.error("Failed to create pep talk");
        return;
      }
      toast.success("Pep talk created successfully");
    }

    resetForm();
    fetchPepTalks();
  };

  const handleEdit = (pepTalk: any) => {
    setFormData({
      title: pepTalk.title,
      category: pepTalk.category,
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
    setAudioFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-glow to-petal-pink/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage your pep talks</p>
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
                  required
                  className="rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., daily, heartbreak, discipline, glow-up"
                    required
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
                <Label htmlFor="quote">Quote</Label>
                <Textarea
                  id="quote"
                  value={formData.quote}
                  onChange={(e) =>
                    setFormData({ ...formData, quote: e.target.value })
                  }
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
                  disabled={uploading}
                  className="flex-1 rounded-full bg-gradient-to-r from-blush-rose to-lavender-mist hover:shadow-glow transition-all"
                >
                  {uploading ? (
                    "Uploading..."
                  ) : editingId ? (
                    "Update Pep Talk"
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Pep Talk
                    </>
                  )}
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

        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="mb-8 rounded-full bg-gradient-to-r from-blush-rose to-lavender-mist hover:shadow-glow transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Pep Talk
          </Button>
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
