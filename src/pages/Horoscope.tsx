import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Star, Moon, Sun, Settings, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";

const Horoscope = () => {
  const [horoscope, setHoroscope] = useState<string | null>(null);
  const [zodiac, setZodiac] = useState<string | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    generateHoroscope();
  }, []);

  const generateHoroscope = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-horoscope');

      if (error) throw error;

      setHoroscope(data.horoscope);
      setZodiac(data.zodiac);
      setIsPersonalized(data.isPersonalized);
      setDate(data.date);
    } catch (error: any) {
      console.error('Error generating horoscope:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load your horoscope",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getZodiacIcon = () => {
    if (isPersonalized) return <Star className="w-6 h-6 text-accent-purple" />;
    return <Sparkles className="w-6 h-6 text-royal-purple" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-obsidian to-obsidian/95 p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/mentor-chat')}
            className="text-steel hover:text-pure-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold text-pure-white flex items-center justify-center gap-2">
              <Moon className="w-8 h-8 text-accent-purple" />
              Daily Horoscope
            </h1>
            <p className="text-steel text-sm mt-1">
              {date ? formatDate(date) : 'Loading...'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="text-steel hover:text-pure-white"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Horoscope Card */}
        <Card className="bg-obsidian/50 border-royal-purple/30 backdrop-blur-sm p-8">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 bg-steel/20" />
              <Skeleton className="h-4 w-full bg-steel/20" />
              <Skeleton className="h-4 w-full bg-steel/20" />
              <Skeleton className="h-4 w-3/4 bg-steel/20" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Zodiac Badge */}
              <div className="flex items-center gap-3">
                {getZodiacIcon()}
                <div>
                  <h2 className="text-xl font-semibold text-pure-white capitalize">
                    {zodiac}
                  </h2>
                  <p className="text-xs text-steel">
                    {isPersonalized ? 'Personalized Reading' : 'Daily Overview'}
                  </p>
                </div>
              </div>

              {/* Horoscope Content */}
              <div className="prose prose-invert max-w-none">
                <p className="text-cloud-white leading-relaxed whitespace-pre-wrap">
                  {horoscope}
                </p>
              </div>

              {/* Unlock Advanced Astrology CTA */}
              {!isPersonalized && (
                <div className="mt-6 p-4 rounded-lg bg-royal-purple/10 border border-royal-purple/30">
                  <div className="flex items-start gap-3">
                    <Sun className="w-5 h-5 text-accent-purple flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-cloud-white mb-2">
                        Want a personalized reading with your rising sign and planetary transits?
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/profile')}
                        className="border-royal-purple/50 text-accent-purple hover:bg-royal-purple/20"
                      >
                        Add Birth Details
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Cosmic Tip */}
        <Card className="bg-gradient-to-r from-royal-purple/10 to-accent-purple/10 border-royal-purple/30 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-accent-purple flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-pure-white mb-1">
                Cosmic Tip
              </h3>
              <p className="text-sm text-cloud-white">
                Your horoscope refreshes daily. Check back tomorrow for new cosmic guidance!
              </p>
            </div>
          </div>
        </Card>

        {/* Refresh Button */}
        <Button
          onClick={generateHoroscope}
          disabled={loading}
          className="w-full bg-royal-purple hover:bg-accent-purple text-pure-white"
        >
          {loading ? 'Loading...' : 'Refresh Horoscope'}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Horoscope;
