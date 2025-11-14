import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: challenges = [] } = useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      const { data } = await supabase.from('challenges').select('*');
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Challenges</h1>
        </div>

        <div className="grid gap-4">
          {challenges.length === 0 ? (
            <Card className="p-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No challenges available yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Check back soon for new challenges.</p>
            </Card>
          ) : (
            challenges.map((challenge) => (
              <Card key={challenge.id} className="p-6 hover:border-primary/40 transition-all">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-heading text-foreground">{challenge.title}</h3>
                      <p className="text-muted-foreground mt-1">{challenge.description}</p>
                    </div>
                    <Badge variant="secondary">{challenge.duration_days} days</Badge>
                  </div>
                  <Button className="w-full">Start Challenge</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
