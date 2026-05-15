import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuestLocationAutocompleteInput } from "@/components/QuestLocationAutocompleteInput";

const mocks = vi.hoisted(() => ({
  nativePlatform: false,
  platform: "web",
  configured: false,
  clearGoogleMapsAutocompleteListeners: vi.fn(),
  loadGoogleMapsPlacesLibrary: vi.fn(),
  nativePlacesAutocomplete: {
    isAvailable: vi.fn(),
    beginSession: vi.fn(),
    fetchSuggestions: vi.fn(),
    resolveSuggestion: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.nativePlatform,
    getPlatform: () => mocks.platform,
  },
}));

vi.mock("@/plugins/NativePlacesAutocompletePlugin", () => ({
  NativePlacesAutocomplete: mocks.nativePlacesAutocomplete,
}));

vi.mock("@/utils/googleMapsPlaces", () => ({
  clearGoogleMapsAutocompleteListeners: (autocomplete: unknown) => mocks.clearGoogleMapsAutocompleteListeners(autocomplete),
  isGooglePlacesAutocompleteConfigured: () => mocks.configured,
  loadGoogleMapsPlacesLibrary: () => mocks.loadGoogleMapsPlacesLibrary(),
}));

describe("QuestLocationAutocompleteInput", () => {
  beforeEach(() => {
    mocks.nativePlatform = false;
    mocks.platform = "web";
    mocks.configured = false;
    mocks.clearGoogleMapsAutocompleteListeners.mockClear();
    mocks.loadGoogleMapsPlacesLibrary.mockReset();
    mocks.nativePlacesAutocomplete.isAvailable.mockReset();
    mocks.nativePlacesAutocomplete.beginSession.mockReset();
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockReset();
    mocks.nativePlacesAutocomplete.resolveSuggestion.mockReset();
    mocks.nativePlacesAutocomplete.endSession.mockReset();
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: false });
    mocks.nativePlacesAutocomplete.beginSession.mockResolvedValue({ sessionId: "native-session" });
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockResolvedValue({ suggestions: [] });
    mocks.nativePlacesAutocomplete.resolveSuggestion.mockResolvedValue({
      location: "1 Ferry Building, San Francisco, CA",
      placeId: "place-1",
    });
    mocks.nativePlacesAutocomplete.endSession.mockResolvedValue({ success: true });
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

  it("uses native iOS Places suggestions instead of Google Maps JavaScript", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: true });
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockResolvedValue({
      suggestions: [
        {
          placeId: "native-place-1",
          primaryText: "1157 East 105th Street",
          secondaryText: "Los Angeles, CA, USA",
          fullText: "1157 East 105th Street Los Angeles, CA, USA",
        },
      ],
    });
    const onChange = vi.fn();

    render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("Address or place name (optional)");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1157" } });

    expect(onChange).toHaveBeenCalledWith("1157");
    await screen.findByText("1157 East 105th Street");
    expect(screen.getByText("Powered by Google")).toBeInTheDocument();
    expect(mocks.nativePlacesAutocomplete.beginSession).toHaveBeenCalledTimes(1);
    expect(mocks.nativePlacesAutocomplete.fetchSuggestions).toHaveBeenCalledWith({
      sessionId: "native-session",
      input: "1157",
    });
    expect(mocks.loadGoogleMapsPlacesLibrary).not.toHaveBeenCalled();
  });

  it("keeps manual entry working on native iOS when native Places is unavailable", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: false });
    const onChange = vi.fn();

    render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Address or place name (optional)"), {
      target: { value: "Manual address" },
    });

    expect(onChange).toHaveBeenCalledWith("Manual address");
    await waitFor(() => {
      expect(mocks.nativePlacesAutocomplete.isAvailable).toHaveBeenCalled();
    });
    expect(mocks.nativePlacesAutocomplete.fetchSuggestions).not.toHaveBeenCalled();
    expect(mocks.loadGoogleMapsPlacesLibrary).not.toHaveBeenCalled();
  });

  it("resolves selected native iOS Places suggestions to formatted locations", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: true });
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockResolvedValue({
      suggestions: [
        {
          placeId: "native-place-1",
          primaryText: "1157 East 105th Street",
          secondaryText: "Los Angeles, CA, USA",
          fullText: "1157 East 105th Street Los Angeles, CA, USA",
        },
      ],
    });
    mocks.nativePlacesAutocomplete.resolveSuggestion.mockResolvedValue({
      location: "1157 E 105th St, Los Angeles, CA 90002, USA",
      placeId: "native-place-1",
    });
    const onChange = vi.fn();

    render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Address or place name (optional)"), {
      target: { value: "1157" },
    });
    await screen.findByText("1157 East 105th Street");

    fireEvent.click(screen.getByRole("button", {
      name: "Use 1157 East 105th Street Los Angeles, CA, USA",
    }));

    await waitFor(() => {
      expect(mocks.nativePlacesAutocomplete.resolveSuggestion).toHaveBeenCalledWith({
        sessionId: "native-session",
        placeId: "native-place-1",
      });
    });
    expect(onChange).toHaveBeenLastCalledWith("1157 E 105th St, Los Angeles, CA 90002, USA");
    expect(mocks.nativePlacesAutocomplete.endSession).toHaveBeenCalledWith({ sessionId: "native-session" });
  });

  it("ends the native iOS Places session when resolving a suggestion fails", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: true });
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockResolvedValue({
      suggestions: [
        {
          placeId: "native-place-1",
          primaryText: "1157 East 105th Street",
          secondaryText: "Los Angeles, CA, USA",
          fullText: "1157 East 105th Street Los Angeles, CA, USA",
        },
      ],
    });
    mocks.nativePlacesAutocomplete.resolveSuggestion.mockRejectedValue(new Error("resolve failed"));
    const onChange = vi.fn();

    render(<QuestLocationAutocompleteInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Address or place name (optional)"), {
      target: { value: "1157" },
    });
    await screen.findByText("1157 East 105th Street");

    fireEvent.click(screen.getByRole("button", {
      name: "Use 1157 East 105th Street Los Angeles, CA, USA",
    }));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("1157 East 105th Street Los Angeles, CA, USA");
    });
    expect(mocks.nativePlacesAutocomplete.endSession).toHaveBeenCalledWith({ sessionId: "native-session" });
  });

  it("ends a late native iOS Places session when the input unmounts before setup finishes", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: true });
    let resolveBeginSession: (value: { sessionId: string }) => void = () => {};
    mocks.nativePlacesAutocomplete.beginSession.mockImplementation(() => new Promise<{ sessionId: string }>((resolve) => {
      resolveBeginSession = resolve;
    }));

    const { unmount } = render(<QuestLocationAutocompleteInput value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Address or place name (optional)"), {
      target: { value: "1157" },
    });
    await waitFor(() => {
      expect(mocks.nativePlacesAutocomplete.beginSession).toHaveBeenCalled();
    });

    unmount();
    await act(async () => {
      resolveBeginSession({ sessionId: "late-native-session" });
    });

    await waitFor(() => {
      expect(mocks.nativePlacesAutocomplete.endSession).toHaveBeenCalledWith({
        sessionId: "late-native-session",
      });
    });
    expect(mocks.nativePlacesAutocomplete.fetchSuggestions).not.toHaveBeenCalled();
  });

  it("dismisses native iOS Places suggestions on blur and ends the abandoned session", async () => {
    mocks.nativePlatform = true;
    mocks.platform = "ios";
    mocks.nativePlacesAutocomplete.isAvailable.mockResolvedValue({ available: true });
    mocks.nativePlacesAutocomplete.fetchSuggestions.mockResolvedValue({
      suggestions: [
        {
          placeId: "native-place-1",
          primaryText: "1157 East 105th Street",
          secondaryText: "Los Angeles, CA, USA",
          fullText: "1157 East 105th Street Los Angeles, CA, USA",
        },
      ],
    });

    render(<QuestLocationAutocompleteInput value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Address or place name (optional)");

    fireEvent.change(input, { target: { value: "1157" } });
    await screen.findByText("Powered by Google");

    fireEvent.blur(input, { relatedTarget: null });

    await waitFor(() => {
      expect(screen.queryByText("Powered by Google")).not.toBeInTheDocument();
    });
    expect(mocks.nativePlacesAutocomplete.endSession).toHaveBeenCalledWith({ sessionId: "native-session" });
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
