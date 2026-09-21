import { registerPlugin } from '@capacitor/core';
import type { WidgetDataPlugin } from "./WidgetDataTypes";

export type {
  WidgetDataPlugin,
  WidgetSyncDiagnostics,
  WidgetSyncProbeResult,
  WidgetTask,
} from "./WidgetDataTypes";

export const WidgetData = registerPlugin<WidgetDataPlugin>('WidgetData', {
  web: () => import('./WidgetDataWeb').then(m => new m.WidgetDataWeb()),
});
