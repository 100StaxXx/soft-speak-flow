/**
 * Native Push Notification Service for iOS
 * Uses Capacitor Push Notifications Plugin
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { isNativeIOSHandheld } from '@/utils/platformTargets';
import { safeLocalStorage } from '@/utils/storage';
import { toast } from '@/components/ui/sonner';
import {
  buildPushNotificationNavigationDetail,
  type PushNotificationNavigationDetail,
} from "@/utils/pushNotificationNavigation";

let currentPushUserId: string | null = null;
let initializedUserId: string | null = null;
let initializationPromise: Promise<void> | null = null;
let listenerHandles: PluginListenerHandle[] = [];
let listenersBound = false;
const PUSH_INSTALLATION_ID_STORAGE_KEY = 'native_push_installation_id';
const FOREGROUND_PUSH_TOAST_DEDUPE_MS = 10_000;
const foregroundPushToastShownAt = new Map<string, number>();
export const NATIVE_PUSH_RECEIVED_EVENT = 'native-push-received';

interface PushDeviceTokenRow {
  id: string;
  device_token: string;
  installation_id: string | null;
}

export interface NativePushTokenDebugSnapshot {
  tokenCount: number;
  installationCount: number;
  legacyTokenCount: number;
  latestUpdatedAt: string | null;
  latestTokenPreview: string | null;
  currentInstallationIdPreview: string | null;
}

export interface ClaimPushDeviceTokenArgs {
  p_installation_id: string;
  p_device_token: string;
  p_platform: 'ios';
  p_user_agent: string | null;
}

interface ForegroundPushNotificationInput {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
}

export interface ForegroundPushToastDetails {
  title: string;
  description?: string;
  url?: string;
  queueId?: string | null;
  dedupeKey: string;
}

function readPushInstallationId(): string | null {
  const value = safeLocalStorage.getItem(PUSH_INSTALLATION_ID_STORAGE_KEY);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function generatePushInstallationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePushInstallationId(): string {
  const existing = readPushInstallationId();
  if (existing) {
    return existing;
  }

  const generated = generatePushInstallationId();
  safeLocalStorage.setItem(PUSH_INSTALLATION_ID_STORAGE_KEY, generated);
  return generated;
}

function previewValue(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pruneForegroundPushToastHistory(now: number): void {
  foregroundPushToastShownAt.forEach((seenAt, key) => {
    if (now - seenAt >= FOREGROUND_PUSH_TOAST_DEDUPE_MS) {
      foregroundPushToastShownAt.delete(key);
    }
  });
}

export function buildForegroundPushToast(
  notification: ForegroundPushNotificationInput,
): ForegroundPushToastDetails | null {
  const data = isRecord(notification.data) ? notification.data : {};
  const aps = isRecord(data.aps) ? data.aps : {};
  const alert = isRecord(aps.alert) ? aps.alert : {};

  const title =
    readNonEmptyString(notification.title) ??
    readNonEmptyString(data.title) ??
    readNonEmptyString(alert.title);
  const description =
    readNonEmptyString(notification.body) ??
    readNonEmptyString(data.body) ??
    readNonEmptyString(data.message) ??
    readNonEmptyString(alert.body);

  if (!title && !description) {
    return null;
  }

  const type = readNonEmptyString(data.type);
  const navigationDetail = buildPushNotificationNavigationDetail(data, type);
  const url = navigationDetail.url;
  const stableId =
    readNonEmptyString(notification.id) ??
    readNonEmptyString(data.queue_id) ??
    readNonEmptyString(data.notification_id) ??
    readNonEmptyString(data.nudge_id) ??
    readNonEmptyString(data.pep_talk_id);
  const dedupeKey =
    stableId !== null
      ? `${type ?? 'push'}:${stableId}`
      : [type, title, description, url].filter(Boolean).join('|');

  return {
    title: title ?? 'Notification',
    description: description ?? undefined,
    url,
    queueId: navigationDetail.queueId,
    dedupeKey,
  };
}

function dispatchNativePushNavigation(detail: PushNotificationNavigationDetail): void {
  window.dispatchEvent(new CustomEvent('native-push-navigation', { detail }));
}

export function dispatchNativePushReceived(notification: ForegroundPushNotificationInput): void {
  const data = isRecord(notification.data) ? notification.data : {};
  window.dispatchEvent(new CustomEvent(NATIVE_PUSH_RECEIVED_EVENT, {
    detail: buildPushNotificationNavigationDetail(data, readNonEmptyString(data.type)),
  }));
}

export function showForegroundPushNotificationToast(
  notification: ForegroundPushNotificationInput,
  now = Date.now(),
): boolean {
  const toastDetails = buildForegroundPushToast(notification);
  if (!toastDetails) return false;

  pruneForegroundPushToastHistory(now);

  const lastSeenAt = foregroundPushToastShownAt.get(toastDetails.dedupeKey);
  if (lastSeenAt !== undefined && now - lastSeenAt < FOREGROUND_PUSH_TOAST_DEDUPE_MS) {
    return false;
  }

  foregroundPushToastShownAt.set(toastDetails.dedupeKey, now);

  toast(toastDetails.title, {
    id: `foreground-push:${toastDetails.dedupeKey}`,
    description: toastDetails.description,
    action: toastDetails.url
      ? {
          label: 'Open',
          onClick: () => {
            dispatchNativePushNavigation({
              url: toastDetails.url!,
              queueId: toastDetails.queueId,
            });
          },
        }
      : undefined,
  });

  return true;
}

export function buildPushDeviceTokenClaimArgs(input: {
  installationId: string;
  deviceToken: string;
  userAgent?: string | null;
}): ClaimPushDeviceTokenArgs {
  return {
    p_installation_id: input.installationId.trim(),
    p_device_token: input.deviceToken.trim(),
    p_platform: 'ios',
    p_user_agent: input.userAgent?.trim() || null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Check if native push notifications are supported
 */
