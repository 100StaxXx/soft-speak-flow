import { WebPlugin } from '@capacitor/core';
import type {
  NativePlacesAutocompletePlugin,
  NativePlacesAutocompleteSuggestion,
} from './NativePlacesAutocompleteTypes';

export class NativePlacesAutocompleteWeb extends WebPlugin implements NativePlacesAutocompletePlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async beginSession(): Promise<{ sessionId: string }> {
    throw new Error('Native Places autocomplete is only available on iOS native builds');
  }

  async fetchSuggestions(_options: {
    sessionId: string;
    input: string;
  }): Promise<{ suggestions: NativePlacesAutocompleteSuggestion[] }> {
    return { suggestions: [] };
  }

  async resolveSuggestion(_options: {
    sessionId: string;
    placeId: string;
  }): Promise<{ location: string; placeId: string }> {
    throw new Error('Native Places autocomplete is only available on iOS native builds');
  }

  async endSession(_options: { sessionId: string }): Promise<{ success: boolean }> {
    return { success: false };
  }

  async getOpenSourceLicenseInfo(): Promise<{ licenseInfo: string }> {
    return { licenseInfo: '' };
  }
}
