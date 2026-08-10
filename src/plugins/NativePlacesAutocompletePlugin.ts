import { registerPlugin } from '@capacitor/core';
import type { NativePlacesAutocompletePlugin } from "./NativePlacesAutocompleteTypes";

export type {
  NativePlacesAutocompletePlugin,
  NativePlacesAutocompleteSuggestion,
} from "./NativePlacesAutocompleteTypes";

export const NativePlacesAutocomplete = registerPlugin<NativePlacesAutocompletePlugin>('NativePlacesAutocomplete', {
  web: () => import('./NativePlacesAutocompleteWeb').then((m) => new m.NativePlacesAutocompleteWeb()),
});