export function isNativePushSupported(): boolean {
  try {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const isSupported = isNativeIOSHandheld();
    
    // Log for debugging in Xcode console
    console.log('[NativePush] Platform check:', { isNative, platform, isSupported });
    logger.info('[NativePush] Platform check:', { isNative, platform, isSupported });
    
    return isSupported;
  } catch (error) {
    console.log('[NativePush] Platform check error:', error);
    logger.info('Native push not available:', error);
    return false;
  }
}

/**
 * Get current permission status
 */
export async function getPermissionStatus(): Promise<string> {
  if (!isNativePushSupported()) {
    return 'not_supported';
  }
  
  try {
    const status = await PushNotifications.checkPermissions();
    console.log('[NativePush] Permission status:', status.receive);
    return status.receive;
  } catch (error) {
    console.log('[NativePush] Error checking permissions:', error);
    return 'unknown';
  }
}

async function bindPushListenersOnce(): Promise<void> {
  if (listenersBound) return;

  const handles: PluginListenerHandle[] = [];

  handles.push(await PushNotifications.addListener('registration', async (token) => {
    console.log('[NativePush] ✅ REGISTRATION SUCCESS');
    console.log('[NativePush] Device token received');
    logger.log('Push registration success');

    if (!currentPushUserId) {
      console.log('[NativePush] Skipping token save because no active user is set');
      return;
    }

    try {
      await saveDeviceToken(currentPushUserId, token.value);
      console.log('[NativePush] Token saved to database successfully');
    } catch (saveError) {
      console.log('[NativePush] ❌ Failed to save token:', saveError);
    }
  }));

  handles.push(await PushNotifications.addListener('registrationError', (error) => {
    console.log('[NativePush] ❌ REGISTRATION ERROR');
    console.log('[NativePush] Error details:', JSON.stringify(error));
    logger.error('Push registration error:', error);
  }));

  handles.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[NativePush] Notification received:', notification);
    logger.log('Push notification received:', notification);
    dispatchNativePushReceived(notification);
    showForegroundPushNotificationToast(notification);
  }));

  handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('[NativePush] Notification action performed:', notification);
    logger.log('Push notification action performed:', notification);
    const data = notification.notification.data;
    dispatchNativePushNavigation(
      buildPushNotificationNavigationDetail(data, readNonEmptyString(data?.type)),
    );
  }));

  listenerHandles = handles;
  listenersBound = true;
}

