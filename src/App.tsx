import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, Suspense, lazy, memo, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { TimeProvider } from "@/contexts/TimeContext";
import { EvolutionProvider } from "@/contexts/EvolutionContext";
import { XPProvider } from "@/contexts/XPContext";
import { CelebrationProvider } from "@/contexts/CelebrationContext";
import { CompanionPresenceProvider } from "@/contexts/CompanionPresenceContext";
import { CompanionMotionProvider } from "@/contexts/CompanionMotionContext";
import { DeepLinkProvider } from "@/contexts/DeepLinkContext";
import { WallpaperManifestProvider } from "@/contexts/WallpaperManifestContext";

import { useProfile } from "@/hooks/useProfile";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RealtimeSyncProvider } from "@/components/RealtimeSyncProvider";
import { GlobalEvolutionListener } from "@/components/GlobalEvolutionListener";
import { GlobalCompanionAgendaListener } from "@/components/GlobalCompanionAgendaListener";
import { InstallPWA } from "@/components/InstallPWA";
import { lockToPortrait } from "@/utils/orientationLock";
import { UpdateAvailablePrompt } from "@/components/UpdateAvailablePrompt";


import { hideSplashScreen } from "@/utils/capacitor";
import {
  initializeNativePush,
  isNativePushSupported,
  NATIVE_PUSH_RECEIVED_EVENT,
  unregisterNativePush,
} from "@/utils/nativePushNotifications";
import { logger } from "@/utils/logger";
import { WeeklyRecapProvider } from "@/contexts/WeeklyRecapContext";
import { useAppResumeRefresh } from "@/hooks/useAppResumeRefresh";
import { MainTabsKeepAlive, isMainTabPath } from "@/components/MainTabsKeepAlive";
import { BottomNav } from "@/components/BottomNav";
import { shouldShowBottomNav } from "@/utils/bottomNavVisibility";
import { ResilienceProvider } from "@/contexts/ResilienceContext";
import { ResilienceStatusBanner } from "@/components/resilience/ResilienceStatusBanner";
import { GlobalWidgetSyncBridge } from "@/components/GlobalWidgetSyncBridge";
import { GlobalCalendarSyncBridge } from "@/components/GlobalCalendarSyncBridge";
import { StoreKitProvider } from "@/providers/StoreKitProvider";
import { EVENING_REFLECTION_CANONICAL_PATH } from "@/utils/eveningReflectionNavigation";
import { useReferralSync } from "@/hooks/useReferralSync";
import { supabase } from "@/integrations/supabase/client";
import {
  PUSH_NOTIFICATIONS_INBOX_QUERY_KEY,
  PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
} from "@/hooks/usePushNotificationsInbox";
import { normalizePushNotificationNavigationDetail } from "@/utils/pushNotificationNavigation";
import { MentorConnectionProvider } from "@/contexts/MentorConnectionContext";
import { TalkPopupProvider } from "@/contexts/TalkPopupContext";
import { ProductExperienceAnalyticsBridge } from "@/hooks/useProductExperienceAnalytics";
import {
  PostOnboardingMentorGuidanceProvider,
  usePostOnboardingMentorGuidance,
} from "@/hooks/usePostOnboardingMentorGuidance";
import { MentorGuidanceCard } from "@/components/MentorGuidanceCard";
import { MentorSpotlightGuard } from "@/components/tutorial/MentorSpotlightGuard";
import { OnboardingExperienceGate } from "@/components/OnboardingExperienceGate";
import { PRODUCT } from "@/config/product";

// Lazy load pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const CalendarOAuthCallback = lazy(() => import("./pages/CalendarOAuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Welcome = lazy(() => import("./pages/Welcome"));

const Profile = PRODUCT.mode === "cosmiq"
  ? lazy(() => import("./pages/Profile"))
  : lazy(() => import("./pages/ChristianProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess"));
const AccountDeletionHelp = lazy(() => import("./pages/AccountDeletionHelp"));
const Recaps = lazy(() => import("./pages/Recaps"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const SupportReport = lazy(() => import("./pages/SupportReport"));
const MentorSelection = lazy(() => import("./pages/MentorSelection"));
const MentorChat = lazy(() => import("./pages/MentorChat"));
const PepTalkDetail = lazy(() => import("./pages/PepTalkDetail"));
const EncouragementHistory = lazy(() => import("./pages/EncouragementHistory"));
const AccessibilityPreview = import.meta.env.DEV
  ? lazy(() => import("./pages/AccessibilityPreview"))
  : null;


// Create query client outside component for better performance and stability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch on tab switch - saves API calls
      refetchOnReconnect: true, // Refetch on reconnect
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Prefetch critical routes during idle time for instant navigation
const prefetchCriticalRoutes = () => {
  const routes = [
    PRODUCT.mode === "cosmiq"
      ? () => import('./pages/Profile')
      : () => import('./pages/ChristianProfile'),
    () => import('./pages/Today'),
  ];
  routes.forEach(route => route());
};

const scheduleCriticalRoutePrefetch = () => {
  const runWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchCriticalRoutes, { timeout: 3000 });
    } else {
      setTimeout(prefetchCriticalRoutes, 1500);
    }
  };

  if (Capacitor.isNativePlatform()) {
    setTimeout(runWhenIdle, 8000);
    return;
  }

  runWhenIdle();
};

