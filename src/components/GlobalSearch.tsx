import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SearchBar } from "./SearchBar";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { QuoteCard } from "./QuoteCard";
import { PepTalkCard } from "./PepTalkCard";
import { BookOpen, MessageSquare, Trophy, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";

export const GlobalSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["search-quotes", searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .or(`text.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: pepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["search-pep-talks", searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,quote.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["search-challenges", searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['search-tasks', searchQuery, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .ilike('task_text', `%${searchQuery}%`)
        .order('task_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2 && !!user,
  });

  const isLoading = quotesLoading || pepTalksLoading || challengesLoading || tasksLoading;
  const hasResults = (quotes && quotes.length > 0) || (pepTalks && pepTalks.length > 0) || (challenges && challenges.length > 0) || (tasks && tasks.length > 0);

  return (
    <div className="space-y-4">
      <SearchBar
        onSearch={setSearchQuery}
        placeholder="Search quotes, pep talks, challenges, quests..."
      />

      {searchQuery.length >= 2 && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="pep-talks">Pep Talks</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="quests">Quests</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !hasResults ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {pepTalks && pepTalks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Pep Talks</h3>
                      <Badge variant="secondary">{pepTalks.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {pepTalks.map((talk) => (
                        <PepTalkCard key={talk.id} {...talk} />
                      ))}
                    </div>
                  </div>
                )}

                {quotes && quotes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Quotes</h3>
                      <Badge variant="secondary">{quotes.length}</Badge>
                    </div>
                    <div className="grid gap-3">
                      {quotes.map((quote) => (
                        <QuoteCard key={quote.id} quote={quote} />
                      ))}
                    </div>
                  </div>
                )}

                {challenges && challenges.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Challenges</h3>
                      <Badge variant="secondary">{challenges.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {challenges.map((challenge) => (
                        <Card
                          key={challenge.id}
                          className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate("/challenges")}
                        >
                          <h4 className="font-semibold mb-1">{challenge.title}</h4>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{challenge.duration_days} days</Badge>
                            {challenge.category && (
                              <Badge variant="secondary">{challenge.category}</Badge>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {tasks && tasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Quests</h3>
                      <Badge variant="secondary">{tasks.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <Card
                          key={task.id}
                          className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate("/tasks")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{task.task_text}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{new Date(task.task_date).toLocaleDateString()}</span>
                                {task.scheduled_time && (
                                  <>
                                    <span>•</span>
                                    <span>{task.scheduled_time}</span>
                                  </>
                                )}
                                {task.estimated_duration && (
                                  <>
                                    <span>•</span>
                                    <span>{task.estimated_duration}min</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {task.is_main_quest && (
                                <Badge variant="secondary" className="text-xs">Main Quest</Badge>
                              )}
                              {task.completed && (
                                <Badge className="text-xs bg-success/10 text-success">Completed</Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quotes" className="space-y-3 mt-4">
            {quotesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : quotes && quotes.length > 0 ? (
              quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No quotes found</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pep-talks" className="space-y-3 mt-4">
            {pepTalksLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : pepTalks && pepTalks.length > 0 ? (
              pepTalks.map((talk) => <PepTalkCard key={talk.id} {...talk} />)
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No pep talks found</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="challenges" className="space-y-3 mt-4">
            {challengesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : challenges && challenges.length > 0 ? (
              challenges.map((challenge) => (
                <Card
                  key={challenge.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate("/challenges")}
                >
                  <h4 className="font-semibold mb-1">{challenge.title}</h4>
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{challenge.duration_days} days</Badge>
                    {challenge.category && (
                      <Badge variant="secondary">{challenge.category}</Badge>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No challenges found</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quests" className="space-y-3 mt-4">
            {tasksLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : tasks && tasks.length > 0 ? (
              tasks.map((task) => (
                <Card
                  key={task.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate("/tasks")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{task.task_text}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(task.task_date).toLocaleDateString()}</span>
                        {task.scheduled_time && (
                          <>
                            <span>•</span>
                            <span>{task.scheduled_time}</span>
                          </>
                        )}
                        {task.estimated_duration && (
                          <>
                            <span>•</span>
                            <span>{task.estimated_duration}min</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {task.is_main_quest && (
                        <Badge variant="secondary" className="text-xs">Main Quest</Badge>
                      )}
                      {task.completed && (
                        <Badge className="text-xs bg-success/10 text-success">Completed</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No quests found</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {searchQuery.length > 0 && searchQuery.length < 2 && (
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
        </Card>
      )}
    </div>
  );
};
