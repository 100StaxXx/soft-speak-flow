import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, CheckCircle2, Circle, Trophy, Sparkles, Plus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [customChallenge, setCustomChallenge] = useState({
    title: '',
    description: '',
    duration_days: 7,
    category: 'discipline'
  });

  const { data: activeChallenge } = useQuery({
    queryKey: ['activeChallenge', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenge:challenges(*)
        `)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: currentTask } = useQuery({
    queryKey: ['currentTask', activeChallenge?.challenge_id, activeChallenge?.current_day],
    queryFn: async () => {
      if (!activeChallenge) return null;
      
      const { data, error } = await supabase
        .from('challenge_tasks')
        .select('*')
        .eq('challenge_id', activeChallenge.challenge_id)
        .eq('day_number', activeChallenge.current_day)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeChallenge,
  });

  const { data: featuredChallenges = [] } = useQuery({
    queryKey: ['featuredChallenges', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }
      
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async () => {
      if (!activeChallenge) return;
      
      const totalDays = (activeChallenge.challenge as any).total_days;
      const nextDay = activeChallenge.current_day + 1;
      
      const updateData = nextDay > totalDays
        ? { status: 'completed' }
        : { current_day: nextDay };
      
      const { error } = await supabase
        .from('user_challenges')
        .update(updateData)
        .eq('id', activeChallenge.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeChallenge'] });
      
      if (activeChallenge && activeChallenge.current_day >= (activeChallenge.challenge as any).total_days) {
        toast({
          title: "🎉 Challenge Complete!",
          description: "Amazing work completing this challenge!",
        });
      } else {
        toast({
          title: "Day complete!",
          description: "Ready for the next one?",
        });
      }
    },
  });

  const createCustomChallengeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('challenges')
        .insert({
          title: customChallenge.title,
          description: customChallenge.description,
          duration_days: customChallenge.duration_days,
          total_days: customChallenge.duration_days,
          category: customChallenge.category,
          source: 'custom'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featuredChallenges'] });
      setIsCreateDialogOpen(false);
      setCustomChallenge({
        title: '',
        description: '',
        duration_days: 7,
        category: 'discipline'
      });
      toast({
        title: "Challenge created!",
        description: "Your custom challenge is ready to start.",
      });
    },
  });

  const categories = ['discipline', 'confidence', 'focus', 'mindset', 'self-care', 'physique', 'productivity'];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Challenges</h1>
        </div>

        {/* Current Challenge Section */}
        {activeChallenge && activeChallenge.status === 'active' ? (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/20 border-primary/20">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Your Current Challenge</div>
                  <h2 className="text-2xl font-heading text-foreground">
                    {(activeChallenge.challenge as any).title}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Day {activeChallenge.current_day} of {(activeChallenge.challenge as any).total_days}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(activeChallenge.current_day / (activeChallenge.challenge as any).total_days) * 100}%` }}
                  />
                </div>
              </div>

              {currentTask && (
                <div className="bg-card p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Today's Task</div>
                  <h3 className="font-heading text-lg text-foreground mb-2">{currentTask.task_title}</h3>
                  <p className="text-foreground/80 mb-4">{currentTask.task_description}</p>
                  
                  <Button 
                    onClick={() => completeTaskMutation.mutate()}
                    disabled={completeTaskMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    {completeTaskMutation.isPending ? 'Completing...' : 'Complete Today'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : activeChallenge && activeChallenge.status === 'completed' ? (
          <Card className="p-8 text-center bg-gradient-to-br from-green-500/10 to-accent/20 border-green-500/20">
            <Trophy className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-heading text-foreground mb-2">Challenge Complete!</h2>
            <p className="text-muted-foreground mb-4">
              You finished: {(activeChallenge.challenge as any).title}
            </p>
            <Button onClick={() => navigate('/challenges')}>
              Start Another Challenge
            </Button>
          </Card>
        ) : null}

        {/* Featured Challenges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-heading text-foreground">
              <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
              {activeChallenge?.status === 'active' ? 'More Challenges' : 'Featured Challenges'}
            </h2>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Custom
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Custom Challenge</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Challenge Title</Label>
                    <Input
                      id="title"
                      placeholder="30-Day Reading Challenge"
                      value={customChallenge.title}
                      onChange={(e) => setCustomChallenge({ ...customChallenge, title: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Read for 30 minutes every day to build a consistent reading habit..."
                      value={customChallenge.description}
                      onChange={(e) => setCustomChallenge({ ...customChallenge, description: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Select 
                        value={customChallenge.duration_days.toString()}
                        onValueChange={(value) => setCustomChallenge({ ...customChallenge, duration_days: parseInt(value) })}
                      >
                        <SelectTrigger id="duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 Days</SelectItem>
                          <SelectItem value="14">14 Days</SelectItem>
                          <SelectItem value="30">30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        value={customChallenge.category}
                        onValueChange={(value) => setCustomChallenge({ ...customChallenge, category: value })}
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="capitalize">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={() => createCustomChallengeMutation.mutate()}
                    disabled={!customChallenge.title || !customChallenge.description || createCustomChallengeMutation.isPending}
                    className="w-full"
                  >
                    {createCustomChallengeMutation.isPending ? 'Creating...' : 'Create Challenge'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid gap-4">
            {featuredChallenges.length === 0 ? (
              <Card className="p-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No challenges available yet.</p>
                <p className="text-sm text-muted-foreground mt-2">New challenges are added weekly.</p>
              </Card>
            ) : (
              featuredChallenges.map((challenge) => (
                <Card 
                  key={challenge.id} 
                  className="p-6 hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/challenge/${challenge.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-heading text-foreground">{challenge.title}</h3>
                        <Badge variant="secondary" className="capitalize">{challenge.category}</Badge>
                      </div>
                      <p className="text-muted-foreground mb-3">{challenge.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{challenge.total_days} days</span>
                        {challenge.source === 'ai' && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            AI-generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}