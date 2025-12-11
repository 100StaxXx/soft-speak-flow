import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { SearchBar } from "./SearchBar";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { QuoteCard } from "./QuoteCard";
import { PepTalkCard } from "./PepTalkCard";
import { Badge } from "./ui/badge";
import { BookOpen, MessageSquare, Sparkles, Trophy, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";

interface GlobalSearchProps {
  initialQuery?: string;
  searchQuery?: string;
  hideSearchBar?: boolean;
  onSearchChange?: (query: string) => void;
}

export const GlobalSearch = ({
  initialQuery = "",
  searchQuery,
  hideSearchBar = false,
  onSearchChange,
}: GlobalSearchProps) => {
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const isControlled = typeof searchQuery === "string";
  const currentQuery = isControlled ? searchQuery : internalQuery;
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!isControlled) {
      setInternalQuery(initialQuery);
    }
  }, [initialQuery, isControlled]);

  const handleQueryChange = (value: string) => {
    if (!isControlled) {
      setInternalQuery(value);
    }
    onSearchChange?.(value);
  };

  // Firestore doesn't have native text search, so we fetch and filter client-side
  // TODO: Consider implementing Algolia or similar for better search performance
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["search-quotes", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const allQuotes = await getDocuments("quotes", undefined, undefined, undefined, 100);
      const queryLower = currentQuery.toLowerCase();
      return allQuotes
        .filter(q => 
          (q.text?.toLowerCase().includes(queryLower)) ||
          (q.author?.toLowerCase().includes(queryLower))
        )
        .slice(0, 10);
    },
  });

  const { data: pepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["search-pep-talks", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const allPepTalks = await getDocuments("pep_talks", undefined, undefined, undefined, 100);
      const queryLower = currentQuery.toLowerCase();
      return allPepTalks
        .filter(p => 
          (p.title?.toLowerCase().includes(queryLower)) ||
          (p.description?.toLowerCase().includes(queryLower)) ||
          (p.quote?.toLowerCase().includes(queryLower))
        )
        .slice(0, 10);
    },
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["search-challenges", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const allChallenges = await getDocuments("challenges", undefined, undefined, undefined, 100);
      const queryLower = currentQuery.toLowerCase();
      return allChallenges
        .filter(c => 
          (c.title?.toLowerCase().includes(queryLower)) ||
          (c.description?.toLowerCase().includes(queryLower))
        )
        .slice(0, 10);
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['search-tasks', currentQuery, user?.uid],
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const userTasks = await getDocuments(
        'daily_tasks',
        [['user_id', '==', user.uid]],
        'task_date',
        'desc',
        100
      );
      const queryLower = currentQuery.toLowerCase();
      return userTasks
        .filter(t => t.task_text?.toLowerCase().includes(queryLower))
        .slice(0, 10);
    },
    enabled: currentQuery.length >= 2 && !!user,
  });

  const { data: epics, isLoading: epicsLoading } = useQuery({
    queryKey: ['search-epics', currentQuery, user?.uid],
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Fetch user's epics (owned and joined)
      const ownedEpics = await getDocuments('epics', [['user_id', '==', user.uid]], 'created_at', 'desc', 50);
      const memberships = await getDocuments('epic_members', [['user_id', '==', user.uid]]);
      const joinedEpicIds = memberships.map(m => m.epic_id);
      const joinedEpics = joinedEpicIds.length > 0 
        ? await Promise.all(joinedEpicIds.map(id => getDocuments('epics', [['id', '==', id]])))
        : [];
      const allUserEpics = [...ownedEpics, ...joinedEpics.flat()];
      
      const queryLower = currentQuery.toLowerCase();
      return allUserEpics
        .filter(e => 
          (e.title?.toLowerCase().includes(queryLower)) ||
          (e.description?.toLowerCase().includes(queryLower))
        )
        .slice(0, 10);
    },
    enabled: currentQuery.length >= 2 && !!user,
  });

  const isLoading = quotesLoading || pepTalksLoading || challengesLoading || tasksLoading || epicsLoading;
  const hasResults =
    (quotes && quotes.length > 0) ||
    (pepTalks && pepTalks.length > 0) ||
    (challenges && challenges.length > 0) ||
    (tasks && tasks.length > 0) ||
    (epics && epics.length > 0);

  return (
    <div className="space-y-4">
      {!hideSearchBar && (
        <SearchBar
          onSearch={handleQueryChange}
          placeholder="Search quotes, pep talks, challenges, quests, and epics..."
          value={currentQuery}
        />
      )}

      {currentQuery.length >= 2 && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="pep-talks">Pep Talks</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="quests">Quests</TabsTrigger>
            <TabsTrigger value="epics">Epics</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !hasResults ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No results found for "{currentQuery}"</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {pepTalks && pepTalks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Pep Talks</h3>
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

                {epics && epics.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Epics</h3>
                    </div>
                    <div className="space-y-3">
                      {epics.map((epic) => (
                        <Card
                          key={epic.id}
                          className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate("/epics")}
                        >
                          <h4 className="font-semibold mb-1">{epic.title}</h4>
                          {epic.description && (
                            <p className="text-sm text-muted-foreground">{epic.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{epic.target_days} days</Badge>
                            {epic.status && (
                              <Badge variant="secondary" className="text-xs capitalize">{epic.status}</Badge>
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

          <TabsContent value="epics" className="space-y-3 mt-4">
            {epicsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : epics && epics.length > 0 ? (
              epics.map((epic) => (
                <Card
                  key={epic.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate("/epics")}
                >
                  <h4 className="font-semibold mb-1">{epic.title}</h4>
                  {epic.description && (
                    <p className="text-sm text-muted-foreground">{epic.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{epic.target_days} days</Badge>
                    {epic.status && (
                      <Badge variant="secondary" className="text-xs capitalize">{epic.status}</Badge>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No epics found</p>
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

      {currentQuery.length > 0 && currentQuery.length < 2 && (
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
        </Card>
      )}
    </div>
  );
};
