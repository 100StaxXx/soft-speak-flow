export const JOURNEYS_ROUTE = "/journeys";
export const JOURNEYS_RESET_TO_TODAY_EVENT = "journeys:reset-to-today";

export const dispatchJourneysResetToToday = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new window.Event(JOURNEYS_RESET_TO_TODAY_EVENT));
};
