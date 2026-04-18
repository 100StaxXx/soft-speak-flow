import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pin, RefreshCw, Sparkles, EyeOff, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import {
  formatWallpaperVariantLabel,
  getEffectiveWallpaperDate,
  wallpaperGenerationSpecs,
  type WallpaperPageKey,
  type WallpaperPublishState,
} from "@/shared/wallpaperCatalog";

type WallpaperAssetRow = Database["public"]["Tables"]["wallpaper_assets"]["Row"];
type DailyWallpaperAssignmentInsert = Database["public"]["Tables"]["daily_wallpaper_assignments"]["Insert"];
type DailyWallpaperAssignmentRow = Database["public"]["Tables"]["daily_wallpaper_assignments"]["Row"];

const stateBadgeClasses: Record<WallpaperPublishState, string> = {
  ready: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
  validation_failed: "bg-amber-500/15 text-amber-200 border border-amber-400/20",
  suppressed: "bg-slate-500/15 text-slate-200 border border-slate-400/20",
  retired: "bg-rose-500/15 text-rose-200 border border-rose-400/20",
};

interface ValidationSnapshot {
  scenicQualityScore?: number;
  moodMatchScore?: number;
  detailScore?: number;
  contrastScore?: number;
  rejectionReasons?: string[];
  notes?: string[];
}

const asValidationSnapshot = (value: Json | null): ValidationSnapshot => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ValidationSnapshot;
};

