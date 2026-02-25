export type ResilienceState = "healthy" | "offline" | "degraded" | "outage" | "recovering" | "recovered";

export type BackendHealthState = "unknown" | "healthy" | "degraded" | "outage";

export type QueuedActionStatus = "queued" | "syncing" | "synced" | "failed" | "dropped";

export interface QueuedActionReceipt {
  id: string;
  actionKind: string;
  entityType: string;
  entityId: string | null;
  status: QueuedActionStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SupportReportDiagnostics {
  appVersion: string;
  platform: string;
  route: string;
  authState: "authenticated" | "unauthenticated";
  connectivity: {
    isOnline: boolean;
    resilienceState: ResilienceState;
    backendHealth: BackendHealthState;
  };
  queueDepth: number;
  recentErrorFingerprints: string[];
  userAgent: string;
  capturedAt: string;
}

export interface SupportReportPayload {
  correlationId: string;
  category: "bug" | "billing" | "sync" | "performance" | "other";
  summary: string;
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  screenshotDataUrl?: string;
  consentDiagnostics: boolean;
  diagnostics: SupportReportDiagnostics;
}
