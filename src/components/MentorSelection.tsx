import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getMentors } from "@/lib/firebase/mentors";
import { getQuotes } from "@/lib/firebase/quotes";
import { getDocuments } from "@/lib/firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Mentor {
  id: string;
  name: string;
  description: string;
  identity_description: string | null;
  tone_description: string;
  style: string | null;
  tags: string[];
}

interface Quote {
  id: string;
  text: string;
  mentor_id: string;
}

interface PepTalk {
  id: string;
  title: string;
  description: string;
  quote: string;
  mentor_id: string;
}

interface MentorSelectionModalProps {
  recommendedMentor: Mentor;
  onMentorSelected: (mentorId: string) => void;
}

/**
 * MentorSelectionModal - A modal/dialog component for selecting mentors
 * Note: This is different from the MentorSelection page component
 */
export const MentorSelectionModal = ({ recommendedMentor, onMentorSelected }: MentorSelectionModalProps) => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<Mentor>(recommendedMentor);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMentors();
  }, []);

  useEffect(() => {
    if (selectedMentor) {
      fetchMentorContent(selectedMentor.id);
    }
  }, [selectedMentor]);

  const fetchMentors = async () => {
    try {
      const data = await getMentors(false); // Get all mentors, not just active
      setMentors(data);
    } catch (error) {
      console.error("Error fetching mentors:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentorContent = async (mentorId: string) => {
    try {
      // Fetch quotes with null safety
      const quotesData = (await getQuotes(mentorId, 3)) || [];
      setQuotes(quotesData.map(q => ({ id: q.id, text: q.quote, mentor_id: q.mentor_id || mentorId })));

      // Fetch pep talks with null safety
      const pepTalksData = (await getDocuments(
        "pep_talks",
        [["mentor_id", "==", mentorId]],
        undefined,
        undefined,
        3
      )) || [];
      setPepTalks(pepTalksData.map(pt => ({
        id: pt.id,
        title: pt.title,
        description: pt.description,
        quote: pt.quote,
        mentor_id: pt.mentor_id || mentorId,
      })));
    } catch (error) {
      console.error("Error fetching mentor content:", error);
      // Set empty arrays on error to prevent UI issues
      setQuotes([]);
      setPepTalks([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <p className="text-steel text-lg">Loading mentors...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-black text-pure-white mb-2">Choose Your Motivator</h1>
          <p className="text-steel text-lg">
            We recommend <span className="text-royal-gold font-bold">{recommendedMentor.name}</span> based on your answers
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Mentor List */}
          <div className="lg:col-span-1">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {mentors.map((mentor) => (
                  <Card
                    key={mentor.id}
                    onClick={() => setSelectedMentor(mentor)}
                    className={`p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                      selectedMentor.id === mentor.id
                        ? "bg-royal-gold/20 border-royal-gold"
                        : "bg-graphite border-steel/20 hover:border-royal-gold/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-black text-pure-white">{mentor.name}</h3>
                      {mentor.id === recommendedMentor.id && (
                        <Badge className="bg-royal-gold text-obsidian">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-steel text-sm mb-3">{mentor.identity_description || mentor.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {mentor.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-steel/30 text-steel">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Mentor Preview */}
          <div className="lg:col-span-2">
            <Card className="bg-graphite border-steel/20 p-6 h-[600px] flex flex-col">
              <div className="mb-6">
                <h2 className="text-3xl font-black text-pure-white mb-2">{selectedMentor.name}</h2>
                <p className="text-steel mb-4">{selectedMentor.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-royal-gold font-semibold">Tone:</span>
                    <span className="text-pure-white">{selectedMentor.tone_description}</span>
                  </div>
                  {selectedMentor.style && (
                    <div className="flex items-center gap-2">
                      <span className="text-royal-gold font-semibold">Style:</span>
                      <span className="text-pure-white">{selectedMentor.style}</span>
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="quotes" className="flex-1 flex flex-col">
                <TabsList className="bg-obsidian border-steel/20">
                  <TabsTrigger value="quotes">Quotes</TabsTrigger>
                  <TabsTrigger value="peptalks">Pep Talks</TabsTrigger>
                </TabsList>

                <TabsContent value="quotes" className="flex-1 mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {quotes.length > 0 ? (
                        quotes.map((quote) => (
                          <Card key={quote.id} className="bg-obsidian border-steel/20 p-4">
                            <p className="text-pure-white italic">"{quote.text}"</p>
                          </Card>
                        ))
                      ) : (
                        <p className="text-steel text-center py-8">No quotes available for this mentor yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="peptalks" className="flex-1 mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {pepTalks.length > 0 ? (
                        pepTalks.map((pepTalk) => (
                          <Card key={pepTalk.id} className="bg-obsidian border-steel/20 p-4">
                            <h4 className="text-lg font-bold text-royal-gold mb-2">{pepTalk.title}</h4>
                            <p className="text-steel text-sm mb-2">{pepTalk.description}</p>
                            <p className="text-pure-white italic">"{pepTalk.quote}"</p>
                          </Card>
                        ))
                      ) : (
                        <p className="text-steel text-center py-8">No pep talks available for this mentor yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              <Button
                onClick={() => onMentorSelected(selectedMentor.id)}
                className="w-full mt-6 py-7 text-lg font-black uppercase tracking-wider"
              >
                Choose {selectedMentor.name}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
