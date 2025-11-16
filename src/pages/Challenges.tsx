import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, CheckCircle2, Circle, Trophy, Sparkles, Plus } from "lucide-react";
import { ChallengeProgress } from "@/components/ChallengeProgress";
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
    category: 'discipline',
    tasks: [] as { day: number; title: string; description: string }[]
  });

  // Fetch active (ongoing) challenges
  const { data: activeChallenges = [] } = useQuery({
    queryKey: ['activeChallenges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenge:challenges(*)
        `)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch available challenges (all challenges not yet started or completed by user)
  const { data: availableChallenges = [] } = useQuery({
    queryKey: ['availableChallenges', selectedCategory, user?.id],
    queryFn: async () => {
      // First get all user's challenge IDs
      const { data: userChallenges } = await supabase
        .from('user_challenges')
        .select('challenge_id')
        .eq('user_id', user!.id);

      const userChallengeIds = userChallenges?.map(uc => uc.challenge_id) || [];

      // Get challenges not in user's challenges
      let query = supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }
      
      if (userChallengeIds.length > 0) {
        query = query.not('id', 'in', `(${userChallengeIds.join(',')})`);
      }
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const startChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const challenge = availableChallenges.find((c: any) => c.id === challengeId);
      if (!challenge) return;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + challenge.duration_days);

      const { error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: user!.id,
          challenge_id: challengeId,
          start_date: new Date().toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeChallenges'] });
      queryClient.invalidateQueries({ queryKey: ['availableChallenges'] });
      toast({
        title: "Challenge started!",
        description: "Let's do this!",
      });
    },
  });

  const createCustomChallengeMutation = useMutation({
    mutationFn: async () => {
      // First create the challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert({
          title: customChallenge.title,
          description: customChallenge.description,
          duration_days: customChallenge.duration_days,
          total_days: customChallenge.duration_days,
          category: customChallenge.category,
          source: 'custom'
        })
        .select()
        .single();
      
      if (challengeError) throw challengeError;

      // Then create the daily tasks if any
      if (customChallenge.tasks.length > 0) {
        const tasksToInsert = customChallenge.tasks.map(task => ({
          challenge_id: challenge.id,
          day_number: task.day,
          task_title: task.title,
          task_description: task.description
        }));

        const { error: tasksError } = await supabase
          .from('challenge_tasks')
          .insert(tasksToInsert);
        
        if (tasksError) throw tasksError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableChallenges'] });
      setIsCreateDialogOpen(false);
      setCustomChallenge({
        title: '',
        description: '',
        duration_days: 7,
        category: 'discipline',
        tasks: []
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

        {/* Ongoing Challenges Section */}
        {activeChallenges.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-heading text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Ongoing Challenges
            </h2>
            
            {activeChallenges.map((activeChallenge: any) => (
              <Card 
                key={activeChallenge.id}
                className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 cursor-pointer hover:shadow-elegant transition-all"
                onClick={() => navigate(`/challenge/${activeChallenge.challenge_id}`)}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-heading text-foreground mb-1">
                        {activeChallenge.challenge.title}
                      </h3>
                      <Badge variant="secondary" className="capitalize">
                        {activeChallenge.challenge.category}
                      </Badge>
                    </div>
                    <Circle className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Day {activeChallenge.current_day} of {activeChallenge.challenge.total_days}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(activeChallenge.current_day / activeChallenge.challenge.total_days) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Available Challenges Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-heading text-foreground">
              <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
              {activeChallenges.length > 0 ? 'Available Challenges' : 'Start a Challenge'}
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

                  <div className="space-y-2">
                    <Label>Daily Tasks (Optional)</Label>
                    <p className="text-xs text-muted-foreground">Add specific tasks for each day</p>
                    {customChallenge.tasks.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {customChallenge.tasks.map((task, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                            <span className="font-medium">Day {task.day}:</span>
                            <span className="flex-1 truncate">{task.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCustomChallenge({
                                  ...customChallenge,
                                  tasks: customChallenge.tasks.filter((_, i) => i !== index)
                                });
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const nextDay = customChallenge.tasks.length + 1;
                        if (nextDay <= customChallenge.duration_days) {
                          const title = prompt(`Task title for Day ${nextDay}:`);
                          const description = prompt(`Task description for Day ${nextDay}:`);
                          if (title && description) {
                            setCustomChallenge({
                              ...customChallenge,
                              tasks: [...customChallenge.tasks, { day: nextDay, title, description }]
                            });
                          }
                        } else {
                          toast({
                            title: "All days have tasks",
                            description: "You've added tasks for all days.",
                          });
                        }
                      }}
                      disabled={customChallenge.tasks.length >= customChallenge.duration_days}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Day {customChallenge.tasks.length + 1} Task
                    </Button>
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
            {availableChallenges.length === 0 ? (
              <Card className="p-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {selectedCategory 
                    ? 'No challenges available in this category.' 
                    : 'All challenges have been started! Check back later for new challenges.'}
                </p>
              </Card>
            ) : (
              availableChallenges.map((challenge: any) => (
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