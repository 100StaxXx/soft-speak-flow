import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GOOGLE_MAPS_PLACES_SCRIPT_ID = "google-maps-places-js";

describe("googleMapsPlaces", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "maps-key");
    document.head.innerHTML = "";
    delete window.google;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.innerHTML = "";
    delete window.google;
  });

  it("removes a failed script load so autocomplete can retry", async () => {
    const { loadGoogleMapsPlacesLibrary } = await import("@/utils/googleMapsPlaces");

    const firstLoad = loadGoogleMapsPlacesLibrary();
    const firstScript = document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID) as HTMLScriptElement | null;
    expect(firstScript).toBeInstanceOf(HTMLScriptElement);

    firstScript?.dispatchEvent(new Event("error"));

    await expect(firstLoad).resolves.toBeNull();
    expect(document.getElementById(GOOGLE_MAPS_PLACES_SCRIPT_ID)).toBeNull();

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
});