// Run prefetch when browser is idle
if (typeof window !== 'undefined') {
  scheduleCriticalRoutePrefetch();
}

// Memoized loading fallback to prevent recreation
const LoadingFallback = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
));

LoadingFallback.displayName = 'LoadingFallback';

const RootRoute = memo(() => {
  const { user, loading, status } = useAuth();
  const authStatus = status ?? (loading ? 'loading' : user ? 'authenticated' : 'unauthenticated');

  if (!user || authStatus === 'unauthenticated') {
    return <Welcome />;
  }

  return <Navigate to={PRODUCT.mode === "cosmiq" ? "/journeys" : "/companion"} replace />;
});

RootRoute.displayName = "RootRoute";

// Memoized scroll to top component
const ScrollToTop = memo(() => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isMainTabPath(pathname)) {
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});

ScrollToTop.displayName = 'ScrollToTop';

const MentorTutorialLayer = memo(() => {
  const { isActive, activeTargetSelector, activeTargetSelectors = [], isStrictLockActive } =
    usePostOnboardingMentorGuidance();
  const hasResolvedSpotlightTarget = Boolean(
    isActive && activeTargetSelector && activeTargetSelectors.length > 0,
  );

  return (
    <>
      <MentorSpotlightGuard
        active={hasResolvedSpotlightTarget}
        mode={isStrictLockActive ? "spotlight" : "outline"}
        targetSelector={activeTargetSelector}
      />
      <MentorGuidanceCard />
    </>
  );
});

MentorTutorialLayer.displayName = "MentorTutorialLayer";

const DEFAULT_SONNER_BOTTOM_OFFSET = "calc(env(safe-area-inset-bottom, 0px) + 16px)";
const BOTTOM_NAV_SONNER_BOTTOM_OFFSET = "calc(var(--bottom-nav-runtime-offset, var(--bottom-nav-safe-offset)) + 12px)";
const SPLASH_HIDE_READY_DELAY_MS = 100;
const SPLASH_HIDE_WATCHDOG_MS = 3500;

const DailyWayThemeProvider = memo(({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider mentorId={null}>
      {children}
    </ThemeProvider>
  );
});

DailyWayThemeProvider.displayName = "DailyWayThemeProvider";

