import { memo, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Sparkles, Camera, Palette, Wand2, Eye } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionLife } from "@/hooks/useCompanionLife";
import { CompanionHabitatScene } from "@/components/companion/CompanionHabitatScene";
import { useMotionProfile } from "@/hooks/useMotionProfile";

const QUALITY_LEVELS: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];

const ambianceByTheme: Record<string, string> = {
  cosmic_nest: "serene",
  starlit_valley: "hopeful",
  moonlit_garden: "fragile",
  aurora_grove: "hopeful",
  ashen_hollow: "intense",
};

const formatLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const HomeTab = memo(() => {
  const reducedMotion = useReducedMotion();
  const { profile: motionProfile, capabilities } = useMotionProfile();
  const { companion } = useCompanion();
  const {
    habitat,
    habitatItems,
    publishSnapshot,
    snapshots,
    setHabitatAppearance,
    seedStarterHabitatItems,
    equipHabitatItem,
  } = useCompanionLife();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const resolvedReducedMotion =
    Boolean(reducedMotion) || motionProfile === "reduced" || !capabilities.allowBackgroundAnimation;

  const slotEntries = Object.entries(habitat.decorSlots ?? {});
  const themes = habitat.unlockedThemes?.length ? habitat.unlockedThemes : ["cosmic_nest"];

  const slotGroups = habitatItems.reduce<Record<string, typeof habitatItems>>((acc, item) => {
    const key = item.slot;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const selectedSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    if (!selectedSnapshotId) return snapshots[0];
    return snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[0];
  }, [selectedSnapshotId, snapshots]);

  const resolvedQualityTier = useMemo<"high" | "medium" | "low">(() => {
    if (resolvedReducedMotion) return "low";
    if (motionProfile === "enhanced" && habitat.qualityTier !== "low") return "high";
    if (motionProfile === "balanced" && habitat.qualityTier === "high") return "medium";
    return habitat.qualityTier;
  }, [habitat.qualityTier, motionProfile, resolvedReducedMotion]);
  const particleBudget = useMemo(() => clamp(Number(capabilities.maxParticles ?? 12), 0, 64), [capabilities.maxParticles]);

  return (
    <div className="space-y-4 mt-6">
      <Card className="p-4 bg-card/70 border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Companion Home</p>
            <h3 className="text-lg font-semibold mt-1 flex items-center gap-2 capitalize">
              <Home className="h-4 w-4 text-primary" />
              {habitat.biome.replace(/_/g, " ")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ambiance: {habitat.ambiance} · Quality: {resolvedQualityTier}
            </p>
          </div>
          <Badge variant="secondary">2.5D scene</Badge>
        </div>
      </Card>

      <CompanionHabitatScene
        biome={habitat.biome}
        ambiance={habitat.ambiance}
        qualityTier={resolvedQualityTier}
        companionImageUrl={companion?.current_image_url ?? null}
        companionName={companion?.spirit_animal ?? "Companion"}
        reducedMotion={resolvedReducedMotion}
        maxParticles={particleBudget}
      />

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Palette className="h-4 w-4 text-fuchsia-300" />
          Theme & Atmosphere
        </h3>

        <div className="flex flex-wrap gap-2">
          {themes.map((theme) => (
            <Button
              key={theme}
              size="sm"
              variant={habitat.biome === theme ? "default" : "outline"}
              onClick={() => setHabitatAppearance.mutate({
                biome: theme,
                ambiance: ambianceByTheme[theme] ?? habitat.ambiance,
              })}
              disabled={setHabitatAppearance.isPending}
              className="capitalize"
            >
              {theme.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUALITY_LEVELS.map((level) => (
            <Button
              key={level}
              size="sm"
              variant={habitat.qualityTier === level ? "secondary" : "outline"}
              onClick={() => setHabitatAppearance.mutate({ qualityTier: level })}
              disabled={setHabitatAppearance.isPending}
              className="capitalize"
            >
              {level}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Decor Slots
          </h3>
          {habitatItems.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => seedStarterHabitatItems.mutate()}
              disabled={seedStarterHabitatItems.isPending}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {seedStarterHabitatItems.isPending ? "Seeding" : "Seed Starter Decor"}
            </Button>
          )}
        </div>

        {slotEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decor slots configured yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {slotEntries.map(([slot, value]) => (
              <div key={slot} className="rounded-lg border border-border/50 p-3 bg-background/30">
                <p className="text-xs text-muted-foreground capitalize">{slot}</p>
                <p className="text-sm mt-1 font-medium">{value ? value : "Empty"}</p>
              </div>
            ))}
          </div>
        )}

        {Object.keys(slotGroups).length > 0 && (
          <div className="space-y-3 pt-1">
            {Object.entries(slotGroups).map(([slot, items]) => (
              <div key={slot} className="rounded-lg border border-border/40 p-3 bg-background/20">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 capitalize">{slot}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={item.isEquipped ? "default" : "outline"}
                      onClick={() => equipHabitatItem.mutate({ itemId: item.id, slot })}
                      disabled={equipHabitatItem.isPending}
                      className="gap-2"
                    >
                      {item.itemName}
                      <Badge variant="secondary" className="capitalize">{item.rarity}</Badge>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card/70 border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Capture your current home state</p>
            <p className="text-xs text-muted-foreground mt-1">
              Save a personal snapshot with biome, mood, and chapter progress.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => publishSnapshot.mutate({ visibility: "private" })}
            disabled={publishSnapshot.isPending}
            className="gap-2"
          >
            <Camera className="h-3.5 w-3.5" />
            {publishSnapshot.isPending ? "Saving" : "Save Snapshot"}
          </Button>
        </div>

        {snapshots.length > 0 && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Recent snapshots</p>
            <div className="space-y-2">
              {snapshots.slice(0, 3).map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between rounded-md border border-border/40 bg-background/20 p-2">
                  <div>
                    <p className="text-sm">{snapshot.headline}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(snapshot.publishedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedSnapshot?.id === snapshot.id ? "secondary" : "outline"}
                    className="gap-1.5"
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Replay
                  </Button>
                </div>
              ))}
            </div>

            {selectedSnapshot && (
              <div className="rounded-lg border border-border/50 bg-background/30 p-3 space-y-2" data-testid="snapshot-replay-card">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Snapshot Replay</p>
                <p className="text-sm font-medium">{selectedSnapshot.headline}</p>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    Mood: {selectedSnapshot.snapshotPayload?.companion?.mood ?? "unknown"} · Arc: {formatLabel(selectedSnapshot.snapshotPayload?.companion?.emotionalArc ?? "forming")}
                  </p>
                  <p>
                    Habitat: {formatLabel(selectedSnapshot.snapshotPayload?.habitat?.biome ?? "cosmic_nest")} · {formatLabel(selectedSnapshot.snapshotPayload?.habitat?.ambiance ?? "serene")}
                  </p>
                  <p>
                    Chapter: {selectedSnapshot.snapshotPayload?.campaign?.current_chapter ?? 0}
                  </p>
                  <p>
                    Bond: {selectedSnapshot.snapshotPayload?.companion?.bondLevel ?? "n/a"} · Stage {selectedSnapshot.snapshotPayload?.companion?.stage ?? "?"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
});

HomeTab.displayName = "HomeTab";
