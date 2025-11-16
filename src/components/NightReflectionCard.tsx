import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function NightReflectionCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: todayReflection } = useQuery({
    queryKey: ['todayReflection', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user!.id)
        .eq('reflection_date', today)
        .maybeSingle();
      
      return data;
    },
    enabled: !!user,
  });

  const moodEmojis = {
    good: '😊',
    neutral: '😐',
    tough: '😔'
  };

  return (
    <Card className="p-4 hover:border-primary/40 transition-all cursor-pointer" onClick={() => navigate('/night-reflection')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Moon className="w-5 h-5 text-primary" />
          <div>
            {todayReflection ? (
              <>
                <div className="text-sm font-medium text-foreground">
                  {moodEmojis[todayReflection.mood as keyof typeof moodEmojis]} You checked in today
                </div>
                <div className="text-xs text-muted-foreground">Tap to view</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-foreground">Tonight: reflect on your day</div>
                <div className="text-xs text-muted-foreground">Quick check-in</div>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </Card>
  );
}