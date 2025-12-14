import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDocuments, getDocument, setDocument, deleteDocument, updateDocument } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { 
  generateMentorAudio, 
  generateCompanionImage, 
  generateSampleCard, 
  generateCosmicPostcard,
  generateCompletePepTalk,
  generateDailyMentorPepTalks,
  generateSingleMentorPepTalk,
  batchGeneratePepTalks,
  generateCompanionName
} from "@/lib/firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Edit, Plus, Upload, X, Loader2, Music, Download, Share } from "lucide-react";
import { AudioGenerator } from "@/components/AudioGenerator";
import { downloadImage } from "@/utils/imageDownload";
import { AdminPayouts } from "@/components/AdminPayouts";
import { AdminReferralCodes } from "@/components/AdminReferralCodes";
import { AdminReferralTesting } from "@/components/AdminReferralTesting";
import { EvolutionCardFlip } from "@/components/EvolutionCardFlip";
import { Capacitor } from '@capacitor/core';
import { globalAudio } from "@/utils/globalAudio";

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
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PepTalk | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatingDailyPepTalks, setGeneratingDailyPepTalks] = useState(false);
  const [generatingBatchPepTalks, setGeneratingBatchPepTalks] = useState(false);
  const [mentorPepTalkStatus, setMentorPepTalkStatus] = useState<Record<string, 'idle' | 'generating' | 'generated' | 'skipped' | 'error'>>({});
  const [currentGeneratingMentor, setCurrentGeneratingMentor] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  // Companion Image Tester State
  const [companionTestData, setCompanionTestData] = useState({
    spiritAnimal: "wolf",
    element: "fire",
    stage: 0,
    favoriteColor: "#FF6B35",
    eyeColor: "#FFD700",
    furColor: "#8B4513",
  });
  const [generatingCompanionImage, setGeneratingCompanionImage] = useState(false);
  const [generatedCompanionImage, setGeneratedCompanionImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  
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

  // Companion Name Generator State
  const [nameTestData, setNameTestData] = useState({
    spiritAnimal: "wolf",
    coreElement: "fire",
    favoriteColor: "crimson",
    mind: 50,
    body: 50,
    soul: 50,
  });
  const [generatingName, setGeneratingName] = useState(false);
  const [generatedName, setGeneratedName] = useState<{
    name: string;
    traits: string[];
    storyText: string;
    loreSeed: string;
  } | null>(null);
  const [nameTestAttempts, setNameTestAttempts] = useState<number[]>([]);
  
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

      // TODO: Migrate admin role check to Firestore custom claims or a user_roles collection
      // For now, check if user has admin role in profile or custom claims
      const profile = await getDocument("profiles", user.uid);
      const isAdminUser = profile?.role === "admin" || profile?.is_admin === true;
      
      if (!isAdminUser) {
        console.debug('Admin check failed', { userId: user.uid });
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

  const [searchParams] = useSearchParams();
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    if (isAdmin) {
      fetchPepTalks();
      fetchMentors();
    }
  }, [isAdmin]);

  const fetchMentors = async () => {
    try {
      const data = await getDocuments("mentors", undefined, "name", "asc");
      setMentors(data || []);
    } catch (error) {
      console.error("Error fetching mentors:", error);
      toast.error("Failed to load mentors");
    }
  };

  const fetchPepTalks = async () => {
    try {
      const data = await getDocuments("pep_talks", undefined, "created_at", "desc");
      setPepTalks((data || []) as PepTalk[]);
    } catch (error) {
      toast.error("Failed to load pep talks");
    }
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

      const { uploadFile } = await import("@/lib/firebase/storage");
      const publicUrl = await uploadFile('pep-talk-audio', filePath, audioFile);
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

    try {
      if (editingId) {
        await updateDocument("pep_talks", editingId, pepTalkData);
        toast.success("Pep talk updated successfully");
      } else {
        const pepTalkId = `pep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDocument("pep_talks", pepTalkId, {
          id: pepTalkId,
          ...pepTalkData,
        }, false);
        toast.success("Pep talk created successfully");
      }
    } catch (error) {
      toast.error(editingId ? "Failed to update pep talk" : "Failed to create pep talk");
      setUploading(false);
      return;
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

    try {
      await deleteDocument("pep_talks", id);
      toast.success("Pep talk deleted successfully");
      fetchPepTalks();
    } catch (error) {
      toast.error("Failed to delete pep talk");
    }
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
      const data = await generateMentorAudio({
        mentorSlug,
        script: previewText,
      });

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

  const handleGenerateCompanionImage = async () => {
    setGeneratingCompanionImage(true);
    setGeneratedCompanionImage(null);
    setGeneratedPrompt(null);

    try {
      const data = await generateCompanionImage({
        companionId: "test",
        stage: companionTestData.stage || 0,
        species: companionTestData.spiritAnimal,
        element: companionTestData.element,
        color: companionTestData.favoriteColor,
      });

      const imageUrl = (data as any)?.imageData?.imageUrl || (data as any)?.imageUrl;
      setGeneratedCompanionImage(imageUrl);
      setGeneratedPrompt((data as any).prompt || "Prompt not returned");
      toast.success("Companion image generated successfully!");
    } catch (error) {
      console.error("Error generating companion image:", error);
      toast.error(error.message || "Failed to generate companion image");
    } finally {
      setGeneratingCompanionImage(false);
    }
  };

  const handleGenerateCompanionName = async () => {
    setGeneratingName(true);
    setGeneratedName(null);
    setNameTestAttempts([]);
    const startTime = Date.now();

    try {
      const data = await generateCompanionName({
        spiritAnimal: nameTestData.spiritAnimal,
        favoriteColor: nameTestData.favoriteColor,
        coreElement: nameTestData.coreElement,
        userAttributes: {
          mind: nameTestData.mind,
          body: nameTestData.body,
          soul: nameTestData.soul,
        },
      });

      const elapsed = Date.now() - startTime;
      setNameTestAttempts([elapsed]);
      setGeneratedName({
        name: data.name,
        traits: data.traits || [],
        storyText: data.storyText || "",
        loreSeed: data.loreSeed || "",
      });
      
      // Check if name seems generic
      const lowerName = data.name.toLowerCase();
      const genericWords = ['pup', 'puppy', 'cub', 'wolf', 'fox', 'dragon', 'fire', 'storm', 'lightning'];
      const isGeneric = genericWords.some(word => lowerName.includes(word));
      
      if (isGeneric) {
        toast.warning(`Generated name "${data.name}" may be too generic!`);
      } else {
        toast.success(`Generated unique name: "${data.name}"!`);
      }
    } catch (error: any) {
      console.error("Error generating companion name:", error);
      toast.error(error.message || "Failed to generate companion name");
    } finally {
      setGeneratingName(false);
    }
  };

  const handleGenerateSampleCard = async () => {
    setGeneratingSampleCard(true);
    setGeneratedSampleCard(null);

    try {
      const data = await generateSampleCard({
        species: sampleCardData.spiritAnimal,
        element: sampleCardData.element,
        stage: sampleCardData.stage,
      });

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
        const companionData = await generateCompanionImage({
          companionId: "test",
          stage: 5,
          species: postcardTestData.spiritAnimal,
          element: postcardTestData.element,
          color: postcardTestData.favoriteColor,
        });
        sourceImageUrl = (companionData as any)?.imageData?.imageUrl || (companionData as any)?.imageUrl;
        toast.success("Companion image generated!");
      }

      toast.info("Generating cosmic postcard...");
      
      const data = await generateCosmicPostcard({
        companionId: "test",
        occasion: `Milestone: ${postcardTestData.milestonePercent}%`,
      });

      const postcard = data?.postcard || data;
      setGeneratedPostcard({
        imageUrl: postcard.imageUrl || postcard.imageData?.imageUrl,
        locationName: postcard.locationName,
        locationDescription: postcard.locationDescription,
        caption: postcard.caption,
      });
      toast.success(`Postcard generated at ${postcard.locationName}!`);
    } catch (error: any) {
      console.error("Error generating postcard:", error);
      toast.error(error.message || "Failed to generate postcard");
    } finally {
      setGeneratingPostcard(false);
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
      const contentData = await generateCompletePepTalk({
        mentorSlug: mentor.slug,
        topicCategory: formData.category || "motivation",
      });

      // Step 2: Generate audio from the script
      toast.info("Generating audio...");
      const pepTalkData = (contentData as any).pepTalk || contentData;
      const audioData = await generateMentorAudio({
        mentorSlug: mentor.slug,
        script: pepTalkData.script || (contentData as any).script,
      });


      // Update form with all generated data
      setFormData(prev => ({
        ...prev,
        title: pepTalkData.title || (contentData as any).title,
        quote: pepTalkData.quote || (contentData as any).quote,
        description: pepTalkData.description || (contentData as any).description,
        category: pepTalkData.category || (contentData as any).category || formData.category,
        audio_url: audioData.audioUrl,
      }));

      setIsEditing(true);
      toast.success("Complete pep talk generated successfully!");
    } catch (error) {
      console.error("Error generating complete pep talk:", error);
      toast.error(error.message || "Failed to generate pep talk");
    } finally {
      setAiGenerating(false);
    }
  };

  const MENTOR_SLUGS = ["atlas", "darius", "eli", "nova", "sienna", "lumi", "kai", "stryker", "solace"];

  const handleGenerateSingleMentorPepTalk = async (mentorSlug: string) => {
    setMentorPepTalkStatus(prev => ({ ...prev, [mentorSlug]: 'generating' }));
    setCurrentGeneratingMentor(mentorSlug);
    
    try {
      const result = await generateSingleMentorPepTalk({ mentorSlug });
      
      if (result.status === 'skipped') {
        setMentorPepTalkStatus(prev => ({ ...prev, [mentorSlug]: 'skipped' }));
        toast.info(`${mentorSlug}: Already generated for today`);
      } else if (result.status === 'generated') {
        setMentorPepTalkStatus(prev => ({ ...prev, [mentorSlug]: 'generated' }));
        toast.success(`${mentorSlug}: Pep talk generated!`);
      }
    } catch (error) {
      console.error(`Error generating pep talk for ${mentorSlug}:`, error);
      setMentorPepTalkStatus(prev => ({ ...prev, [mentorSlug]: 'error' }));
      toast.error(`${mentorSlug}: ${error instanceof Error ? error.message : 'Failed'}`);
    } finally {
      setCurrentGeneratingMentor(null);
    }
  };

  const handleGenerateAllMentorPepTalks = async () => {
    setGeneratingDailyPepTalks(true);
    
    // Reset all statuses
    setMentorPepTalkStatus({});
    
    toast.info("Generating pep talks for all mentors one at a time...");
    
    for (const mentorSlug of MENTOR_SLUGS) {
      try {
        await handleGenerateSingleMentorPepTalk(mentorSlug);
        // Small delay between mentors
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Continue to next mentor even if one fails
        console.error(`Failed for ${mentorSlug}, continuing...`, error);
      }
    }
    
    setGeneratingDailyPepTalks(false);
    
    // Summary
    const generated = Object.values(mentorPepTalkStatus).filter(s => s === 'generated').length;
    const skipped = Object.values(mentorPepTalkStatus).filter(s => s === 'skipped').length;
    const errors = Object.values(mentorPepTalkStatus).filter(s => s === 'error').length;
    
    toast.success(`Complete! Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`);
  };

  // Keep legacy function for backward compatibility
  const handleGenerateDailyPepTalks = handleGenerateAllMentorPepTalks;

  const handleBatchGeneratePepTalks = async () => {
    setGeneratingBatchPepTalks(true);
    try {
      toast.info("Starting batch generation of 45 pep talks with audio... This will take several minutes.");
      const result = await batchGeneratePepTalks();
      
      if (result?.summary) {
        const { generated, skipped, errors } = result.summary;
        if (errors > 0) {
          toast.warning(
            `Generated ${generated}, skipped ${skipped}, ${errors} errors. Check console for details.`,
            { duration: 10000 }
          );
        } else {
          toast.success(
            `Successfully generated ${generated} pep talks with audio! ${skipped} were already generated.`,
            { duration: 8000 }
          );
        }
      } else {
        toast.success("Batch pep talks generation completed!");
      }
    } catch (error) {
      console.error("Error batch generating pep talks:", error);
      toast.error(error instanceof Error ? error.message : "Failed to batch generate pep talks");
    } finally {
      setGeneratingBatchPepTalks(false);
    }
  };

  // Auto-trigger removed - use manual buttons instead

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

        {/* Daily Operations */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">📅 Daily Operations</h2>
          <p className="text-muted-foreground mb-6">
            Manually trigger daily operations that normally run automatically via scheduled functions
          </p>
          
          <div className="space-y-4">
            <div className="p-4 border rounded-2xl bg-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Generate Daily Pep Talks</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate today's pep talks one mentor at a time to avoid timeouts.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateAllMentorPepTalks}
                  disabled={generatingDailyPepTalks || currentGeneratingMentor !== null}
                  variant="default"
                  size="sm"
                >
                  {generatingDailyPepTalks ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating All...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Generate All
                    </>
                  )}
                </Button>
              </div>
              
              {/* Per-Mentor Generation Grid */}
              <div className="grid grid-cols-3 gap-2">
                {MENTOR_SLUGS.map((slug) => {
                  const status = mentorPepTalkStatus[slug] || 'idle';
                  const isGenerating = currentGeneratingMentor === slug;
                  
                  return (
                    <Button
                      key={slug}
                      variant={status === 'generated' ? 'default' : status === 'skipped' ? 'secondary' : status === 'error' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleGenerateSingleMentorPepTalk(slug)}
                      disabled={isGenerating || generatingDailyPepTalks}
                      className="capitalize text-xs"
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : status === 'generated' ? (
                        <span className="mr-1">✓</span>
                      ) : status === 'skipped' ? (
                        <span className="mr-1">—</span>
                      ) : status === 'error' ? (
                        <span className="mr-1">✗</span>
                      ) : null}
                      {slug}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Batch Generate Starter Pep Talks */}
            <div className="p-4 border rounded-2xl bg-card border-amber-500/30">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    🎵 Batch Generate Starter Pep Talks
                    <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full">45 Total</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Generate 5 pep talks per mentor (9 mentors × 5 topics) with full audio and word-by-word captions.
                    This takes ~10-15 minutes and uses ElevenLabs + OpenAI Whisper.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleBatchGeneratePepTalks}
                disabled={generatingBatchPepTalks || generatingDailyPepTalks}
                variant="outline"
                className="mt-4 border-amber-500/50 hover:bg-amber-500/10"
              >
                {generatingBatchPepTalks ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating 45 Pep Talks...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-4 w-4" />
                    Generate Starter Content (45 Pep Talks)
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Companion Image Tester */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">🎨 Companion Image Tester</h2>
          <p className="text-muted-foreground mb-6">Test companion image generation for different animals, elements, and stages</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="spiritAnimal">Spirit Animal</Label>
                <select
                  id="spiritAnimal"
                  value={companionTestData.spiritAnimal}
                  onChange={(e) => setCompanionTestData({ ...companionTestData, spiritAnimal: e.target.value })}
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
                <Label htmlFor="element">Element</Label>
                <select
                  id="element"
                  value={companionTestData.element}
                  onChange={(e) => setCompanionTestData({ ...companionTestData, element: e.target.value })}
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
              <Label htmlFor="stage">Evolution Stage: {companionTestData.stage} - {getStageNameForAdmin(companionTestData.stage)}</Label>
              <input
                type="range"
                id="stage"
                min="0"
                max="20"
                value={companionTestData.stage}
                onChange={(e) => setCompanionTestData({ ...companionTestData, stage: parseInt(e.target.value) })}
                className="w-full h-10 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="favoriteColor">Favorite Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="favoriteColor"
                    value={companionTestData.favoriteColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, favoriteColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={companionTestData.favoriteColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, favoriteColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                    placeholder="#FF6B35"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="eyeColor">Eye Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="eyeColor"
                    value={companionTestData.eyeColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, eyeColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={companionTestData.eyeColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, eyeColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                    placeholder="#FFD700"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="furColor">Fur/Scale Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="furColor"
                    value={companionTestData.furColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, furColor: e.target.value })}
                    className="w-16 h-12 rounded-2xl cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={companionTestData.furColor}
                    onChange={(e) => setCompanionTestData({ ...companionTestData, furColor: e.target.value })}
                    className="flex-1 rounded-2xl min-h-[44px] text-base"
                    placeholder="#8B4513"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerateCompanionImage}
              disabled={generatingCompanionImage}
              className="w-full rounded-2xl min-h-[48px] text-base"
            >
              {generatingCompanionImage ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Image...
                </>
              ) : (
                "🔄 Generate Companion Image"
              )}
            </Button>

            {generatedCompanionImage && (
              <div className="space-y-4 p-4 md:p-6 border rounded-2xl bg-card">
                <div className="flex justify-center">
                  <img
                    src={generatedCompanionImage}
                    alt="Generated Companion"
                    className="max-w-md w-full rounded-2xl shadow-lg touch-manipulation"
                  />
                </div>
                {generatedPrompt && (
                  <div className="space-y-2">
                    <Label>Generated Prompt:</Label>
                    <Textarea
                      value={generatedPrompt}
                      readOnly
                      className="font-mono text-xs rounded-2xl min-h-[100px]"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => downloadImage(
                      generatedCompanionImage,
                      `companion-${companionTestData.spiritAnimal}-stage${companionTestData.stage}.png`
                    )}
                    variant="outline"
                    className="flex-1 rounded-2xl min-h-[44px]"
                  >
                    {Capacitor.isNativePlatform() ? (
                      <>
                        <Share className="h-4 w-4 mr-2" />
                        Share Image
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Image
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Companion Name Generator Tester */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">✨ Companion Name Generator Tester</h2>
          <p className="text-muted-foreground mb-6">Test companion name generation to verify it avoids generic names</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nameSpiritAnimal">Spirit Animal</Label>
                <select
                  id="nameSpiritAnimal"
                  value={nameTestData.spiritAnimal}
                  onChange={(e) => setNameTestData({ ...nameTestData, spiritAnimal: e.target.value })}
                  className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
                >
                  <option value="wolf">Wolf</option>
                  <option value="lion">Lion</option>
                  <option value="tiger">Tiger</option>
                  <option value="eagle">Eagle</option>
                  <option value="bear">Bear</option>
                  <option value="phoenix">Phoenix</option>
                  <option value="dragon">Dragon</option>
                  <option value="fox">Fox</option>
                </select>
              </div>

              <div>
                <Label htmlFor="nameElement">Core Element</Label>
                <select
                  id="nameElement"
                  value={nameTestData.coreElement}
                  onChange={(e) => setNameTestData({ ...nameTestData, coreElement: e.target.value })}
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

              <div>
                <Label htmlFor="nameColor">Favorite Color</Label>
                <Input
                  id="nameColor"
                  value={nameTestData.favoriteColor}
                  onChange={(e) => setNameTestData({ ...nameTestData, favoriteColor: e.target.value })}
                  className="rounded-2xl min-h-[44px] text-base"
                  placeholder="crimson, azure, emerald..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nameMind">Mind: {nameTestData.mind}</Label>
                <input
                  type="range"
                  id="nameMind"
                  min="0"
                  max="100"
                  value={nameTestData.mind}
                  onChange={(e) => setNameTestData({ ...nameTestData, mind: parseInt(e.target.value) })}
                  className="w-full h-10 cursor-pointer"
                />
              </div>
              <div>
                <Label htmlFor="nameBody">Body: {nameTestData.body}</Label>
                <input
                  type="range"
                  id="nameBody"
                  min="0"
                  max="100"
                  value={nameTestData.body}
                  onChange={(e) => setNameTestData({ ...nameTestData, body: parseInt(e.target.value) })}
                  className="w-full h-10 cursor-pointer"
                />
              </div>
              <div>
                <Label htmlFor="nameSoul">Soul: {nameTestData.soul}</Label>
                <input
                  type="range"
                  id="nameSoul"
                  min="0"
                  max="100"
                  value={nameTestData.soul}
                  onChange={(e) => setNameTestData({ ...nameTestData, soul: parseInt(e.target.value) })}
                  className="w-full h-10 cursor-pointer"
                />
              </div>
            </div>

            <Button
              onClick={handleGenerateCompanionName}
              disabled={generatingName}
              className="w-full rounded-2xl min-h-[48px] text-base"
            >
              {generatingName ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Name...
                </>
              ) : (
                "✨ Generate Companion Name"
              )}
            </Button>

            {generatedName && (
              <div className="space-y-4 p-4 md:p-6 border rounded-2xl bg-card">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Generated Name:</Label>
                    {nameTestAttempts.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Generated in {nameTestAttempts[0]}ms
                      </span>
                    )}
                  </div>
                  <div className="p-4 bg-primary/10 rounded-2xl">
                    <p className="text-2xl font-bold text-primary">{generatedName.name}</p>
                  </div>
                </div>

                {generatedName.traits && generatedName.traits.length > 0 && (
                  <div className="space-y-2">
                    <Label>Traits:</Label>
                    <div className="flex flex-wrap gap-2">
                      {generatedName.traits.map((trait, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-muted rounded-full text-sm"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {generatedName.storyText && (
                  <div className="space-y-2">
                    <Label>Story:</Label>
                    <Textarea
                      value={generatedName.storyText}
                      readOnly
                      className="rounded-2xl min-h-[150px] text-sm"
                    />
                  </div>
                )}

                {generatedName.loreSeed && (
                  <div className="space-y-2">
                    <Label>Lore Seed:</Label>
                    <p className="p-3 bg-muted/50 rounded-2xl text-sm italic">
                      {generatedName.loreSeed}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> The name should be unique and NOT contain generic words like "pup", "cub", "wolf", "fire", etc.
                    If it does, the validation should catch it and retry automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Sample Card Generator */}
        <Card className="p-6 mb-8 rounded-3xl shadow-soft">
          <h2 className="font-heading text-2xl font-semibold mb-4">🃏 Sample Card Generator</h2>
          <p className="text-muted-foreground mb-6">Generate complete trading cards with AI-generated images, names, traits, and lore</p>
          
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
              <Label htmlFor="cardCustomName">Custom Name (Optional - leave blank for AI-generated)</Label>
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

        {/* Referral Codes Management */}
        <div className="space-y-6 mb-8">
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
