import { registerPlugin } from '@capacitor/core';

export interface NativePlacesAutocompleteSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText?: string;
  fullText: string;
}

export interface NativePlacesAutocompletePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  beginSession(): Promise<{ sessionId: string }>;
  fetchSuggestions(options: {
    sessionId: string;
    input: string;
  }): Promise<{ suggestions: NativePlacesAutocompleteSuggestion[] }>;
  resolveSuggestion(options: {
    sessionId: string;
    placeId: string;
  }): Promise<{ location: string; placeId: string }>;
  endSession(options: { sessionId: string }): Promise<{ success: boolean }>;
  getOpenSourceLicenseInfo(): Promise<{ licenseInfo: string }>;
}

export const NativePlacesAutocomplete = registerPlugin<NativePlacesAutocompletePlugin>('NativePlacesAutocomplete', {
  web: () => import('./NativePlacesAutocompleteWeb').then((m) => new m.NativePlacesAutocompleteWeb()),
});
