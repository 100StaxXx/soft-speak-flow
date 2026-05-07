import { buildAPNSNotificationBody } from "./apns.ts";

Deno.test("APNs body includes computed badge count when provided", () => {
  const body = buildAPNSNotificationBody({
    title: "Cosmiq",
    body: "Quest soon",
    badge: 3,
    data: {
      queue_id: "queue-1",
      url: "/journeys?taskId=task-1",
    },
  }) as {
    aps?: { badge?: number };
    queue_id?: string;
    url?: string;
  };

  if (body.aps?.badge !== 3) {
    throw new Error(`Expected APNs badge count 3, got ${JSON.stringify(body)}`);
  }

  if (body.queue_id !== "queue-1" || body.url !== "/journeys?taskId=task-1") {
    throw new Error(`Expected APNs custom data to be preserved, got ${JSON.stringify(body)}`);
  }
});

Deno.test("APNs body omits badge when no count is supplied", () => {
  const body = buildAPNSNotificationBody({
    title: "Cosmiq",
    body: "Quest soon",
  }) as { aps?: { badge?: number } };

  if (body.aps?.badge !== undefined) {
    throw new Error(`Expected APNs badge to be omitted, got ${JSON.stringify(body)}`);
  }
});
