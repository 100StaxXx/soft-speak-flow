import { parseNaturalLanguage } from "../../../src/shared/naturalLanguageTaskParser.ts";
import {
  analyzeSchedulingIntent,
  shouldRouteMessageToPlanner,
  type SchedulingIntentSurface,
} from "../../../src/shared/schedulingIntent.ts";

export const shouldHandoffToPlanner = (
  message: string,
  surface: SchedulingIntentSurface,
) => {
  if (surface === "journeys") return false;

  const parsed = parseNaturalLanguage(message);
  const analysis = analyzeSchedulingIntent(message, parsed);

  return shouldRouteMessageToPlanner({
    surface,
    analysis,
    hasOpenPlannerThread: false,
  });
};
