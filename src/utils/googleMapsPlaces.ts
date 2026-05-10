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
    gm_authFailure?: () => void;
  }
}

const GOOGLE_MAPS_PLACES_SCRIPT_ID = "google-maps-places-js";
const GOOGLE_MAPS_PLACES_DIAGNOSTIC_PREFIX = "[Google Maps Places]";
const GOOGLE_MAPS_AUTH_ALERT_MESSAGE = "This page can't load Google Maps correctly";

let googleMapsPlacesPromise: Promise<GoogleMapsPlacesLibrary | null> | null = null;

export const getGoogleMapsApiKey = (): string | null => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
};

export const isGooglePlacesAutocompleteConfigured = (): boolean => Boolean(getGoogleMapsApiKey());

export const getLoadedGoogleMapsPlacesLibrary = (): GoogleMapsPlacesLibrary | null =>
  typeof window !== "undefined" && window.google?.maps?.places?.Autocomplete ? window.google.maps.places : null;

export const clearGoogleMapsAutocompleteListeners = (autocomplete: unknown): void => {
  window.google?.maps?.event?.clearInstanceListeners?.(autocomplete);
};

const isGoogleMapsPlacesDiagnosticsEnabled = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_GOOGLE_MAPS_DEBUG === "true";

const getRuntimeDiagnosticDetails = () => {
  if (typeof window === "undefined") {
    return { hasWindow: false };
  }

  return {
    hasWindow: true,
    origin: window.location?.origin ?? null,
    protocol: window.location?.protocol ?? null,
  };
};

const logGoogleMapsPlacesDiagnostic = (
  message: string,
  details: Record<string, unknown> = {},
): void => {
  if (!isGoogleMapsPlacesDiagnosticsEnabled()) return;
  console.info(GOOGLE_MAPS_PLACES_DIAGNOSTIC_PREFIX, message, {
    ...getRuntimeDiagnosticDetails(),
    ...details,
  });
};

const resetFailedGoogleMapsPlacesLoad = (script: HTMLScriptElement | null): void => {
  googleMapsPlacesPromise = null;
  script?.remove();
};

const installGoogleMapsAuthAlertSuppressor = (): (() => void) => {
  const previousAlert = window.alert;
  const wrappedAlert: typeof window.alert = (message) => {
    if (typeof message === "string" && message.includes(GOOGLE_MAPS_AUTH_ALERT_MESSAGE)) {
      logGoogleMapsPlacesDiagnostic("Suppressed Google Maps authentication alert.", {
        hasApiKey: true,
      });
      return;
    }

    previousAlert.call(window, message);
  };

  window.alert = wrappedAlert;

  return () => {
    if (window.alert === wrappedAlert) {
      window.alert = previousAlert;
    }
  };
};

const resolveLoadedGoogleMapsPlaces = (script: HTMLScriptElement | null): GoogleMapsPlacesLibrary | null => {
  const places = getLoadedGoogleMapsPlacesLibrary();
  if (places) return places;

  logGoogleMapsPlacesDiagnostic("Maps JavaScript loaded, but Places autocomplete is unavailable.", {
    hasApiKey: true,
    hasGoogleMaps: Boolean(window.google?.maps),
    hasPlacesNamespace: Boolean(window.google?.maps?.places),
  });
  resetFailedGoogleMapsPlacesLoad(script);
  return null;
};

export const loadGoogleMapsPlacesLibrary = (): Promise<GoogleMapsPlacesLibrary | null> => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || typeof window === "undefined" || typeof document === "undefined") {
    logGoogleMapsPlacesDiagnostic("Autocomplete disabled before script load.", {
      hasApiKey: Boolean(apiKey),
      hasDocument: typeof document !== "undefined",
    });
    return Promise.resolve(null);
  }

  const loadedPlaces = getLoadedGoogleMapsPlacesLibrary();
  if (loadedPlaces) {
    logGoogleMapsPlacesDiagnostic("Places library already loaded.", { hasApiKey: true });
    return Promise.resolve(loadedPlaces);
  }

  if (googleMapsPlacesPromise) return googleMapsPlacesPromise;

  googleMapsPlacesPromise = new Promise((resolve) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    const previousAuthFailure = window.gm_authFailure;
    const restoreAuthAlert = installGoogleMapsAuthAlertSuppressor();
    let isSettled = false;
    const settle = (places: GoogleMapsPlacesLibrary | null) => {
      if (isSettled) return;
      isSettled = true;
      window.gm_authFailure = previousAuthFailure;
      window.setTimeout(restoreAuthAlert, 0);
      resolve(places);
    };
    const handleAuthFailure = (script: HTMLScriptElement | null) => {
      previousAuthFailure?.();
      logGoogleMapsPlacesDiagnostic("Maps JavaScript authentication failed.", {
        hasApiKey: true,
      });
      resetFailedGoogleMapsPlacesLoad(script);
      settle(null);
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        settle(resolveLoadedGoogleMapsPlaces(existingScript));
        return;
      }
      window.gm_authFailure = () => handleAuthFailure(existingScript);
      existingScript.addEventListener("load", () => {
        logGoogleMapsPlacesDiagnostic("Existing Maps JavaScript script loaded.", { hasApiKey: true });
        settle(resolveLoadedGoogleMapsPlaces(existingScript));
      }, { once: true });
      existingScript.addEventListener("error", () => {
        logGoogleMapsPlacesDiagnostic("Existing Maps JavaScript script failed to load.", {
          hasApiKey: true,
        });
        resetFailedGoogleMapsPlacesLoad(existingScript);
        settle(null);
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_PLACES_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async`;
    window.gm_authFailure = () => handleAuthFailure(script);
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      logGoogleMapsPlacesDiagnostic("Maps JavaScript script loaded.", { hasApiKey: true });
      settle(resolveLoadedGoogleMapsPlaces(script));
    }, { once: true });
    script.addEventListener("error", () => {
      logGoogleMapsPlacesDiagnostic("Maps JavaScript script failed to load.", {
        hasApiKey: true,
      });
      resetFailedGoogleMapsPlacesLoad(script);
      settle(null);
    }, { once: true });
    logGoogleMapsPlacesDiagnostic("Requesting Maps JavaScript script.", { hasApiKey: true });
    document.head.appendChild(script);
  });

  return googleMapsPlacesPromise;
};
