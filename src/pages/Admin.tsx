import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Edit, Plus, Upload, X, Loader2, Music, Download } from "lucide-react";
import { AdminPayouts } from "@/components/AdminPayouts";
import { AdminReferralCodes } from "@/components/AdminReferralCodes";
import { AdminReferralTesting } from "@/components/AdminReferralTesting";
import { AdminReferralConfig } from "@/components/AdminReferralConfig";
import { AdminReferralAnalytics } from "@/components/AdminReferralAnalytics";
import { EvolutionCardFlip } from "@/components/EvolutionCardFlip";
import { AdminCompanionImageTester } from "@/components/AdminCompanionImageTester";
import { globalAudio } from "@/utils/globalAudio";
import { downloadImage } from "@/utils/imageDownload";

interface PepTalk {
  id?: string;
  title: string;
  category: string;
  topic_category?: string[];
  emotional_triggers?: string[];
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at?: string;
  mentor_id?: string;
  tags?: string[];
  is_premium?: boolean;
  audioFile?: File;
}

const Admin = () => {
  const { user, loading: authLoadingFromHook } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PepTalk | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  // Sample Card Generator State
  const [sampleCardData, setSampleCardData] = useState({
    spiritAnimal: "wolf",
    element: "fire",
    stage: 5,
    favoriteColor: "#FF6B35",
    eyeColor: "#FFD700",
    furColor: "#8B4513",
    mind: 50,
    body: 50,
    soul: 50,
    customName: "",
  });
  const [generatingSampleCard, setGeneratingSampleCard] = useState(false);
  const [generatedSampleCard, setGeneratedSampleCard] = useState<any | null>(null);

  // Postcard Generator State
  const [postcardTestData, setPostcardTestData] = useState({
    spiritAnimal: "wolf",
    element: "fire",
    favoriteColor: "#FF6B35",
    eyeColor: "#FFD700",
    furColor: "#8B4513",
    milestonePercent: 50,
    sourceImageUrl: "",
  });
  const [generatingPostcard, setGeneratingPostcard] = useState(false);
  const [generatedPostcard, setGeneratedPostcard] = useState<{
    imageUrl: string;
    locationName: string;
    locationDescription: string;
    caption: string;
  } | null>(null);
  
  const [mentors, setMentors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    topic_category: [] as string[],
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

      // Server-side admin verification via edge function
      const { data, error } = await supabase.functions.invoke("verify-admin-access");

      if (error || !data?.isAdmin) {
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
  }, [user, authLoadingFromHook]); // toast from sonner is stable

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

      const { error: uploadError } = await supabase.storage
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

  const handleEdit = (pepTalk: PepTalk) => {
    setFormData({
      title: pepTalk.title,
      category: pepTalk.category,
      topic_category: pepTalk.topic_category || [],
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
      topic_category: [],
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

  // Active mentors only
  const mentorPreviewTexts: Record<string, string> = {
    atlas: "Let's take a breath, get clear, and move with purpose.",
    eli: "Hey, you're doing better than you think. Keep going.",
    sienna: "You're safe, you're growing, and you're allowed to take your time.",
    stryker: "Stand tall. Lock in. This is your moment to push.",
    carmen: "No excuses. Show me what you're made of.",
    reign: "Excellence isn't optional. Let's make today count.",
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

      // Play the audio (unless globally muted)
      if (!globalAudio.getMuted()) {
        const audio = new Audio(data.audioUrl);
        audio.play().catch(err => console.error('Audio play failed:', err));

        audio.onended = () => {
          setPreviewingVoice(null);
        };
      } else {
        setPreviewingVoice(null);
      }
    } catch (error) {
      console.error("Error previewing voice:", error);
      toast.error(error.message || "Failed to preview voice");
      setPreviewingVoice(null);
    }
  };

  const getStageNameForAdmin = (stage: number): string => {
    const stageNames = [
      "Egg", "Hatchling", "Sproutling", "Cub", "Juvenile",
      "Apprentice", "Scout", "Fledgling", "Warrior", "Guardian",
      "Champion", "Ascended", "Vanguard", "Titan", "Mythic",
      "Prime", "Regal", "Eternal", "Transcendent", "Apex", "Ultimate Form"
    ];
    return stageNames[stage] || "Unknown";
  };


  const handleGenerateSampleCard = async () => {
    setGeneratingSampleCard(true);
    setGeneratedSampleCard(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-sample-card", {
        body: {
          spiritAnimal: sampleCardData.spiritAnimal,
          element: sampleCardData.element,
          stage: sampleCardData.stage,
          favoriteColor: sampleCardData.favoriteColor,
          eyeColor: sampleCardData.eyeColor || undefined,
          furColor: sampleCardData.furColor || undefined,
          mind: sampleCardData.mind,
          body: sampleCardData.body,
          soul: sampleCardData.soul,
          customName: sampleCardData.customName || undefined,
        },
      });

      if (error) throw error;

      setGeneratedSampleCard(data.card);
      toast.success("Sample card generated!");
    } catch (error: any) {
      console.error("Error generating sample card:", error);
      toast.error(error.message || "Failed to generate sample card");
    } finally {
      setGeneratingSampleCard(false);
    }
  };

  const handleGeneratePostcard = async () => {
    setGeneratingPostcard(true);
    setGeneratedPostcard(null);

    try {
      let sourceImageUrl = postcardTestData.sourceImageUrl;
      
      // If no source image provided, generate a companion image first
      if (!sourceImageUrl) {
        toast.info("Generating companion image first...");
        const { data: companionData, error: companionError } = await supabase.functions.invoke("generate-companion-image", {
          body: {
            spiritAnimal: postcardTestData.spiritAnimal,
            element: postcardTestData.element,
            stage: 5,
            favoriteColor: postcardTestData.favoriteColor,
            eyeColor: postcardTestData.eyeColor,
            furColor: postcardTestData.furColor,
          },
        });

        if (companionError) throw companionError;
        sourceImageUrl = companionData.imageUrl;
        toast.success("Companion image generated!");
      }

      toast.info("Generating cosmic postcard...");
      
      const { data, error } = await supabase.functions.invoke("generate-cosmic-postcard-test", {
        body: {
          milestonePercent: postcardTestData.milestonePercent,
          sourceImageUrl,
          companionData: {
            spirit_animal: postcardTestData.spiritAnimal,
            core_element: postcardTestData.element,
            favorite_color: postcardTestData.favoriteColor,
            eye_color: postcardTestData.eyeColor,
            fur_color: postcardTestData.furColor,
          },
        },
      });

      if (error) throw error;

      setGeneratedPostcard({
        imageUrl: data.imageUrl,
        locationName: data.locationName,
        locationDescription: data.locationDescription,
        caption: data.caption,
      });
      toast.success(`Postcard generated at ${data.locationName}!`);
    } catch (error: any) {
      console.error("Error generating postcard:", error);
      toast.error(error.message || "Failed to generate postcard");
    } finally {
      setGeneratingPostcard(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-cream-glow to-petal-pink/30 flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen pb-nav-safe bg-gradient-to-b from-cream-glow to-petal-pink/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage your pep talks</p>
        </div>

        {/* Tabs for Admin Features */}
        <div className="mb-8">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-soft">
            <div className="flex gap-4 mb-6 border-b border-border/50 pb-2">
              <button
                onClick={() => {/* Toggle to referral codes */}}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
              >
                Referral Codes
              </button>
              <button
                onClick={() => {/* Toggle to payouts */}}
                className="px-4 py-2 rounded-xl hover:bg-muted"
              >
                Payouts
              </button>
              <button
                onClick={() => {/* Toggle to testing */}}
                className="px-4 py-2 rounded-xl hover:bg-muted"
              >
                Testing Suite
              </button>
            </div>
            
          </div>
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

        {/* Companion Image Tester */}
        <AdminCompanionImageTester />

        {/* Sample Card Generator */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">🃏 Sample Card Generator</h2>
          <p className="text-muted-foreground mb-6">Generate complete trading cards with images, names, traits, and lore</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cardSpiritAnimal">Spirit Animal</Label>
                <select
                  id="cardSpiritAnimal"
                  value={sampleCardData.spiritAnimal}
                  onChange={(e) => setSampleCardData({ ...sampleCardData, spiritAnimal: e.target.value })}
                  className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
                >
                  <option value="wolf">Wolf</option>
                  <option value="lion">Lion</option>
                  <option value="tiger">Tiger</option>
                  <option value="eagle">Eagle</option>
                  <option value="bear">Bear</option>
                  <option value="phoenix">Phoenix</option>
                  <option value="dragon">Dragon</option>
                  <option value="shark">Shark</option>
                  <option value="whale">Whale</option>
                  <option value="dolphin">Dolphin</option>
                  <option value="owl">Owl</option>
                  <option value="fox">Fox</option>
                  <option value="panther">Panther</option>
                  <option value="hawk">Hawk</option>
                  <option value="lynx">Lynx</option>
                </select>
              </div>

              <div>
                <Label htmlFor="cardElement">Element</Label>
                <select
                  id="cardElement"
                  value={sampleCardData.element}
                  onChange={(e) => setSampleCardData({ ...sampleCardData, element: e.target.value })}
                  className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
                >
                  <option value="fire">Fire</option>
                  <option value="water">Water</option>
                  <option value="earth">Earth</option>
                  <option value="air">Air</option>
                  <option value="lightning">Lightning</option>
                  <option value="ice">Ice</option>
                  <option value="light">Light</option>
                  <option value="shadow">Shadow</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="cardStage">Evolution Stage: {sampleCardData.stage} - {getStageNameForAdmin(sampleCardData.stage)}</Label>
              <input
                type="range"
                id="cardStage"
                min="0"
                max="20"
                value={sampleCardData.stage}
                onChange={(e) => setSampleCardData({ ...sampleCardData, stage: parseInt(e.target.value) })}
                className="w-full h-10 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cardFavoriteColor">Favorite Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="cardFavoriteColor"
                    value={sampleCardData.favoriteColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, favoriteColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={sampleCardData.favoriteColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, favoriteColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cardEyeColor">Eye Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="cardEyeColor"
                    value={sampleCardData.eyeColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, eyeColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={sampleCardData.eyeColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, eyeColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cardFurColor">Fur/Scale Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="cardFurColor"
                    value={sampleCardData.furColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, furColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={sampleCardData.furColor}
                    onChange={(e) => setSampleCardData({ ...sampleCardData, furColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>
            </div>

            {/* Mind/Body/Soul Attributes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/50">
              <div>
                <Label htmlFor="cardMind">🧠 Mind: {sampleCardData.mind}</Label>
                <input
                  type="range"
                  id="cardMind"
                  min="0"
                  max="100"
                  value={sampleCardData.mind}
                  onChange={(e) => setSampleCardData({ ...sampleCardData, mind: parseInt(e.target.value) })}
                  className="w-full h-8 cursor-pointer"
                />
              </div>
              <div>
                <Label htmlFor="cardBody">💪 Body: {sampleCardData.body}</Label>
                <input
                  type="range"
                  id="cardBody"
                  min="0"
                  max="100"
                  value={sampleCardData.body}
                  onChange={(e) => setSampleCardData({ ...sampleCardData, body: parseInt(e.target.value) })}
                  className="w-full h-8 cursor-pointer"
                />
              </div>
              <div>
                <Label htmlFor="cardSoul">🔥 Soul: {sampleCardData.soul}</Label>
                <input
                  type="range"
                  id="cardSoul"
                  min="0"
                  max="100"
                  value={sampleCardData.soul}
                  onChange={(e) => setSampleCardData({ ...sampleCardData, soul: parseInt(e.target.value) })}
                  className="w-full h-8 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cardCustomName">Custom Name (Optional - leave blank for auto-generated)</Label>
              <Input
                type="text"
                id="cardCustomName"
                value={sampleCardData.customName}
                onChange={(e) => setSampleCardData({ ...sampleCardData, customName: e.target.value })}
                placeholder="Leave blank for AI to generate a name"
                className="rounded-2xl min-h-[44px] text-base"
              />
            </div>

            <Button
              onClick={handleGenerateSampleCard}
              disabled={generatingSampleCard}
              className="w-full rounded-2xl min-h-[48px] text-base"
            >
              {generatingSampleCard ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Card... (this may take a moment)
                </>
              ) : (
                "🃏 Generate Sample Card"
              )}
            </Button>

            {generatedSampleCard && (
              <div className="space-y-4 p-4 md:p-6 border rounded-2xl bg-card">
                <div className="flex justify-center">
                  <EvolutionCardFlip card={generatedSampleCard} />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Click the card to view full size • Click again to flip and see lore
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">
                  <div>Rarity: <span className="font-semibold text-foreground">{generatedSampleCard.rarity}</span></div>
                  <div>Energy Cost: <span className="font-semibold text-foreground">{generatedSampleCard.energy_cost}</span></div>
                  <div>Bond Level: <span className="font-semibold text-foreground">{generatedSampleCard.bond_level}</span></div>
                  <div>Card ID: <span className="font-mono text-xs text-foreground">{generatedSampleCard.card_id}</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Cosmic Postcard Generator */}
        <Card className="p-4 md:p-6 mb-8 rounded-3xl shadow-soft bg-card">
          <h2 className="font-heading text-xl font-semibold mb-2">📸 Cosmic Postcard Tester</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Test the cosmic postcard generation system. Optionally provide a source image URL, or leave blank to generate a companion image first.
          </p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postcardAnimal">Spirit Animal</Label>
                <select
                  id="postcardAnimal"
                  value={postcardTestData.spiritAnimal}
                  onChange={(e) => setPostcardTestData({ ...postcardTestData, spiritAnimal: e.target.value })}
                  className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
                >
                  <option value="wolf">Wolf</option>
                  <option value="fox">Fox</option>
                  <option value="tiger">Tiger</option>
                  <option value="lion">Lion</option>
                  <option value="bear">Bear</option>
                  <option value="eagle">Eagle</option>
                  <option value="owl">Owl</option>
                  <option value="dragon">Dragon</option>
                  <option value="phoenix">Phoenix</option>
                  <option value="dolphin">Dolphin</option>
                  <option value="whale">Whale</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="deer">Deer</option>
                  <option value="cat">Cat</option>
                  <option value="dog">Dog</option>
                </select>
              </div>

              <div>
                <Label htmlFor="postcardElement">Element</Label>
                <select
                  id="postcardElement"
                  value={postcardTestData.element}
                  onChange={(e) => setPostcardTestData({ ...postcardTestData, element: e.target.value })}
                  className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
                >
                  <option value="fire">Fire</option>
                  <option value="water">Water</option>
                  <option value="earth">Earth</option>
                  <option value="air">Air</option>
                  <option value="lightning">Lightning</option>
                  <option value="ice">Ice</option>
                  <option value="light">Light</option>
                  <option value="shadow">Shadow</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="postcardMilestone">Milestone: {postcardTestData.milestonePercent}%</Label>
              <div className="flex gap-2 mt-2">
                {[25, 50, 75, 100].map((milestone) => (
                  <Button
                    key={milestone}
                    variant={postcardTestData.milestonePercent === milestone ? "default" : "outline"}
                    onClick={() => setPostcardTestData({ ...postcardTestData, milestonePercent: milestone })}
                    className="flex-1 rounded-xl"
                  >
                    {milestone}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="postcardFavoriteColor">Favorite Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="postcardFavoriteColor"
                    value={postcardTestData.favoriteColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, favoriteColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={postcardTestData.favoriteColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, favoriteColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="postcardEyeColor">Eye Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="postcardEyeColor"
                    value={postcardTestData.eyeColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, eyeColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={postcardTestData.eyeColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, eyeColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="postcardFurColor">Fur/Scale Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="postcardFurColor"
                    value={postcardTestData.furColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, furColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={postcardTestData.furColor}
                    onChange={(e) => setPostcardTestData({ ...postcardTestData, furColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="postcardSourceUrl">Source Image URL (Optional - leave blank to generate companion first)</Label>
              <Input
                type="text"
                id="postcardSourceUrl"
                value={postcardTestData.sourceImageUrl}
                onChange={(e) => setPostcardTestData({ ...postcardTestData, sourceImageUrl: e.target.value })}
                placeholder="https://... or leave blank"
                className="rounded-2xl min-h-[44px] text-base"
              />
            </div>

            <Button
              onClick={handleGeneratePostcard}
              disabled={generatingPostcard}
              className="w-full rounded-2xl min-h-[48px] text-base"
            >
              {generatingPostcard ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Postcard... (this may take a moment)
                </>
              ) : (
                "📸 Generate Cosmic Postcard"
              )}
            </Button>

            {generatedPostcard && (
              <div className="space-y-4 p-4 md:p-6 border rounded-2xl bg-card">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                  <img
                    src={generatedPostcard.imageUrl}
                    alt={`Postcard from ${generatedPostcard.locationName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{generatedPostcard.locationName}</h3>
                  <p className="text-sm text-muted-foreground">{generatedPostcard.locationDescription}</p>
                  <p className="text-sm italic">{generatedPostcard.caption}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadImage(generatedPostcard.imageUrl, `postcard-${generatedPostcard.locationName.replace(/\s+/g, '-').toLowerCase()}.png`)}
                    className="flex-1 rounded-xl"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

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
                <Label htmlFor="topic-category">Topic Categories (up to 4)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["discipline", "confidence", "physique", "focus", "mindset", "business"].map((cat) => {
                    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
                    return (
                      <Button
                        key={cat}
                        type="button"
                        variant={formData.topic_category.includes(cat) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const selected = formData.topic_category;
                          if (selected.includes(cat)) {
                            setFormData({
                              ...formData,
                              topic_category: selected.filter(c => c !== cat)
                            });
                          } else if (selected.length < 4) {
                            setFormData({
                              ...formData,
                              topic_category: [...selected, cat]
                            });
                          } else {
                            toast.error("Maximum 4 categories allowed");
                          }
                        }}
                        className="rounded-full text-xs"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {formData.topic_category.length}/4
                </p>
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

        {/* Referral Program Management */}
        <div className="space-y-6 mb-8">
          <AdminReferralAnalytics />
          <AdminReferralConfig />
          <AdminReferralCodes />
          <AdminPayouts />
          <AdminReferralTesting />
        </div>

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
