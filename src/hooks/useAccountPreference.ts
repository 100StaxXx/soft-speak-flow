import { useCallback, useState, type SetStateAction } from "react";
import { safeLocalStorage } from "@/utils/storage";

/** Device preferences are scoped to the signed-in account, never to its session token. */
export function useAccountPreference<T extends string | boolean>(
  userId: string | undefined, name: string, fallback: T, allowed: readonly T[],
): [T, (value: SetStateAction<T>) => void] {
  const key = userId ? `cosmiq:preferences:${userId}:${name}` : null;
  const read = (): T => {
    if (!key) return fallback;
    try {
      const saved: unknown = JSON.parse(safeLocalStorage.getItem(key) ?? "null");
      return allowed.includes(saved as T) ? saved as T : fallback;
    } catch { return fallback; }
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  // Account hydration/switches must not write the previous account's preference.
  const value = state.key === key ? state.value : read();
  const setValue = useCallback((next: SetStateAction<T>) => {
    const resolved = typeof next === "function" ? next(value) : next;
    if (key) safeLocalStorage.setItem(key, JSON.stringify(resolved));
    setState({ key, value: resolved });
  }, [key, value]);
  return [value, setValue];
}
