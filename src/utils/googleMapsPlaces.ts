export interface GoogleMapsPlaceResult {
  formatted_address?: string;
  name?: string;
  place_id?: string;
}

export interface GoogleMapsAutocompleteListener {
  remove: () => void;
}

export interface GoogleMapsPlacesAutocomplete {
  addListener: (eventName: "place_changed", handler: () => void) => GoogleMapsAutocompleteListener;
  getPlace: () => GoogleMapsPlaceResult;
}

export interface GoogleMapsPlacesLibrary {
  Autocomplete: new (
    input: HTMLInputElement,
    options?: {
      fields?: string[];
    },
  ) => GoogleMapsPlacesAutocomplete;
}

interface GoogleMapsNamespace {
  maps?: {
    places?: GoogleMapsPlacesLibrary;
    event?: {
      clearInstanceListeners?: (instance: unknown) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
  }
}

const GOOGLE_MAPS_PLACES_SCRIPT_ID = "google-maps-places-js";

let googleMapsPlacesPromise: Promise<GoogleMapsPlacesLibrary | null> | null = null;

export const getGoogleMapsApiKey = (): string | null => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
};

export const isGooglePlacesAutocompleteConfigured = (): boolean => Boolean(getGoogleMapsApiKey());

export const getLoadedGoogleMapsPlacesLibrary = (): GoogleMapsPlacesLibrary | null =>
  window.google?.maps?.places?.Autocomplete ? window.google.maps.places : null;

export const clearGoogleMapsAutocompleteListeners = (autocomplete: unknown): void => {
  window.google?.maps?.event?.clearInstanceListeners?.(autocomplete);
};

const resetFailedGoogleMapsPlacesLoad = (script: HTMLScriptElement | null): void => {
  googleMapsPlacesPromise = null;
  script?.remove();
};

export const loadGoogleMapsPlacesLibrary = (): Promise<GoogleMapsPlacesLibrary | null> => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  const loadedPlaces = getLoadedGoogleMapsPlacesLibrary();
  if (loadedPlaces) return Promise.resolve(loadedPlaces);

  if (googleMapsPlacesPromise) return googleMapsPlacesPromise;

  googleMapsPlacesPromise = new Promise((resolve) => {
    const resolveLoadedPlaces = () => resolve(getLoadedGoogleMapsPlacesLibrary());
    const existingScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolveLoadedPlaces();
        return;
      }
      existingScript.addEventListener("load", resolveLoadedPlaces, { once: true });
      existingScript.addEventListener("error", () => {
        resetFailedGoogleMapsPlacesLoad(existingScript);
        resolve(null);
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_PLACES_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async`;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolveLoadedPlaces();
    }, { once: true });
    script.addEventListener("error", () => {
      resetFailedGoogleMapsPlacesLoad(script);
      resolve(null);
    }, { once: true });
    document.head.appendChild(script);
  });

  return googleMapsPlacesPromise;
};
