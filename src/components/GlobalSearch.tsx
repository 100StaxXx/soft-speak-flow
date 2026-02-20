import { useState, useEffect } from "react";
import { parseISO, format, isValid } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { formatDisplayLabel } from "@/lib/utils";

interface GlobalSearchProps {
  initialQuery?: string;
  searchQuery?: string;
  hideSearchBar?: boolean;
  onSearchChange?: (query: string) => void;
}

const formatTaskDateLabel = (taskDate: string | null): string => {
  if (!taskDate) return "Inbox";
  try {
    const parsed = parseISO(taskDate);
    if (!isValid(parsed)) return "Date unavailable";
    return format(parsed, "MMM d, yyyy");
  } catch {
    return "Date unavailable";
  }
};

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

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["search-quotes", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .or(`text.ilike.%${currentQuery}%,author.ilike.%${currentQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: pepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["search-pep-talks", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .or(`title.ilike.%${currentQuery}%,description.ilike.%${currentQuery}%,quote.ilike.%${currentQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["search-challenges", currentQuery],
    enabled: currentQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .or(`title.ilike.%${currentQuery}%,description.ilike.%${currentQuery}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['search-tasks', currentQuery, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .or(`task_text.ilike.%${currentQuery}%,notes.ilike.%${currentQuery}%,category.ilike.%${currentQuery}%`)
        .order('task_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: currentQuery.length >= 2 && !!user,
  });

  const { data: epics, isLoading: epicsLoading } = useQuery({
    queryKey: ['search-epics', currentQuery, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('epics')
        .select('id, title, description, target_days, status, epic_members(user_id)')
        .or(`user_id.eq.${user.id},epic_members.user_id.eq.${user.id}`)
        .or(`title.ilike.%${currentQuery}%,description.ilike.%${currentQuery}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
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
                          className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                          onClick={() => navigate("/challenges")}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            navigate("/challenges");
                          }}
                          role="button"
                          tabIndex={0}
                          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
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
                          className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                          onClick={() => navigate("/epics")}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            navigate("/epics");
                          }}
                          role="button"
                          tabIndex={0}
                          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        >
                          <h4 className="font-semibold mb-1">{epic.title}</h4>
                          {epic.description && (
                            <p className="text-sm text-muted-foreground">{epic.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{epic.target_days} days</Badge>
                            {epic.status && (
                              <Badge variant="secondary" className="text-xs">{formatDisplayLabel(epic.status)}</Badge>
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
                          className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                          onClick={() => navigate("/journeys")}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            navigate("/journeys");
                          }}
                          role="button"
                          tabIndex={0}
                          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{task.task_text}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatTaskDateLabel(task.task_date)}</span>
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
                  className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                  onClick={() => navigate("/challenges")}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    navigate("/challenges");
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
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
                  className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                  onClick={() => navigate("/epics")}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    navigate("/epics");
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  <h4 className="font-semibold mb-1">{epic.title}</h4>
                  {epic.description && (
                    <p className="text-sm text-muted-foreground">{epic.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{epic.target_days} days</Badge>
                    {epic.status && (
                      <Badge variant="secondary" className="text-xs">{formatDisplayLabel(epic.status)}</Badge>
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
                  className="p-4 cursor-pointer sm:hover:border-primary/50 transition-colors select-none active:scale-[0.98]"
                  onClick={() => navigate("/journeys")}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    navigate("/journeys");
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{task.task_text}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatTaskDateLabel(task.task_date)}</span>
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
