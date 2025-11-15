import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Target, Heart, Sparkles, Brain, Focus, Users, Moon,
  Clock, Calendar, Settings
} from "lucide-react";

type Category = 'discipline' | 'confidence' | 'healing' | 'calm' | 'focus' | 'love' | 'spiritual';
type Frequency = 'daily' | '3_per_week' | 'weekly' | 'random' | 'event_based';
type TimeWindow = 'morning' | 'midday' | 'evening' | 'night' | 'any';
type Intensity = 'soft' | 'balanced' | 'strong';

const categories = [
  { id: 'discipline' as Category, label: 'Discipline', icon: Target, color: '#E94B3C' },
  { id: 'confidence' as Category, label: 'Confidence', icon: Sparkles, color: '#CDAA7D' },
  { id: 'healing' as Category, label: 'Healing', icon: Heart, color: '#F97583' },
  { id: 'calm' as Category, label: 'Calm', icon: Moon, color: '#7DCDAA' },
  { id: 'focus' as Category, label: 'Focus', icon: Focus, color: '#AA7DCD' },
  { id: 'love' as Category, label: 'Love & Relationships', icon: Users, color: '#FF85A1' },
  { id: 'spiritual' as Category, label: 'Spiritual & Intuition', icon: Brain, color: '#85C1FF' },
];

const emotionalTriggers = [
  'Overthinking', 'Lonely', 'Unfocused', 'Unmotivated', 'Heartbroken', 'Stressed'
];

export default function AdaptivePushes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('morning');
  const [intensity, setIntensity] = useState<Intensity>('balanced');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [existingSettings, setExistingSettings] = useState<any>(null);

  useEffect(() => {
    loadExistingSettings();
  }, [user]);

  const loadExistingSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('adaptive_push_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .single();

    if (data) {
      setExistingSettings(data);
      const cats = data.categories || (data.primary_category ? [data.primary_category] : []);
      setSelectedCategories(cats as Category[]);
      setFrequency(data.frequency as Frequency);
      setTimeWindow(data.time_window as TimeWindow);
      setIntensity(data.intensity as Intensity);
      setSelectedTriggers(data.emotional_triggers || []);
    }
  };

  const toggleCategory = (categoryId: Category) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleTrigger = (trigger: string) => {
    setSelectedTriggers(prev =>
      prev.includes(trigger)
        ? prev.filter(t => t !== trigger)
        : [...prev, trigger]
    );
  };

  const handleSave = async () => {
    if (!user || selectedCategories.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select at least one category",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upsert settings
      const { data: settings, error: settingsError } = await supabase
        .from('adaptive_push_settings')
        .upsert({
          id: existingSettings?.id,
          user_id: user.id,
          primary_category: selectedCategories[0],
          categories: selectedCategories,
          frequency,
          time_window: timeWindow,
          intensity,
          emotional_triggers: selectedTriggers,
          enabled: true,
        })
        .select()
        .single();

      if (settingsError) throw settingsError;

      // Schedule pushes
      const { error: scheduleError } = await supabase.functions.invoke('schedule-adaptive-pushes', {
        body: { userId: user.id, settingsId: settings.id }
      });

      if (scheduleError) throw scheduleError;

      toast({
        title: "Adaptive Pushes™ Activated",
        description: "Your mentor will reach out with personalized guidance.",
      });

      navigate('/profile');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-pure-white">Adaptive Pushes™</h1>
          <p className="text-steel text-lg">
            Smart reminders in the voice you need, exactly when you need them.
          </p>
        </div>

        {/* Category Selection - Multi-select */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-royal-gold" />
            What type(s) of guidance do you want?
          </h2>
          <p className="text-steel text-sm">You can choose more than one. We recommend 1–3.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map(({ id, label, icon: Icon, color }) => (
              <Card
                key={id}
                onClick={() => toggleCategory(id)}
                className={`p-4 cursor-pointer transition-all ${
                  selectedCategories.includes(id)
                    ? 'border-royal-gold bg-charcoal/80'
                    : 'border-steel/20 bg-charcoal/40 hover:bg-charcoal/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6" style={{ color }} />
                  <span className="text-pure-white font-bold">{label}</span>
                  {selectedCategories.includes(id) && (
                    <div className="ml-auto h-5 w-5 rounded-full bg-royal-gold flex items-center justify-center">
                      <span className="text-obsidian text-xs">✓</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-royal-gold" />
            How often should we remind you?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'daily', label: 'Daily' },
              { id: '3_per_week', label: '3× per week' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'random', label: 'Random (1-4/week)' },
              { id: 'event_based', label: 'Only when I need it' },
            ].map(({ id, label }) => (
              <Button
                key={id}
                variant={frequency === id ? "default" : "outline"}
                onClick={() => setFrequency(id as Frequency)}
                className="h-auto py-3"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Time Window */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-royal-gold" />
            What's the best time window?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'morning', label: 'Morning (6-9am)' },
              { id: 'midday', label: 'Midday (12-3pm)' },
              { id: 'evening', label: 'Evening (6-9pm)' },
              { id: 'night', label: 'Night (9-11pm)' },
              { id: 'any', label: 'Any time' },
            ].map(({ id, label }) => (
              <Button
                key={id}
                variant={timeWindow === id ? "default" : "outline"}
                onClick={() => setTimeWindow(id as TimeWindow)}
                className="h-auto py-3"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Intensity */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-pure-white">
            How do you like to be guided?
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'soft', label: 'Soft' },
              { id: 'balanced', label: 'Balanced' },
              { id: 'strong', label: 'Strong' },
            ].map(({ id, label }) => (
              <Button
                key={id}
                variant={intensity === id ? "default" : "outline"}
                onClick={() => setIntensity(id as Intensity)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Emotional Triggers */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-pure-white">
            Push me when I feel… <span className="text-steel text-sm">(optional)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {emotionalTriggers.map(trigger => (
              <Button
                key={trigger}
                variant={selectedTriggers.includes(trigger) ? "default" : "outline"}
                onClick={() => toggleTrigger(trigger)}
                className="h-auto py-3"
              >
                {trigger}
              </Button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={selectedCategories.length === 0 || isLoading}
          className="w-full h-14 text-lg font-black bg-royal-gold hover:bg-royal-gold/90 text-obsidian"
        >
          {isLoading ? 'Activating...' : 'Activate Adaptive Pushes'}
        </Button>
      </div>
    </div>
  );
}