import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GOOGLE_MAPS_PLACES_SCRIPT_ID = "google-maps-places-js";

describe("googleMapsPlaces", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "maps-key");
    document.head.innerHTML = "";
    delete window.google;
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    consoleInfoSpy.mockRestore();
    vi.unstubAllEnvs();
    document.head.innerHTML = "";
    delete window.google;
    delete window.gm_authFailure;
  });

  it("logs disabled status without exposing a key when no key is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

    await expect(loadGoogleMapsPlacesLibrary()).resolves.toBeNull();

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Google Maps Places]",
      "Autocomplete disabled before script load.",
      expect.objectContaining({
        hasApiKey: false,
      }),
    );
    expect(JSON.stringify(consoleInfoSpy.mock.calls)).not.toContain("maps-key");
  });

  it("treats the example placeholder as unconfigured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "your-google-maps-browser-key");
    const {
      getGoogleMapsApiKey,
      isGooglePlacesAutocompleteConfigured,
      loadGoogleMapsPlacesLibrary,
    } = await import("@/utils/googleMapsPlaces");

    expect(getGoogleMapsApiKey()).toBeNull();
    expect(isGooglePlacesAutocompleteConfigured()).toBe(false);
    await expect(loadGoogleMapsPlacesLibrary()).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
  });

  it("removes a failed script load so autocomplete can retry", async () => {
    const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

    const firstLoad = loadGoogleMapsPlacesLibrary();
    const firstScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    expect(firstScript).toBeInstanceOf(HTMLScriptElement);

    firstScript?.dispatchEvent(new Event("error"));

    await expect(firstLoad).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Google Maps Places]",
      "Maps JavaScript script failed to load.",
      expect.objectContaining({
        hasApiKey: true,
      }),
    );

    const placesLibrary = {
      Autocomplete: class {
        constructor(_input: HTMLInputElement, _options?: { fields?: string[] }) {
          void _input;
          void _options;
        }
        addListener() {
          return { remove: vi.fn() };
        }
        getPlace() {
          return {};
        }
      },
    };
    const secondLoad = loadGoogleMapsPlacesLibrary();
    const secondScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    expect(secondScript).toBeInstanceOf(HTMLScriptElement);

    window.google = { maps: { places: placesLibrary } };
    secondScript?.dispatchEvent(new Event("load"));

    await expect(secondLoad).resolves.toBe(placesLibrary);
  });

  it("resets and logs when Maps loads without Places autocomplete", async () => {
    const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

    const firstLoad = loadGoogleMapsPlacesLibrary();
    const firstScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    expect(firstScript).toBeInstanceOf(HTMLScriptElement);

    window.google = { maps: {} };
    firstScript?.dispatchEvent(new Event("load"));

    await expect(firstLoad).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Google Maps Places]",
      "Maps JavaScript loaded, but Places autocomplete is unavailable.",
      expect.objectContaining({
        hasGoogleMaps: true,
        hasPlacesNamespace: false,
      }),
    );

    const placesLibrary = {
      Autocomplete: class {
        constructor(_input: HTMLInputElement, _options?: { fields?: string[] }) {
          void _input;
          void _options;
        }
        addListener() {
          return { remove: vi.fn() };
        }
        getPlace() {
          return {};
        }
      },
    };
    const secondLoad = loadGoogleMapsPlacesLibrary();
    const secondScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    expect(secondScript).toBeInstanceOf(HTMLScriptElement);

    window.google = { maps: { places: placesLibrary } };
    secondScript?.dispatchEvent(new Event("load"));

    await expect(secondLoad).resolves.toBe(placesLibrary);
  });

  it("resets and logs Google Maps authentication failures without exposing the key", async () => {
    const {
      isGooglePlacesAutocompleteConfigured,
      loadGoogleMapsPlacesLibrary,
    } = await import("@/utils/googleMapsPlaces");

    const load = loadGoogleMapsPlacesLibrary();
    const script = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID);
    expect(script).toBeInstanceOf(HTMLScriptElement);
    expect(window.gm_authFailure).toBeTypeOf("function");

    window.gm_authFailure?.();

    await expect(load).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[Google Maps Places]",
      "Maps JavaScript authentication failed.",
      expect.objectContaining({
        hasApiKey: true,
      }),
    );
    expect(JSON.stringify(consoleInfoSpy.mock.calls)).not.toContain("maps-key");
    expect(isGooglePlacesAutocompleteConfigured()).toBe(false);

    await expect(loadGoogleMapsPlacesLibrary()).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
  });

  it("keeps the auth failure handler alive briefly after Maps reports loaded", async () => {
    const {
      isGooglePlacesAutocompleteConfigured,
      loadGoogleMapsPlacesLibrary,
    } = await import("@/utils/googleMapsPlaces");
    const placesLibrary = {
      Autocomplete: class {
        constructor(_input: HTMLInputElement, _options?: { fields?: string[] }) {
          void _input;
          void _options;
        }
        addListener() {
          return { remove: vi.fn() };
        }
        getPlace() {
          return {};
        }
      },
    };

    const load = loadGoogleMapsPlacesLibrary();
    const script = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID);
    expect(script).toBeInstanceOf(HTMLScriptElement);

    window.google = { maps: { places: placesLibrary } };
    script?.dispatchEvent(new Event("load"));

    await expect(load).resolves.toBe(placesLibrary);

    window.gm_authFailure?.();

    expect(isGooglePlacesAutocompleteConfigured()).toBe(false);
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();
  });

  it("suppresses delayed Google Maps auth alerts and restores alerts afterward", async () => {
    const originalAlert = window.alert;
    const alertSpy = vi.fn();
    window.alert = alertSpy;

    try {
      const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

      const load = loadGoogleMapsPlacesLibrary();
      window.alert("This page can't load Google Maps correctly. Do you own this website?");

      expect(alertSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Google Maps Places]",
        "Suppressed Google Maps authentication alert.",
        expect.objectContaining({
          hasApiKey: true,
        }),
      );

      window.gm_authFailure?.();

      await expect(load).resolves.toBeNull();

      window.alert("Other alert");
      expect(alertSpy).toHaveBeenCalledWith("Other alert");

      vi.advanceTimersByTime(30_000);
      window.alert("This page can't load Google Maps correctly. Do you own this website?");
      expect(alertSpy).toHaveBeenCalledWith("This page can't load Google Maps correctly. Do you own this website?");
    } finally {
      window.alert = originalAlert;
    }
  });
});