async function removePushListeners(): Promise<void> {
  if (listenerHandles.length === 0) return;

  const handles = listenerHandles;
  listenerHandles = [];
  listenersBound = false;

  for (const handle of handles) {
    try {
      await handle.remove();
    } catch (error) {
      console.log('[NativePush] Error removing listener:', error);
    }
  }
}

/**
 * Initialize native push notifications
 */
export async function initializeNativePush(userId: string): Promise<void> {
  console.log('[NativePush] ========== INIT START ==========');
  console.log('[NativePush] User ID:', userId);

  currentPushUserId = userId;
  
  if (!isNativePushSupported()) {
    console.log('[NativePush] Not supported on this platform, aborting');
    logger.info('Native push not supported on this platform');
    return;
  }

  if (initializedUserId === userId && listenersBound) {
    console.log('[NativePush] Already initialized for current user, refreshing APNs registration');
    await PushNotifications.register();
    return;
  }

  if (initializationPromise) {
    console.log('[NativePush] Initialization already in progress, waiting...');
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    try {
      console.log('[NativePush] Step 1: Requesting permissions...');

      const permission = await PushNotifications.requestPermissions();

      console.log('[NativePush] Permission result:', permission);
      console.log('[NativePush] Permission receive status:', permission.receive);

      if (permission.receive !== 'granted') {
        console.log('[NativePush] Permission DENIED - user did not grant access');
        logger.log('Push notification permission denied');
        throw new Error('Push notification permission denied. Please enable in Settings.');
      }

      console.log('[NativePush] Step 2: Binding listeners...');
      await bindPushListenersOnce();

      console.log('[NativePush] Step 3: Registering with APNs...');
      await PushNotifications.register();

      initializedUserId = userId;
      console.log('[NativePush] ========== INIT COMPLETE ==========');
    } catch (error) {
      console.log('[NativePush] ❌ INIT FAILED');
      console.log('[NativePush] Error:', error);
      logger.error('Error initializing native push:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  await initializationPromise;
}

/**
 * Return token inventory details for on-device diagnostics.
 */
export async function getNativePushTokenDebugSnapshot(userId: string): Promise<NativePushTokenDebugSnapshot> {
  try {
    const currentInstallationId = getOrCreatePushInstallationId();
    const { data, error } = await supabase
      .from('push_device_tokens')
      .select('device_token,updated_at,installation_id')
      .eq('user_id', userId)
      .eq('platform', 'ios')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const tokens = data ?? [];
    const latest = tokens[0];
    const installationIds = new Set(
      tokens
        .map((row) => row.installation_id?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    const legacyTokenCount = tokens.filter((row) => !row.installation_id?.trim()).length;

    return {
      tokenCount: tokens.length,
      installationCount: installationIds.size,
      legacyTokenCount,
      latestUpdatedAt: latest?.updated_at ?? null,
      latestTokenPreview: previewValue(latest?.device_token ?? null),
      currentInstallationIdPreview: previewValue(currentInstallationId),
    };
  } catch (error) {
    console.log('[NativePush] Failed to load token snapshot:', error);
    return {
      tokenCount: 0,
      installationCount: 0,
      legacyTokenCount: 0,
      latestUpdatedAt: null,
      latestTokenPreview: null,
      currentInstallationIdPreview: previewValue(readPushInstallationId()),
    };
  }
}

export async function waitForNativePushToken(
  userId: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<boolean> {
  const timeoutMs = Math.max(250, options?.timeoutMs ?? 5000);
  const pollMs = Math.max(100, options?.pollMs ?? 250);
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (await hasActiveNativePushSubscription(userId)) {
      return true;
    }

    await delay(pollMs);
  }

  return false;
}

/**
 * Save device token to database
 */
export async function saveDeviceTokenForInstallation(
  userId: string,
  deviceToken: string,
  installationId = getOrCreatePushInstallationId(),
): Promise<void> {
  console.log('[NativePush] Saving token to database...');
  console.log('[NativePush] User:', userId);
  console.log('[NativePush] Token (first 20 chars):', deviceToken.substring(0, 20) + '...');
  
  try {
    const claimArgs = buildPushDeviceTokenClaimArgs({
      installationId,
      deviceToken,
      userAgent: navigator.userAgent,
    });
    const { error } = await supabase.rpc('claim_push_device_token', claimArgs);

    if (error) {
      console.log('[NativePush] Database error:', error);
      logger.error('Error saving device token:', error);
      throw error;
    }

    console.log('[NativePush] ✅ Device token saved successfully');
    logger.log('Device token saved successfully');
  } catch (error) {
    console.log('[NativePush] ❌ Error saving device token:', error);
    logger.error('Error saving device token:', error);
    throw error;
  }
}

async function saveDeviceToken(userId: string, deviceToken: string): Promise<void> {
  await saveDeviceTokenForInstallation(userId, deviceToken);
}

/**
 * Unregister from push notifications
 */
export async function unregisterNativePush(userId: string): Promise<void> {
  console.log('[NativePush] Unregistering...');
  
  if (!isNativePushSupported()) {
    return;
  }

  try {
    if (initializationPromise) {
      try {
        await initializationPromise;
      } catch {
        // Keep going so we can still clean up listeners/token rows.
      }
    }

    await removePushListeners();
    
    // Get current device token before unregistering
    const deliveredNotifications = await PushNotifications.getDeliveredNotifications();
    console.log('[NativePush] Delivered notifications:', deliveredNotifications);

    const installationId = getOrCreatePushInstallationId();

    // Delete device token from database
    const { error } = await supabase
      .from('push_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'ios')
      .eq('installation_id', installationId);

    if (error) {
      console.log('[NativePush] Error deleting token:', error);
      logger.error('Error deleting device token:', error);
    } else {
      console.log('[NativePush] Token deleted from database');
    }

    if (initializedUserId === userId) {
      initializedUserId = null;
    }
    if (currentPushUserId === userId) {
      currentPushUserId = null;
    }

  } catch (error) {
    console.log('[NativePush] Unregister error:', error);
    logger.error('Error unregistering from push:', error);
    throw error;
  }
}

/**
 * Check if user has active native push subscription
 */
export async function hasActiveNativePushSubscription(userId: string): Promise<boolean> {
  try {
    const installationId = getOrCreatePushInstallationId();
    const { data, error } = await supabase
      .from('push_device_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'ios')
      .eq('installation_id', installationId)
      .limit(1);

    if (error) throw error;
    const hasSubscription = (data?.length || 0) > 0;
    console.log('[NativePush] Has active subscription:', hasSubscription);
    return hasSubscription;
  } catch (error) {
    console.log('[NativePush] Error checking subscription:', error);
    logger.error('Error checking native push subscription:', error);
    return false;
  }
}

/**
 * Debug function to manually test registration
 */
export async function debugTestRegistration(_userId: string): Promise<{
  platform: string;
  isNative: boolean;
  isSupported: boolean;
  permissionStatus: string;
  error?: string;
}> {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const isSupported = isNativePushSupported();
  
  let permissionStatus = 'unknown';
  let error: string | undefined;
  
  try {
    if (isSupported) {
      const status = await PushNotifications.checkPermissions();
      permissionStatus = status.receive;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  
  const result = {
    platform,
    isNative,
    isSupported,
    permissionStatus,
    error
  };
  
  console.log('[NativePush] Debug info:', result);
  return result;
}
