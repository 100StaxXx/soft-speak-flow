import { useEffect, useState } from "react";

type ImageLoadState = "idle" | "loading" | "loaded" | "error";

export const usePreloadedImageUrl = (imageUrl: string | null | undefined) => {
  const [loadState, setLoadState] = useState<ImageLoadState>("idle");
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
      setLoadState("idle");
      setResolvedImageUrl(null);
      return;
    }

    let cancelled = false;
    const preloadImage = new Image();

    setLoadState("loading");
    setResolvedImageUrl(null);

    preloadImage.onload = () => {
      if (cancelled) return;
      setLoadState("loaded");
      setResolvedImageUrl(imageUrl);
    };

    preloadImage.onerror = () => {
      if (cancelled) return;
      setLoadState("error");
      setResolvedImageUrl(null);
    };

    preloadImage.src = imageUrl;

    if (preloadImage.complete && preloadImage.naturalWidth > 0) {
      setLoadState("loaded");
      setResolvedImageUrl(imageUrl);
    }

    return () => {
      cancelled = true;
      preloadImage.onload = null;
      preloadImage.onerror = null;
    };
  }, [imageUrl]);

  return {
    hasError: loadState === "error",
    isLoaded: loadState === "loaded",
    isLoading: loadState === "loading",
    resolvedImageUrl,
  };
};
