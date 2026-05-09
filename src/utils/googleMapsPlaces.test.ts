import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GOOGLE_MAPS_PLACES_SCRIPT_ID = "google-maps-places-js";

describe("googleMapsPlaces", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "maps-key");
    document.head.innerHTML = "";
    delete window.google;
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
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
    const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

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
  });
});
