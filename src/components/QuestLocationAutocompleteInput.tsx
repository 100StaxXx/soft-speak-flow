import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  NativePlacesAutocomplete,
  type NativePlacesAutocompleteSuggestion,
} from "@/plugins/NativePlacesAutocompletePlugin";
import {
  clearGoogleMapsAutocompleteListeners,
  isGooglePlacesAutocompleteConfigured,
  loadGoogleMapsPlacesLibrary,
  type GoogleMapsPlacesAutocomplete,
  type GoogleMapsAutocompleteListener,
} from "@/utils/googleMapsPlaces";

interface QuestLocationAutocompleteInputProps {
  value: string;
  onChange: (location: string | null) => void;
  placeholder?: string;
  className?: string;
}

const MIN_NATIVE_AUTOCOMPLETE_INPUT_LENGTH = 2;

const endNativePlacesSession = async (sessionId: string): Promise<void> => {
  try {
    await NativePlacesAutocomplete.endSession({ sessionId });
  } catch {
    // Best-effort cleanup only; manual location entry should never depend on session teardown.
  }
};

export function QuestLocationAutocompleteInput({
  value,
  onChange,
  placeholder = "Address or place name (optional)",
  className,
}: QuestLocationAutocompleteInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const hasRequestedAutocompleteRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const autocompleteRef = useRef<GoogleMapsPlacesAutocomplete | null>(null);
  const listenerRef = useRef<GoogleMapsAutocompleteListener | null>(null);
  const nativeSessionIdRef = useRef<string | null>(null);
  const nativeSessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const nativePlacesAvailableRef = useRef<boolean | null>(null);
  const nativeRequestIdRef = useRef(0);
  const [nativeSuggestions, setNativeSuggestions] = useState<NativePlacesAutocompleteSuggestion[]>([]);
  const [isNativeLoading, setIsNativeLoading] = useState(false);
  const [showNativeSuggestions, setShowNativeSuggestions] = useState(false);
  const shouldUseNativePlacesAutocomplete = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  const closeNativeSession = useCallback(() => {
    const sessionId = nativeSessionIdRef.current;
    nativeSessionIdRef.current = null;
    if (sessionId) {
      void endNativePlacesSession(sessionId);
    }
  }, []);

  const dismissNativeSuggestions = useCallback((options?: { endSession?: boolean }) => {
    const dismissedRequestId = nativeRequestIdRef.current + 1;
    nativeRequestIdRef.current = dismissedRequestId;
    const pendingSession = nativeSessionPromiseRef.current;
    setNativeSuggestions([]);
    setShowNativeSuggestions(false);
    setIsNativeLoading(false);
    if (options?.endSession) {
      closeNativeSession();
      void pendingSession?.then((sessionId) => {
        if (
          sessionId
          && nativeRequestIdRef.current === dismissedRequestId
          && nativeSessionIdRef.current === sessionId
        ) {
          closeNativeSession();
        }
      });
    }
  }, [closeNativeSession]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      listenerRef.current?.remove();
      if (autocompleteRef.current) {
        clearGoogleMapsAutocompleteListeners(autocompleteRef.current);
      }
      nativeRequestIdRef.current += 1;
      closeNativeSession();
    };
  }, [closeNativeSession]);

  useEffect(() => {
    if (!shouldUseNativePlacesAutocomplete || (!showNativeSuggestions && !isNativeLoading)) {
      return;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      dismissNativeSuggestions({ endSession: true });
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissNativeSuggestions({ endSession: true });
      }
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [
    dismissNativeSuggestions,
    isNativeLoading,
    shouldUseNativePlacesAutocomplete,
    showNativeSuggestions,
  ]);

  const ensureNativeSession = useCallback((): Promise<string | null> => {
    if (!shouldUseNativePlacesAutocomplete || nativePlacesAvailableRef.current === false) {
      return Promise.resolve(null);
    }
    if (nativeSessionIdRef.current) {
      return Promise.resolve(nativeSessionIdRef.current);
    }
    if (nativeSessionPromiseRef.current) {
      return nativeSessionPromiseRef.current;
    }

    const sessionPromise = NativePlacesAutocomplete.isAvailable()
      .then(async ({ available }) => {
        nativePlacesAvailableRef.current = available;
        if (!available) return null;

        const { sessionId } = await NativePlacesAutocomplete.beginSession();
        if (isUnmountedRef.current) {
          void endNativePlacesSession(sessionId);
          return null;
        }
        nativeSessionIdRef.current = sessionId;
        return sessionId;
      })
      .catch(() => {
        nativePlacesAvailableRef.current = false;
        return null;
      });

    const trackedPromise = sessionPromise.finally(() => {
      if (nativeSessionPromiseRef.current === trackedPromise) {
        nativeSessionPromiseRef.current = null;
      }
    });
    nativeSessionPromiseRef.current = trackedPromise;

    return nativeSessionPromiseRef.current;
  }, [shouldUseNativePlacesAutocomplete]);

  const requestNativeSuggestions = useCallback((rawInput: string) => {
    if (!shouldUseNativePlacesAutocomplete) return;

    const input = rawInput.trim();
    const requestId = nativeRequestIdRef.current + 1;
    nativeRequestIdRef.current = requestId;

    if (input.length < MIN_NATIVE_AUTOCOMPLETE_INPUT_LENGTH) {
      setNativeSuggestions([]);
      setShowNativeSuggestions(false);
      setIsNativeLoading(false);
      return;
    }

    setIsNativeLoading(true);

    void ensureNativeSession()
      .then(async (sessionId) => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        if (!sessionId) {
          setNativeSuggestions([]);
          setShowNativeSuggestions(false);
          return;
        }

        const { suggestions } = await NativePlacesAutocomplete.fetchSuggestions({ sessionId, input });
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;

        setNativeSuggestions(suggestions);
        setShowNativeSuggestions(suggestions.length > 0);
      })
      .catch(() => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        dismissNativeSuggestions({ endSession: true });
      })
      .finally(() => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        setIsNativeLoading(false);
      });
  }, [ensureNativeSession, shouldUseNativePlacesAutocomplete]);

  const handleNativeSuggestionSelect = useCallback((suggestion: NativePlacesAutocompleteSuggestion) => {
    const requestId = nativeRequestIdRef.current + 1;
    nativeRequestIdRef.current = requestId;
    const sessionId = nativeSessionIdRef.current;
    const fallbackLocation = suggestion.fullText || suggestion.primaryText;

    setShowNativeSuggestions(false);
    setIsNativeLoading(true);

    if (!sessionId) {
      onChangeRef.current(fallbackLocation || null);
      setNativeSuggestions([]);
      setIsNativeLoading(false);
      return;
    }

    void NativePlacesAutocomplete.resolveSuggestion({ sessionId, placeId: suggestion.placeId })
      .then(({ location }) => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        onChangeRef.current(location || fallbackLocation || null);
        setNativeSuggestions([]);

        closeNativeSession();
      })
      .catch(() => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        onChangeRef.current(fallbackLocation || null);
        setNativeSuggestions([]);
        closeNativeSession();
      })
      .finally(() => {
        if (nativeRequestIdRef.current !== requestId || isUnmountedRef.current) return;
        setIsNativeLoading(false);
      });
  }, []);

  const ensureAutocomplete = useCallback(() => {
    if (
      shouldUseNativePlacesAutocomplete
      ||
      !isGooglePlacesAutocompleteConfigured()
      || hasRequestedAutocompleteRef.current
      || autocompleteRef.current
    ) {
      return;
    }

    hasRequestedAutocompleteRef.current = true;

    void loadGoogleMapsPlacesLibrary().then((places) => {
      if (!places) {
        hasRequestedAutocompleteRef.current = false;
        return;
      }

      if (isUnmountedRef.current || !inputRef.current || autocompleteRef.current) return;

      const autocomplete = new places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "name"],
      });
      autocompleteRef.current = autocomplete;
      listenerRef.current = autocomplete.addListener("place_changed", () => {
        const place = autocomplete?.getPlace();
        const selectedLocation = place?.formatted_address?.trim() || place?.name?.trim() || inputRef.current?.value.trim() || null;
        onChangeRef.current(selectedLocation);
      });

      if (inputRef.current.value.trim()) {
        inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }).catch(() => {
      hasRequestedAutocompleteRef.current = false;
    });
  }, [shouldUseNativePlacesAutocomplete]);

  return (
    <div ref={rootRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onFocus={() => {
          if (shouldUseNativePlacesAutocomplete) {
            requestNativeSuggestions(value);
            return;
          }
          ensureAutocomplete();
        }}
        onChange={(event) => {
          if (shouldUseNativePlacesAutocomplete) {
            requestNativeSuggestions(event.target.value);
          } else {
            ensureAutocomplete();
          }
          onChange(event.target.value || null);
        }}
        onBlur={(event) => {
          if (!shouldUseNativePlacesAutocomplete) return;
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) return;

          window.setTimeout(() => {
            const activeElement = document.activeElement;
            if (activeElement instanceof Node && rootRef.current?.contains(activeElement)) return;
            dismissNativeSuggestions({ endSession: true });
          }, 0);
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {shouldUseNativePlacesAutocomplete && (showNativeSuggestions || isNativeLoading) && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-[2147483647] overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-xl">
          {nativeSuggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              aria-label={`Use ${suggestion.fullText}`}
              className="flex w-full flex-col items-start border-b border-border/50 px-3 py-2.5 text-left last:border-b-0 hover:bg-accent focus:bg-accent focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleNativeSuggestionSelect(suggestion)}
            >
              <span className="text-sm font-semibold text-foreground">{suggestion.primaryText}</span>
              {suggestion.secondaryText && (
                <span className="text-xs text-muted-foreground">{suggestion.secondaryText}</span>
              )}
            </button>
          ))}
          {isNativeLoading && nativeSuggestions.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">Searching...</div>
          )}
          {nativeSuggestions.length > 0 && (
            <div className="border-t border-border/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              Powered by Google
            </div>
          )}
        </div>
      )}
    </div>
  );
}
