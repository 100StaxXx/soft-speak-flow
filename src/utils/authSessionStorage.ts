import { Capacitor, registerPlugin } from "@capacitor/core";
import { safeLocalStorage } from "@/utils/storage";

interface NativeAuthStorage {
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string }): Promise<void>;
  removeItem(options: { key: string }): Promise<void>;
}
const secureStorage = registerPlugin<NativeAuthStorage>("AuthSessionStorage");
const hasSecureStorage = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AuthSessionStorage");

export const authSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!hasSecureStorage()) return safeLocalStorage.getItem(key);
    // A locked/unavailable Keychain is an error, not evidence of a signed-out user.
    const { value } = await secureStorage.getItem({ key });
    if (value !== null) return value;
    const legacy = safeLocalStorage.getItem(key);
    if (legacy !== null) {
      await secureStorage.setItem({ key, value: legacy });
      safeLocalStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (hasSecureStorage()) {
      await secureStorage.setItem({ key, value });
      safeLocalStorage.removeItem(key);
    } else if (!safeLocalStorage.setItem(key, value)) {
      throw new Error("Could not save your session. Free up device storage and try again.");
    }
  },
  async removeItem(key: string): Promise<void> {
    if (hasSecureStorage()) await secureStorage.removeItem({ key });
    safeLocalStorage.removeItem(key);
  },
};
