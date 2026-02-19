import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeSessionStorage } from "@/utils/storage";
import { getUserTimezone } from "@/utils/timezone";

const SESSION_RETRY_DELAYS_MS = [0, 250, 750, 1500] as const;
const RESUME_REFRESH_COOLDOWN_MS = 4000;

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "recovering";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const sleep = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const sessionRef = useRef<Session | null>(null);
  const statusRef = useRef<AuthStatus>("loading");
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const signOutInFlightRef = useRef<Promise<void> | null>(null);
  const lastResumeRefreshRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applySessionState = useCallback((nextSession: Session | null, nextStatus?: AuthStatus) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setStatus(nextStatus ?? (nextSession?.user ? "authenticated" : "unauthenticated"));
  }, []);

  const saveUserTimezone = useCallback(async (userId: string) => {
    try {
      const timezone = getUserTimezone();
      await supabase.from("profiles").update({ timezone }).eq("id", userId);
    } catch (error) {
      console.error("Failed to save timezone:", error);
    }
  }, []);

  const syncAuthenticatedQueries = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["profile"] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mentor-page-data"] }),
      queryClient.invalidateQueries({ queryKey: ["mentor-personality"] }),
      queryClient.invalidateQueries({ queryKey: ["mentor"] }),
      queryClient.invalidateQueries({ queryKey: ["selected-mentor"] }),
    ]);
  }, [queryClient]);

  const clearAuthScopedState = useCallback(async () => {
    queryClient.clear();
    safeSessionStorage.removeItem("initialRouteRedirected");
    try {
      await supabase.removeAllChannels();
    } catch (error) {
      console.error("Failed to remove realtime channels:", error);
    }
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const currentSession = sessionRef.current;
    setStatus((previousStatus) => {
      if (previousStatus === "loading") return "loading";
      return "recovering";
    });

    const refreshPromise = (async () => {
      let lastError: unknown = null;
      let resolvedSession: Session | null | undefined;
      let sawSuccessfulCheck = false;

      for (let attempt = 0; attempt < SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = SESSION_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await sleep(delay);
        }

        const {
          data: { session: fetchedSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          lastError = error;
          continue;
        }

        sawSuccessfulCheck = true;
        resolvedSession = fetchedSession ?? null;

        if (fetchedSession?.user) {
          break;
        }

        if (!currentSession?.user || attempt >= SESSION_RETRY_DELAYS_MS.length - 1) {
          break;
        }
      }

      if (resolvedSession?.user) {
        applySessionState(resolvedSession, "authenticated");
        void saveUserTimezone(resolvedSession.user.id);
        return;
      }

      if (sawSuccessfulCheck) {
        applySessionState(null, "unauthenticated");
        return;
      }

      console.error("Failed to refresh session:", lastError);
      if (currentSession?.user) {
        setStatus("recovering");
        return;
      }

      applySessionState(null, "unauthenticated");
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [applySessionState, saveUserTimezone]);

  const signOut = useCallback(async () => {
    if (signOutInFlightRef.current) {
      return signOutInFlightRef.current;
    }

    const signOutPromise = (async () => {
      let signOutError: unknown = null;

      try {
        await supabase.auth.signOut();
      } catch (error) {
        signOutError = error;
      }

      await clearAuthScopedState();
      applySessionState(null, "unauthenticated");

      if (signOutError) {
        console.error("Sign out error:", signOutError);
        throw signOutError;
      }
    })().finally(() => {
      signOutInFlightRef.current = null;
    });

    signOutInFlightRef.current = signOutPromise;
    return signOutPromise;
  }, [applySessionState, clearAuthScopedState]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySessionState(nextSession, nextSession?.user ? "authenticated" : "unauthenticated");

      if (
        nextSession?.user &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")
      ) {
        void saveUserTimezone(nextSession.user.id);
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setTimeout(() => {
          void syncAuthenticatedQueries().catch((error) => {
            console.error("Auth sync refresh failed:", error);
          });
        }, 0);
      }

      if (event === "SIGNED_OUT") {
        void clearAuthScopedState();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applySessionState, clearAuthScopedState, saveUserTimezone, syncAuthenticatedQueries]);

  const refreshOnResume = useCallback(() => {
    if (statusRef.current === "loading" || statusRef.current === "unauthenticated") return;

    const now = Date.now();
    const elapsed = now - lastResumeRefreshRef.current;
    if (elapsed < RESUME_REFRESH_COOLDOWN_MS) return;

    lastResumeRefreshRef.current = now;
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupListener = async () => {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        refreshOnResume();
      });

      if (isDisposed) {
        await handle.remove();
        return;
      }

      listenerHandle = handle;
    };

    void setupListener();

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [refreshOnResume]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshOnResume();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshOnResume]);

  const loading = status === "loading" || status === "recovering";

  const value = useMemo(
    () => ({
      user,
      session,
      status,
      loading,
      signOut,
      refreshSession,
    }),
    [loading, refreshSession, session, signOut, status, user],
  );

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
