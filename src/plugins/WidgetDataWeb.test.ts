import { describe, expect, it } from "vitest";
import type {
  WidgetDataPlugin,
  WidgetSyncDiagnostics,
  WidgetSyncProbeResult,
} from "./WidgetDataPlugin";
import { WidgetDataWeb } from "./WidgetDataWeb";

describe("WidgetDataWeb", () => {
  it("implements the WidgetDataPlugin interface", () => {
    const plugin: WidgetDataPlugin = new WidgetDataWeb();
    expect(typeof plugin.updateWidgetData).toBe("function");
    expect(typeof plugin.reloadWidget).toBe("function");
    expect(typeof plugin.getWidgetSyncDiagnostics).toBe("function");
    expect(typeof plugin.runWidgetSyncProbe).toBe("function");
  });

  it("returns stable diagnostics fields in web fallback", async () => {
    const plugin = new WidgetDataWeb();
    const diagnosticsPromise: Promise<WidgetSyncDiagnostics> = plugin.getWidgetSyncDiagnostics();
    const diagnostics = await diagnosticsPromise;

    expect(diagnostics).toEqual({
      appGroupAccessible: false,
      hasPayload: false,
      payloadDate: null,
      payloadUpdatedAt: null,
      payloadByteCount: 0,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  });

  it("returns a deterministic unsupported probe result on web", async () => {
    const plugin = new WidgetDataWeb();
    const probePromise: Promise<WidgetSyncProbeResult> = plugin.runWidgetSyncProbe();
    const probe = await probePromise;

    expect(probe.appGroupAccessible).toBe(false);
    expect(probe.writeSucceeded).toBe(false);
    expect(probe.readBackSucceeded).toBe(false);
    expect(probe.payloadByteCount).toBe(0);
    expect(probe.errorCode).toBe("UNSUPPORTED_PLATFORM");
    expect(probe.errorMessage).toMatch(/only available on native iOS/i);
    expect(new Date(probe.timestamp).toString()).not.toBe("Invalid Date");
  });
});