export const AdminWallpaperCatalog = () => {
  const [assets, setAssets] = useState<WallpaperAssetRow[]>([]);
  const [liveAssignments, setLiveAssignments] = useState<Record<string, DailyWallpaperAssignmentRow>>({});
  const [loading, setLoading] = useState(true);
  const [isGeneratingBacklog, setIsGeneratingBacklog] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const todayKey = useMemo(() => getEffectiveWallpaperDate(), []);
  const latestBatchLabel = useMemo(
    () => assets.find((asset) => typeof asset.batch_label === "string" && asset.batch_label.length > 0)?.batch_label ?? null,
    [assets],
  );

  const fetchCatalog = useCallback(async () => {
    setLoading(true);

    const [assetsResult, assignmentsResult] = await Promise.all([
      supabase
        .from("wallpaper_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("daily_wallpaper_assignments")
        .select("id, page_key, for_date, wallpaper_asset_id, assignment_source, created_at, updated_at")
        .eq("for_date", todayKey),
    ]);

    if (assetsResult.error) {
      console.error("Failed to fetch wallpaper assets:", assetsResult.error);
      toast.error("Failed to load wallpaper catalog");
      setLoading(false);
      return;
    }

    if (assignmentsResult.error) {
      console.error("Failed to fetch wallpaper assignments:", assignmentsResult.error);
      toast.error("Failed to load today's wallpaper assignments");
      setLoading(false);
      return;
    }

    const nextAssignments = (assignmentsResult.data ?? []).reduce<Record<string, DailyWallpaperAssignmentRow>>((acc, row) => {
      acc[row.page_key] = row;
      return acc;
    }, {});

    setAssets(assetsResult.data ?? []);
    setLiveAssignments(nextAssignments);
    setLoading(false);
  }, [todayKey]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const regenerateDailySet = useCallback(async () => {
    setIsGeneratingBacklog(true);

    const { data, error } = await supabase.functions.invoke("rotate-daily-wallpapers", {
      body: {
        startDate: todayKey,
        daysAhead: 4,
        candidateCount: 3,
        force: true,
      },
    });

    if (error) {
      console.error("Failed to regenerate wallpaper daily set:", error);
      toast.error("Failed to regenerate the daily wallpaper set");
      setIsGeneratingBacklog(false);
      return;
    }

    const generatedCount = Array.isArray(data?.outcomes)
      ? data.outcomes.filter((outcome: { status?: string }) => outcome.status === "generated").length
      : 0;
    const carryForwardCount = Array.isArray(data?.outcomes)
      ? data.outcomes.filter((outcome: { status?: string }) => outcome.status === "carry_forward").length
      : 0;
    toast.success(`Regenerated the daily wallpaper set. ${generatedCount} pages got new art and ${carryForwardCount} pages carried forward.`);
    setIsGeneratingBacklog(false);
    await fetchCatalog();
  }, [fetchCatalog, todayKey]);

  const setAssetState = useCallback(async (asset: WallpaperAssetRow, publishState: WallpaperPublishState) => {
    setMutatingId(asset.id);

    const { error } = await supabase
      .from("wallpaper_assets")
      .update({ publish_state: publishState })
      .eq("id", asset.id);

    if (error) {
      console.error(`Failed to set wallpaper state to ${publishState}:`, error);
      toast.error(`Failed to mark wallpaper as ${publishState.replaceAll("_", " ")}`);
      setMutatingId(null);
      return;
    }

    if (liveAssignments[asset.page_key]?.wallpaper_asset_id === asset.id) {
      await supabase
        .from("daily_wallpaper_assignments")
        .delete()
        .eq("page_key", asset.page_key)
        .eq("for_date", todayKey)
        .eq("wallpaper_asset_id", asset.id);
    }

    toast.success(`Wallpaper marked as ${publishState.replaceAll("_", " ")}`);
    setMutatingId(null);
    await fetchCatalog();
  }, [fetchCatalog, liveAssignments, todayKey]);

  const featureAssetToday = useCallback(async (asset: WallpaperAssetRow) => {
    setMutatingId(asset.id);

    const payload: DailyWallpaperAssignmentInsert = {
      page_key: asset.page_key,
      for_date: todayKey,
      wallpaper_asset_id: asset.id,
      assignment_source: "admin_override",
    };

    const { error } = await supabase
      .from("daily_wallpaper_assignments")
      .upsert(payload, { onConflict: "page_key,for_date" });

    if (error) {
      console.error("Failed to feature wallpaper:", error);
      toast.error("Failed to feature wallpaper for today");
      setMutatingId(null);
      return;
    }

    toast.success(`${wallpaperGenerationSpecs[asset.page_key as WallpaperPageKey].label} wallpaper featured for today`);
    setMutatingId(null);
    await fetchCatalog();
  }, [fetchCatalog, todayKey]);

  return (
    <Card className="p-6 mb-8 rounded-3xl shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Wallpaper Catalog</h2>
          <p className="text-muted-foreground">
            Auto-live daily scenic wallpapers for Guide, Quests, Campaigns, Companion, Profile, and Pep Talk. Current wallpaper day: {todayKey}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            onClick={() => void regenerateDailySet()}
            disabled={loading || isGeneratingBacklog}
          >
            {isGeneratingBacklog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Regenerate Daily Set
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void fetchCatalog()} disabled={loading || isGeneratingBacklog}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border/50 bg-background/40 p-8 text-sm text-muted-foreground">
          Loading wallpaper catalog...
        </div>
      ) : null}

      {!loading && assets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-background/30 p-8 text-sm text-muted-foreground">
          No generated wallpapers yet. The daily scheduler will add candidates here after its first successful run.
        </div>
      ) : null}

      <div className="space-y-4">
        {assets.map((asset) => {
          const validation = asValidationSnapshot(asset.validation_result);
          const rejectionReasons = Array.isArray(validation.rejectionReasons) ? validation.rejectionReasons : [];
          const notes = Array.isArray(validation.notes) ? validation.notes : [];
          const liveAssignment = liveAssignments[asset.page_key] ?? null;
          const isLiveToday = liveAssignment?.wallpaper_asset_id === asset.id;
          const isPromotedFromLatestBatch = Boolean(
            latestBatchLabel
            && asset.batch_label
            && asset.batch_label === latestBatchLabel
            && isLiveToday,
          );
          const isBusy = mutatingId === asset.id;
          const variantLabel = formatWallpaperVariantLabel(asset.variant_key);

          return (
            <div
              key={asset.id}
              className="grid gap-4 rounded-3xl border border-border/60 bg-background/40 p-4 md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-black/30 aspect-[9/16] max-w-[180px]">
                <img
                  src={asset.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {wallpaperGenerationSpecs[asset.page_key as WallpaperPageKey].label}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${stateBadgeClasses[asset.publish_state as WallpaperPublishState]}`}>
                    {asset.publish_state.replaceAll("_", " ")}
                  </span>
                  {isLiveToday ? (
                    <span className="rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-medium border border-primary/20">
                      Live {liveAssignment?.for_date}
                    </span>
                  ) : null}
                  {isPromotedFromLatestBatch ? (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-xs font-medium border border-emerald-400/20">
                      Promoted live
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <div>Created: <span className="text-foreground">{new Date(asset.created_at).toLocaleString()}</span></div>
                  <div>Generated for: <span className="text-foreground">{asset.generation_date}</span></div>
                  <div>Prompt version: <span className="text-foreground">{asset.prompt_version}</span></div>
                  <div>Model: <span className="text-foreground">{asset.render_model}</span></div>
                  {isLiveToday ? (
                    <div>Assignment source: <span className="text-foreground">{liveAssignment?.assignment_source.replaceAll("_", " ")}</span></div>
                  ) : null}
                  {asset.batch_label ? <div>Batch: <span className="text-foreground">{asset.batch_label}</span></div> : null}
                  {variantLabel ? <div>Variant: <span className="text-foreground">{variantLabel}</span></div> : null}
                </div>

                <div className="grid gap-2 rounded-2xl bg-muted/20 p-3 text-sm md:grid-cols-2">
                  <div>Scenic quality: <span className="font-medium text-foreground">{validation.scenicQualityScore ?? "n/a"}</span></div>
                  <div>Mood match: <span className="font-medium text-foreground">{validation.moodMatchScore ?? "n/a"}</span></div>
                  <div>Detail: <span className="font-medium text-foreground">{validation.detailScore ?? "n/a"}</span></div>
                  <div>Contrast: <span className="font-medium text-foreground">{validation.contrastScore ?? "n/a"}</span></div>
                </div>

                {rejectionReasons.length > 0 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <div className="font-medium mb-1">Validation blocked auto-publish</div>
                    <div>{rejectionReasons.join(" · ")}</div>
                  </div>
                ) : null}

                {notes.length > 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {notes.join(" · ")}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => void featureAssetToday(asset)}
                    disabled={isBusy || asset.publish_state !== "ready"}
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                    Feature today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void setAssetState(asset, "suppressed")}
                    disabled={isBusy || asset.publish_state === "suppressed"}
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Suppress
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void setAssetState(asset, "retired")}
                    disabled={isBusy || asset.publish_state === "retired"}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Retire
                  </Button>
                </div>

                {asset.publish_state === "ready" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Ready assets auto-go live when the daily scheduler picks them.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
