import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CosmiqTitleCardLoadingSlide {
  profileKey: string;
  imageUrl: string;
  title: string;
  rarity: string;
  generatedAt: string | null;
}

interface CosmiqTitleCardLibraryRow {
  profile_key: string | null;
  image_url: string | null;
  title: string | null;
  rarity: string | null;
  status: string | null;
  generated_at: string | null;
  updated_at: string | null;
}

interface UseCosmiqTitleCardLoadingGalleryOptions {
  enabled?: boolean;
}

export const COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET = 10;
const COSMIQ_TITLE_CARD_LOADING_GALLERY_FETCH_LIMIT = 40;
const COSMIQ_TITLE_CARD_LOADING_GALLERY_REFETCH_MS = 12_000;
export const COSMIQ_TITLE_CARD_LOADING_GALLERY_SEED_RETRY_MS =
  COSMIQ_TITLE_CARD_LOADING_GALLERY_REFETCH_MS;

type CosmiqTitleCardLoadingGallerySeedRequest = {
  readyCount: number;
  requestedAt: number;
};

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const buildCosmiqTitleCardLoadingSlides = (
  rows: readonly CosmiqTitleCardLibraryRow[] | null | undefined,
  targetCount = COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET,
): CosmiqTitleCardLoadingSlide[] => {
  const slides: CosmiqTitleCardLoadingSlide[] = [];
  const seenProfiles = new Set<string>();
  const seenImages = new Set<string>();

  for (const row of rows ?? []) {
    if (row.status !== "ready" || !hasText(row.profile_key) || !hasText(row.image_url)) {
      continue;
    }

    const profileKey = row.profile_key.trim();
    const imageUrl = row.image_url.trim();
    if (seenProfiles.has(profileKey) || seenImages.has(imageUrl)) {
      continue;
    }

    seenProfiles.add(profileKey);
    seenImages.add(imageUrl);
    slides.push({
      profileKey,
      imageUrl,
      title: hasText(row.title) ? row.title.trim() : "Cosmiq Title",
      rarity: hasText(row.rarity) ? row.rarity.trim() : "rare",
      generatedAt: row.generated_at ?? row.updated_at ?? null,
    });

    if (slides.length >= targetCount) break;
  }

  return slides;
};

export const shouldRequestCosmiqTitleCardLoadingGallerySeed = ({
  readyCount,
  targetCount = COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET,
  isSeeding,
  lastSeedRequest,
  now,
  retryMs = COSMIQ_TITLE_CARD_LOADING_GALLERY_SEED_RETRY_MS,
}: {
  readyCount: number;
  targetCount?: number;
  isSeeding: boolean;
  lastSeedRequest: CosmiqTitleCardLoadingGallerySeedRequest | null;
  now: number;
  retryMs?: number;
}) => {
  if (readyCount >= targetCount) return false;
  if (isSeeding) return false;
  if (
    lastSeedRequest?.readyCount === readyCount
    && now - lastSeedRequest.requestedAt < retryMs
  ) {
    return false;
  }

  return true;
};

export function useCosmiqTitleCardLoadingGallery({
  enabled = true,
}: UseCosmiqTitleCardLoadingGalleryOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastSeedRequestRef = useRef<CosmiqTitleCardLoadingGallerySeedRequest | null>(null);
  const queryKey = useMemo(
    () => ["cosmiq-title-card-loading-gallery", user?.id] as const,
    [user?.id],
  );

  const galleryQuery = useQuery({
    queryKey,
    enabled: enabled && Boolean(user?.id),
    staleTime: 60_000,
    refetchInterval: COSMIQ_TITLE_CARD_LOADING_GALLERY_REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_cosmiq_title_cards")
        .select("profile_key,image_url,title,rarity,status,generated_at,updated_at")
        .eq("status", "ready")
        .not("image_url", "is", null)
        .order("generated_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(COSMIQ_TITLE_CARD_LOADING_GALLERY_FETCH_LIMIT);

      if (error) throw error;
      return buildCosmiqTitleCardLoadingSlides(data);
    },
  });

  const seedLibraryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("seed-cosmiq-title-card-library", {
        body: { targetReadyCount: COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const slides = galleryQuery.data ?? [];
  const readyCount = slides.length;

  useEffect(() => {
    if (!enabled || !user?.id || galleryQuery.isLoading || galleryQuery.isError) return;

    const now = Date.now();
    if (!shouldRequestCosmiqTitleCardLoadingGallerySeed({
      readyCount,
      isSeeding: seedLibraryMutation.isPending,
      lastSeedRequest: lastSeedRequestRef.current,
      now,
    })) {
      return;
    }

    lastSeedRequestRef.current = { readyCount, requestedAt: now };
    void seedLibraryMutation.mutateAsync().catch(() => undefined);
  }, [
    enabled,
    galleryQuery.isError,
    galleryQuery.isLoading,
    readyCount,
    seedLibraryMutation,
    user?.id,
  ]);

  return {
    slides,
    readyCount,
    targetCount: COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET,
    isLoading: galleryQuery.isLoading,
    isSeeding: seedLibraryMutation.isPending,
    error: galleryQuery.error ?? seedLibraryMutation.error ?? null,
  };
}
