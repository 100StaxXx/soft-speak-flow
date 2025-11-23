/**
 * Safe localStorage wrapper with availability checks
 * Handles private browsing mode and storage disabled scenarios
 */

const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (!isStorageAvailable()) return null;
      return localStorage.getItem(key);
    } catch (error) {
      console.error('localStorage.getItem error:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (!isStorageAvailable()) return false;
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('localStorage.setItem error:', error);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (!isStorageAvailable()) return false;
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('localStorage.removeItem error:', error);
      return false;
    }
  },

  clear: (): boolean => {
    try {
      if (!isStorageAvailable()) return false;
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('localStorage.clear error:', error);
      return false;
    }
  },
};
