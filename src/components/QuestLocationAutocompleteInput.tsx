import { useCallback, useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
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

export function QuestLocationAutocompleteInput({
  value,
  onChange,
  placeholder = "Address or place name (optional)",
  className,
}: QuestLocationAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const hasRequestedAutocompleteRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const autocompleteRef = useRef<GoogleMapsPlacesAutocomplete | null>(null);
  const listenerRef = useRef<GoogleMapsAutocompleteListener | null>(null);

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
    };
  }, []);

  const ensureAutocomplete = useCallback(() => {
    if (
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
    }).catch(() => {
      hasRequestedAutocompleteRef.current = false;
    });
  }, []);

  return (
    <Input
      ref={inputRef}
      value={value}
      onFocus={ensureAutocomplete}
      onChange={(event) => {
        ensureAutocomplete();
        onChange(event.target.value || null);
      }}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