const AppContent = memo(() => {
  const { profile, loading: profileLoading } = useProfile();
  const { session, status } = useAuth();
  const [splashHidden, setSplashHidden] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const previousPushUserIdRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useReferralSync();
  
  // Refresh critical data on app resume (iOS/Android) or tab visibility (web)
  useAppResumeRefresh({ enabled: status === "authenticated" && Boolean(session?.user) });

  const hideNativeSplashOnce = useCallback(() => {
    if (splashHidden) return;

    setSplashHidden(true);
    void hideSplashScreen();
  }, [splashHidden]);
  
  // Handle password recovery tokens BEFORE routes render - prevents paywall from blocking reset
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && !location.pathname.includes('/auth/reset-password')) {
      // Redirect to reset password page, preserving the hash fragment
      navigate(`/auth/reset-password${hash}`, { replace: true });
    }
    setRecoveryChecked(true);
  }, [location.pathname, navigate]);
  
  // Respond to native push navigation events
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = normalizePushNotificationNavigationDetail((event as CustomEvent<unknown>).detail);
      if (!detail) return;

      if (detail.queueId) {
        void (async () => {
          try {
            const { error } = await supabase.rpc("mark_push_notification_opened", {
              p_queue_id: detail.queueId,
            });
            if (error) {
              logger.warn("Failed to mark native push notification opened", { error: error.message });
            }
          } finally {
            void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_INBOX_QUERY_KEY] });
            void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
          }
        })();
      }

      navigate(detail.url);
    };
    window.addEventListener('native-push-navigation', handler as EventListener);
    return () => window.removeEventListener('native-push-navigation', handler as EventListener);
  }, [navigate, queryClient]);

  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_INBOX_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
    };

    window.addEventListener(NATIVE_PUSH_RECEIVED_EVENT, handler);
    return () => window.removeEventListener(NATIVE_PUSH_RECEIVED_EVENT, handler);
  }, [queryClient]);
  
  // Respond to deep link navigation events (from widget taps)
  useEffect(() => {
    const handler = (event: Event) => {
      const { path } = (event as CustomEvent<{ path?: string }>).detail ?? {};
      if (path) {
        navigate(path);
      }
    };
    window.addEventListener('deep-link-navigation', handler as EventListener);
    return () => window.removeEventListener('deep-link-navigation', handler as EventListener);
  }, [navigate]);

  
  const pushUserId = session?.user?.id ?? null;

  // Initialize native push for the current user and clean up on account changes/sign-out.
  useEffect(() => {
    let cancelled = false;

    const syncNativePush = async () => {
      const previousUserId = previousPushUserIdRef.current;

      try {
        if (!isNativePushSupported()) {
          if (!cancelled) {
            previousPushUserIdRef.current = pushUserId;
          }
          return;
        }

        if (previousUserId && previousUserId !== pushUserId) {
          await unregisterNativePush(previousUserId).catch((err) => {
            logger.error('Failed to unregister native push for previous user:', err);
          });
        }

        if (pushUserId) {
          await initializeNativePush(pushUserId).catch((err) => {
            logger.error('Failed to initialize native push:', err);
          });
        }
      } catch (error) {
        logger.log('Native push synchronization skipped:', error);
      } finally {
        if (!cancelled) {
          previousPushUserIdRef.current = pushUserId;
        }
      }
    };

    void syncNativePush();

    return () => {
      cancelled = true;
    };
  }, [pushUserId]);
  
  // Hide splash screen once startup data is ready, with a watchdog so iOS never
  // leaves the WebView covered if a network request stalls during launch.
  useEffect(() => {
    const canHideSplash =
      recoveryChecked &&
      status !== "loading" &&
      (!session?.user || !profileLoading);

    if (!canHideSplash || splashHidden) {
      return undefined;
    }

    const timer = window.setTimeout(hideNativeSplashOnce, SPLASH_HIDE_READY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hideNativeSplashOnce, profileLoading, recoveryChecked, session?.user, splashHidden, status]);

  useEffect(() => {
    if (splashHidden) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      logger.warn("Native splash watchdog elapsed before startup data finished loading", {
        hasSession: Boolean(session?.user),
        profileLoading,
        status,
      });
      hideNativeSplashOnce();
    }, SPLASH_HIDE_WATCHDOG_MS);

    return () => window.clearTimeout(timer);
  }, [hideNativeSplashOnce, profileLoading, session?.user, splashHidden, status]);

  const activeMainTabPath = isMainTabPath(location.pathname) ? location.pathname : null;
  const showBottomNav = shouldShowBottomNav(location.pathname, Boolean(session?.user));

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      "--sonner-bottom-offset",
      showBottomNav ? BOTTOM_NAV_SONNER_BOTTOM_OFFSET : DEFAULT_SONNER_BOTTOM_OFFSET,
    );

    return () => {
      rootStyle.removeProperty("--sonner-bottom-offset");
    };
  }, [showBottomNav]);

  // Block route rendering until recovery check is complete - prevents paywall flash
  if (!recoveryChecked && window.location.hash.includes('type=recovery')) {
    return <LoadingFallback />;
  }

  return (
    <ResilienceProvider>
        <DailyWayThemeProvider>
          <WallpaperManifestProvider
            enabled={Boolean(session?.user) && PRODUCT.mode === "christian"}
            userTimezone={profile?.timezone ?? null}
          >
            <ResilienceStatusBanner />
            <ViewModeProvider>
              <CompanionMotionProvider>
                <TalkPopupProvider>
                  <XPProvider>
                    <GlobalWidgetSyncBridge enabled={Boolean(session?.user)} />
                    <GlobalCalendarSyncBridge enabled={Boolean(session?.user)} />
                    {session?.user ? <ProductExperienceAnalyticsBridge /> : null}
                    <PostOnboardingMentorGuidanceProvider>
                      <WeeklyRecapProvider>
                        <CompanionPresenceProvider>
                          <RealtimeSyncProvider>
                            <OnboardingExperienceGate>
                            <Suspense fallback={<LoadingFallback />}>
                          <GlobalEvolutionListener />
                          <GlobalCompanionAgendaListener />
                          {activeMainTabPath ? (
                            <ProtectedRoute>
                              <MainTabsKeepAlive activePath={activeMainTabPath} />
                            </ProtectedRoute>
                          ) : (
                          <AnimatePresence mode="sync" initial={false}>
                            <Routes location={location} key={location.pathname}>
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/calendar/oauth/callback" element={<CalendarOAuthCallback />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/creator" element={<Navigate to="/welcome" replace />} />
                  <Route path="/creator/dashboard" element={<Navigate to="/welcome" replace />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/" element={<RootRoute />} />
                  <Route path="/today" element={<Navigate to="/mentor" replace />} />
                  <Route path="/plan" element={<Navigate to="/mentor" replace />} />
                  <Route path="/grow" element={<Navigate to="/companion" replace />} />
                  <Route path="/garden" element={<Navigate to="/companion" replace />} />
                  <Route path="/journeys" element={<Navigate to={PRODUCT.mode === "cosmiq" ? "/journeys" : "/companion"} replace />} />
                  <Route path="/campaigns" element={<Navigate to="/mentor" replace />} />
                  <Route path="/advanced-planner" element={<Navigate to="/mentor" replace />} />
                  
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/premium" element={<Navigate to="/" replace />} />
                  <Route path="/premium/success" element={<ProtectedRoute requireAccess={false}><PremiumSuccess /></ProtectedRoute>} />
                  <Route path="/pep-talk/:id" element={<ProtectedRoute><PepTalkDetail /></ProtectedRoute>} />
                  <Route path="/encouragements" element={<ProtectedRoute><EncouragementHistory /></ProtectedRoute>} />
                  <Route path="/mentor-selection" element={<ProtectedRoute><MentorSelection /></ProtectedRoute>} />
                  <Route path="/admin" element={<Navigate to="/profile" replace />} />
                  <Route path="/tasks" element={<Navigate to="/mentor" replace />} />
                  <Route path="/epics" element={<Navigate to="/mentor" replace />} />
                  <Route path="/join/:code" element={<Navigate to="/mentor" replace />} />
                  <Route path="/shared-epics" element={<Navigate to="/mentor" replace />} />
                  <Route path="/mentor-chat" element={<ProtectedRoute><MentorConnectionProvider><MentorChat /></MentorConnectionProvider></ProtectedRoute>} />
                  <Route path="/horoscope" element={<Navigate to="/mentor" replace />} />
                  <Route path="/cosmic/:placement/:sign" element={<Navigate to="/mentor" replace />} />
                  <Route path="/challenges" element={<Navigate to="/companion" replace />} />
                  <Route path="/reflection" element={<Navigate to={EVENING_REFLECTION_CANONICAL_PATH} replace />} />
                  <Route path="/library" element={<Navigate to="/mentor" replace />} />
                  <Route path="/pep-talks" element={<Navigate to="/guide#daily-encouragement" replace />} />
                  <Route path="/inspire" element={<Navigate to="/guide#daily-encouragement" replace />} />
                  <Route path="/search" element={<Navigate to="/mentor" replace />} />
                  <Route path="/partners" element={<Navigate to="/welcome" replace />} />
                  <Route path="/account-deletion" element={<AccountDeletionHelp />} />
                  <Route path="/recaps" element={<ProtectedRoute><Recaps /></ProtectedRoute>} />
                  <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
                  <Route path="/inbox" element={<Navigate to="/mentor" replace />} />
                  <Route path="/contacts" element={<Navigate to="/profile" replace />} />
                  <Route path="/iap-test" element={<Navigate to="/profile" replace />} />
                  <Route path="/support/report" element={<ProtectedRoute requireAccess={false}><SupportReport /></ProtectedRoute>} />
                  <Route path="/guilds" element={<Navigate to="/companion" replace />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  {AccessibilityPreview ? (
                    <Route path="/accessibility-preview/:screen" element={<AccessibilityPreview />} />
                  ) : null}
                  <Route path="/test-scroll" element={<Navigate to="/mentor" replace />} />
                  <Route path="/test-day-planner" element={<Navigate to="/mentor" replace />} />
                  <Route path="*" element={<NotFound />} />
                            </Routes>
                            </AnimatePresence>
                          )}
                          {showBottomNav && <BottomNav />}
                          <MentorTutorialLayer />
                          </Suspense>
                            </OnboardingExperienceGate>
                          </RealtimeSyncProvider>
                        </CompanionPresenceProvider>
                      </WeeklyRecapProvider>
                    </PostOnboardingMentorGuidanceProvider>
                  </XPProvider>
                </TalkPopupProvider>
              </CompanionMotionProvider>
            </ViewModeProvider>
          </WallpaperManifestProvider>
        </DailyWayThemeProvider>
    </ResilienceProvider>
  );
});

AppContent.displayName = 'AppContent';

const App = () => {
  useEffect(() => {
    // Lock orientation to portrait on native apps
    lockToPortrait();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StoreKitProvider>
            <TimeProvider>
              <EvolutionProvider>
                <CelebrationProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <InstallPWA />
                    <UpdateAvailablePrompt />
                    <BrowserRouter>
                      <MentorConnectionProvider>
                        <DeepLinkProvider>
                          <ScrollToTop />
                          <AppContent />
                        </DeepLinkProvider>
                      </MentorConnectionProvider>
                    </BrowserRouter>
                  </TooltipProvider>
                </CelebrationProvider>
              </EvolutionProvider>
            </TimeProvider>
          </StoreKitProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
