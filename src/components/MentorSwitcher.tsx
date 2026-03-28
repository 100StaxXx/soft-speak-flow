import { forwardRef, useCallback, useMemo, useState, type ButtonHTMLAttributes } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Repeat2, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { MentorAvatar } from "@/components/MentorAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePendingMentorMood } from "@/hooks/usePendingMentorMood";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { applyMentorChange } from "@/pages/profileMentorChange";
import {
  getMentorRecommendations,
  getMoodLabel,
  type MentorRecommendation,
  type MentorRecommendationCandidate,
} from "@/utils/mentorRecommendations";
import {
  getConsultMentorIdFromState,
  withConsultMentorState,
} from "@/utils/mentorChatLocationState";

type MentorSwitcherProps = {
  variant?: "card" | "button" | "none";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ActiveMentorRecord = MentorRecommendationCandidate & {
  avatar_url?: string | null;
  primary_color?: string | null;
  tone_description: string;
};

const formatDateInTimezone = (date: Date, timezone: string): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleDateString("en-CA");
  }
};

const formatMoodLabel = (mood?: string | null): string | null => {
  const label = getMoodLabel(mood);
  if (!label) return null;
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
};

const getMentorDetail = (mentor: ActiveMentorRecord): string => {
  if (mentor.short_title?.trim()) return mentor.short_title.trim();
  return mentor.tone_description?.trim() || "Ready when you need a different voice.";
};

const getMoodSummary = ({
  pendingMood,
  todayMood,
  latestMood,
}: {
  pendingMood: string | null;
  todayMood: string | null;
  latestMood: string | null;
}): string => {
  if (pendingMood) {
    return `Recommendations are based on how you're feeling right now: ${formatMoodLabel(pendingMood)}.`;
  }

  if (todayMood) {
    return `Recommendations are based on today's check-in mood: ${formatMoodLabel(todayMood)}.`;
  }

  if (latestMood) {
    return `Recommendations are based on your most recent check-in mood: ${formatMoodLabel(latestMood)}.`;
  }

  return "Browse the full guide lineup and consult the voice you need right now.";
};

