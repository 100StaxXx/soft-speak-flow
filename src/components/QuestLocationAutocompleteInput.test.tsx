import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuestLocationAutocompleteInput } from "@/components/QuestLocationAutocompleteInput";

const mocks = vi.hoisted(() => ({
  configured: false,
  clearGoogleMapsAutocompleteListeners: vi.fn(),
  loadGoogleMapsPlacesLibrary: vi.fn(),
}));

vi.mock("@/utils/googleMapsPlaces", () => ({
  clearGoogleMapsAutocompleteListeners: (autocomplete: unknown) => mocks.clearGoogleMapsAutocompleteListeners(autocomplete),
  isGooglePlacesAutocompleteConfigured: () => mocks.configured,
  loadGoogleMapsPlacesLibrary: () => mocks.loadGoogleMapsPlacesLibrary(),
}));

describe("QuestLocationAutocompleteInput", () => {
  beforeEach(() => {
    mocks.configured = false;
    mocks.clearGoogleMapsAutocompleteListeners.mockClear();
    mocks.loadGoogleMapsPlacesLibrary.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps manual location entry working without a Google Maps key", () => {
    const onChange = vi.fn();

    render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Address or place name (optional)"), {
      target: { value: "Library" },
    });

    expect(onChange).toHaveBeenCalledWith("Library");
    expect(mocks.loadGoogleMapsPlacesLibrary).not.toHaveBeenCalled();
  });

  it("uses the selected Google place formatted address when configured", async () => {
    mocks.configured = true;
    const removeListener = vi.fn();
    let placeChangedHandler: (() => void) | null = null;
    const autocomplete = {
      addListener: vi.fn((_eventName: "place_changed", handler: () => void) => {
        placeChangedHandler = handler;
        return { remove: removeListener };
      }),
      getPlace: vi.fn(() => ({
        formatted_address: "1 Ferry Building, San Francisco, CA",
        name: "Ferry Building",
        place_id: "place-1",
      })),
    };
    const Autocomplete = vi.fn(() => autocomplete);
    mocks.loadGoogleMapsPlacesLibrary.mockResolvedValue({ Autocomplete });
    const onChange = vi.fn();

    const { unmount } = render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("Address or place name (optional)");

    expect(mocks.loadGoogleMapsPlacesLibrary).not.toHaveBeenCalled();
    fireEvent.focus(input);

    await waitFor(() => {
      expect(Autocomplete).toHaveBeenCalled();
    });

    act(() => {
      placeChangedHandler?.();
    });

    expect(onChange).toHaveBeenCalledWith("1 Ferry Building, San Francisco, CA");

    unmount();
    expect(removeListener).toHaveBeenCalled();
    expect(mocks.clearGoogleMapsAutocompleteListeners).toHaveBeenCalledWith(autocomplete);
  });

  it("retries autocomplete setup after an unavailable load", async () => {
    mocks.configured = true;
    const autocomplete = {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
      getPlace: vi.fn(),
    };
    const Autocomplete = vi.fn(() => autocomplete);
    mocks.loadGoogleMapsPlacesLibrary
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ Autocomplete });

    render(<QuestLocationAutocompleteInput value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Address or place name (optional)");

    fireEvent.focus(input);
    await waitFor(() => {
      expect(mocks.loadGoogleMapsPlacesLibrary).toHaveBeenCalledTimes(1);
    });
    expect(Autocomplete).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Ferry" } });

    await waitFor(() => {
      expect(Autocomplete).toHaveBeenCalled();
    });
    expect(mocks.loadGoogleMapsPlacesLibrary).toHaveBeenCalledTimes(2);
  });

  it("replays typed text after a delayed autocomplete attachment", async () => {
    mocks.configured = true;
    const dispatchSpy = vi.spyOn(HTMLInputElement.prototype, "dispatchEvent");
    const autocomplete = {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
      getPlace: vi.fn(),
    };
    const Autocomplete = vi.fn(() => autocomplete);
    mocks.loadGoogleMapsPlacesLibrary.mockResolvedValue({ Autocomplete });

    render(<QuestLocationAutocompleteInput value="1157 canyon" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Address or place name (optional)");

    fireEvent.focus(input);

    await waitFor(() => {
      expect(Autocomplete).toHaveBeenCalled();
    });

    expect(dispatchSpy.mock.calls.some(([event]) => event.type === "input")).toBe(true);
  });
});
