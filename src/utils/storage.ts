/**
 * Safe localStorage and sessionStorage wrappers with availability checks
 * Handles private browsing mode and storage disabled scenarios
 */

const isLocalStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

const isSessionStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (!isLocalStorageAvailable()) return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (!isLocalStorageAvailable()) return false;
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (!isLocalStorageAvailable()) return false;
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: (): boolean => {
    try {
      if (!isLocalStorageAvailable()) return false;
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (!isSessionStorageAvailable()) return null;
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (!isSessionStorageAvailable()) return false;
      sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (!isSessionStorageAvailable()) return false;
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: (): boolean => {
    try {
      if (!isSessionStorageAvailable()) return false;
      sessionStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};