const TriggerCard = forwardRef<
  HTMLButtonElement,
  {
    activeMentor: ActiveMentorRecord | null;
    consultMentor: ActiveMentorRecord | null;
    currentMood: string | null;
    recommendations: MentorRecommendation<ActiveMentorRecord>[];
    className?: string;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ activeMentor, consultMentor, currentMood, recommendations, className, ...props }, ref) => {
  const leadingRecommendation = recommendations[0];

  return (
    <button
      ref={ref}
      type="button"
      data-testid="mentor-switcher-trigger"
      className={cn(
        "w-full rounded-3xl border border-primary/25 bg-card/55 p-5 text-left shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-colors hover:border-primary/40 hover:bg-card/70",
        className,
      )}
      aria-label={
        activeMentor
          ? `Open guide council. Primary guide ${activeMentor.name}.`
          : "Open guide council"
      }
      {...props}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Repeat2 className="h-3.5 w-3.5" />
            Guide council
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              {activeMentor ? `${activeMentor.name} stays your primary guide` : "Choose your primary guide"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Consult another guide for this moment, or make a change when you want a new primary guide.
            </p>
          </div>
        </div>

        {activeMentor && (
          <div className="inline-flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
            <MentorAvatar
              mentorSlug={activeMentor.slug || activeMentor.name}
              mentorName={activeMentor.name}
              primaryColor={activeMentor.primary_color || "#7c3aed"}
              avatarUrl={activeMentor.avatar_url || undefined}
              size="sm"
              showBorder={false}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Primary guide
              </p>
              <p className="truncate text-sm font-semibold">{activeMentor.name}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {currentMood ? (
          <Badge variant="info">Mood: {formatMoodLabel(currentMood)}</Badge>
        ) : (
          <Badge variant="outline">Full guide lineup</Badge>
        )}
        {consultMentor && activeMentor?.id !== consultMentor.id && (
          <Badge variant="reward">Consulting: {consultMentor.name}</Badge>
        )}
        {leadingRecommendation && (
          <Badge variant="reward">
            Suggested consult: {leadingRecommendation.mentor.name}
          </Badge>
        )}
      </div>

      {leadingRecommendation && (
        <p className="mt-3 text-sm text-muted-foreground">
          {leadingRecommendation.reasonLabel}
          {activeMentor?.id !== leadingRecommendation.mentor.id
            ? `, with ${leadingRecommendation.mentor.name} ready to consult.`
            : `, and ${leadingRecommendation.mentor.name} is already active.`}
        </p>
      )}
    </button>
  );
});
TriggerCard.displayName = "TriggerCard";

export const MentorSwitcher = ({
  variant = "card",
  className,
  open: controlledOpen,
  onOpenChange,
}: MentorSwitcherProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { mentorId: activeMentorId } = useMentorConnection();
  const pendingMood = usePendingMentorMood();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [switchingMentorId, setSwitchingMentorId] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  const timezone =
    profile?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  const today = useMemo(() => formatDateInTimezone(new Date(), timezone), [timezone]);

  const { data: mentors = [], isLoading: mentorsLoading } = useQuery({
    queryKey: ["mentors", "active"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ActiveMentorRecord[]> => {
      const { data, error } = await supabase
        .from("mentors")
        .select(
          "id, name, slug, avatar_url, primary_color, short_title, tone_description, tags, themes, style_description, target_user, intensity_level",
        )
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: todayCheckIn } = useQuery({
    queryKey: ["morning-check-in", today, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("check_in_type", "morning")
        .eq("check_in_date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: latestCheckIn } = useQuery({
    queryKey: ["morning-check-in-latest", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("check_in_type", "morning")
        .order("check_in_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const currentMood = pendingMood || todayCheckIn?.mood || latestCheckIn?.mood || null;
  const recommendations = useMemo(
    () => getMentorRecommendations(mentors, currentMood, 2),
    [currentMood, mentors],
  );
  const recommendationByMentorId = useMemo(
    () => new Map(recommendations.map((entry) => [entry.mentor.id, entry])),
    [recommendations],
  );
  const consultMentorId = getConsultMentorIdFromState(location.state);
  const activeMentor = useMemo(
    () => mentors.find((mentor) => mentor.id === activeMentorId) ?? null,
    [activeMentorId, mentors],
  );
  const consultMentor = useMemo(
    () => mentors.find((mentor) => mentor.id === consultMentorId) ?? null,
    [consultMentorId, mentors],
  );
  const isConsultingAlternateMentor = Boolean(
    consultMentor && activeMentor && consultMentor.id !== activeMentor.id,
  );
  const shouldReplaceMentorChatEntry = location.pathname === "/mentor-chat";

  const onboardingData =
    profile?.onboarding_data &&
    typeof profile.onboarding_data === "object" &&
    !Array.isArray(profile.onboarding_data)
      ? (profile.onboarding_data as Record<string, unknown>)
      : {};

  const openMentorChat = (consultedMentorId: string | null) => {
    navigate("/mentor-chat", {
      replace: shouldReplaceMentorChatEntry,
      state: withConsultMentorState(location.state, consultedMentorId, location.pathname),
    });
    handleOpenChange(false);
  };

  const handleConsultMentor = (mentor: ActiveMentorRecord) => {
    if (!activeMentorId || mentor.id === activeMentorId) {
      openMentorChat(null);
      return;
    }

    openMentorChat(mentor.id);
  };

  const handleMakePrimary = async (mentor: ActiveMentorRecord) => {
    if (!user?.id || switchingMentorId || mentor.id === activeMentorId) {
      return;
    }

    setSwitchingMentorId(mentor.id);
    try {
      await applyMentorChange({
        mentorId: mentor.id,
        onboardingData,
        queryClient,
        supabaseClient: supabase,
        timezone,
        userId: user.id,
      });

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["mentor-page-data"] }),
        queryClient.refetchQueries({ queryKey: ["mentor-personality"] }),
        queryClient.refetchQueries({ queryKey: ["mentor"] }),
        queryClient.refetchQueries({ queryKey: ["selected-mentor"] }),
        queryClient.refetchQueries({ queryKey: ["morning-check-in"] }),
      ]);

      if (consultMentorId === mentor.id) {
        navigate("/mentor-chat", {
          replace: true,
          state: withConsultMentorState(location.state, null, location.pathname),
        });
      }

      toast({
        title: "Primary guide updated",
        description: `${mentor.name} is now your primary guide. You can still consult other guides anytime.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't update primary guide",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSwitchingMentorId(null);
    }
  };

  const trigger = variant === "none"
    ? null
    : variant === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("rounded-full border-border/70 bg-background/75 backdrop-blur-sm", className)}
          data-testid="mentor-switcher-trigger"
        >
          <Repeat2 className="h-4 w-4" />
          {isConsultingAlternateMentor ? "Change consult" : "Consult guides"}
        </Button>
      ) : (
        <TriggerCard
          activeMentor={activeMentor}
          consultMentor={consultMentor}
          currentMood={currentMood}
          recommendations={recommendations}
          className={className}
        />
      );

  const moodSummary = getMoodSummary({
    pendingMood,
    todayMood: todayCheckIn?.mood ?? null,
    latestMood: latestCheckIn?.mood ?? null,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent data-testid="mentor-switcher-dialog" className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Consult another guide</DialogTitle>
          <DialogDescription>
            Your primary guide stays anchored. Consult another voice for chat, or promote someone new when you want a different primary guide.
          </DialogDescription>

          <div className="mt-3 flex flex-wrap gap-2">
            {activeMentor ? (
              <Badge variant="gold">Primary: {activeMentor.name}</Badge>
            ) : (
              <Badge variant="outline">No primary guide</Badge>
            )}
            {consultMentor && activeMentor?.id !== consultMentor.id && (
              <Badge variant="info">Consulting: {consultMentor.name}</Badge>
            )}
            {currentMood ? (
              <Badge variant="info">Mood signal: {formatMoodLabel(currentMood)}</Badge>
            ) : (
              <Badge variant="outline">No current mood signal</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/12 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Primary guide + fast consults</p>
                  <p className="text-sm text-muted-foreground">
                    {moodSummary} Your primary guide still powers check-ins, briefings, and daily pep talks until you explicitly change them.
                  </p>
                </div>
              </div>
            </div>

            {recommendations.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Recommended to consult now
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Suggestions based on your current or most recent mood.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {recommendations.map((entry) => {
                    const mentor = entry.mentor;
                    const isPrimary = mentor.id === activeMentorId;
                    const isConsulting = mentor.id === consultMentorId && mentor.id !== activeMentorId;
                    const isSwitching = switchingMentorId === mentor.id;

                    return (
                      <div
                        key={mentor.id}
                        className={cn(
                          "rounded-2xl border p-4 transition-colors",
                          isPrimary
                            ? "border-stardust-gold/35 bg-stardust-gold/10"
                            : "border-primary/20 bg-card/55 hover:border-primary/40 hover:bg-card/70",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <MentorAvatar
                            mentorSlug={mentor.slug || mentor.name}
                            mentorName={mentor.name}
                            primaryColor={mentor.primary_color || "#7c3aed"}
                            avatarUrl={mentor.avatar_url || undefined}
                            size="sm"
                            showBorder={false}
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">{mentor.name}</p>
                              {isPrimary ? (
                                <Badge variant="gold">Primary</Badge>
                              ) : isConsulting ? (
                                <Badge variant="info">Consulting now</Badge>
                              ) : (
                                <Badge variant="reward">{entry.reasonLabel}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{getMentorDetail(mentor)}</p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {isPrimary ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openMentorChat(null)}
                                >
                                  {isConsultingAlternateMentor ? "Return to primary chat" : "Ask primary guide"}
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleConsultMentor(mentor)}
                                  >
                                    {isConsulting ? "Continue consult" : "Consult"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleMakePrimary(mentor)}
                                    disabled={Boolean(switchingMentorId)}
                                  >
                                    {isSwitching ? "Saving..." : "Make primary"}
                                  </Button>
                                </>
                              )}
                            </div>
                            {isSwitching && (
                              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating primary guide...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Full guide lineup
                </h3>
                <p className="text-sm text-muted-foreground">
                  Keep one primary guide, then consult anyone here whenever you want another perspective.
                </p>
              </div>

              {mentorsLoading ? (
                <div className="rounded-2xl border border-border/60 bg-card/45 p-4 text-sm text-muted-foreground">
                  Loading guides...
                </div>
              ) : (
                <div className="space-y-3">
                  {mentors.map((mentor) => {
                    const isPrimary = mentor.id === activeMentorId;
                    const isConsulting = mentor.id === consultMentorId && mentor.id !== activeMentorId;
                    const isSwitching = switchingMentorId === mentor.id;
                    const recommendation = recommendationByMentorId.get(mentor.id);

                    return (
                      <div
                        key={mentor.id}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                          isPrimary
                            ? "border-stardust-gold/35 bg-stardust-gold/10"
                            : "border-border/60 bg-card/45 hover:border-primary/35 hover:bg-card/70",
                        )}
                      >
                        <MentorAvatar
                          mentorSlug={mentor.slug || mentor.name}
                          mentorName={mentor.name}
                          primaryColor={mentor.primary_color || "#7c3aed"}
                          avatarUrl={mentor.avatar_url || undefined}
                          size="sm"
                          showBorder={false}
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{mentor.name}</p>
                            {isPrimary && <Badge variant="gold">Primary</Badge>}
                            {isConsulting && <Badge variant="info">Consulting now</Badge>}
                            {!isPrimary && !isConsulting && recommendation && (
                              <Badge variant="info">{recommendation.reasonLabel}</Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground">{getMentorDetail(mentor)}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {isPrimary ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openMentorChat(null)}
                              >
                                {isConsultingAlternateMentor ? "Return to primary chat" : "Ask primary guide"}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleConsultMentor(mentor)}
                                >
                                  {isConsulting ? "Continue consult" : "Consult"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleMakePrimary(mentor)}
                                  disabled={Boolean(switchingMentorId)}
                                >
                                  {isSwitching ? "Saving..." : "Make primary"}
                                </Button>
                              </>
                            )}
                          </div>

                          {isSwitching ? (
                            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Updating primary guide...
                            </div>
                          ) : isPrimary ? (
                            <div className="inline-flex items-center gap-2 text-xs text-stardust-gold">
                              <Check className="h-3.5 w-3.5" />
                              Primary guide stays here
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
