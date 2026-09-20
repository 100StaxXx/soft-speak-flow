import test from "node:test";
import assert from "node:assert/strict";
import { validateScopedRelease } from "./validate-scoped-release.mjs";
const live = [{ slug: "companion-wellbeing-video", version: 1, status: "ACTIVE" }];
test("cinema release requires the explicitly reconciled live version", () => {
  const cinema = [{ slug: "process-companion-cinema-event", version: 22, status: "ACTIVE" }];
  assert.deepEqual(validateScopedRelease({ "process-companion-cinema-event": 22 }, cinema), ["process-companion-cinema-event"]);
  assert.throws(() => validateScopedRelease({ "process-companion-cinema-event": 21 }, cinema));
});
test("deploys only the reviewed function at the reviewed live version", () => {
  assert.deepEqual(validateScopedRelease({ "companion-wellbeing-video": 1 }, live), ["companion-wellbeing-video"]);
});
test("refuses newer remote code, unknown functions and malformed scopes", () => {
  for (const expected of [{}, [], null, { "companion-wellbeing-video": 0 }, { "companion-wellbeing-video": "1" }, { "google-calendar-auth": 69 }]) assert.throws(() => validateScopedRelease(expected, live));
});
test("new functions require an explicit zero and a missing live entry", () => {
  assert.deepEqual(validateScopedRelease({ "companion-wellbeing-video": 0 }, []), ["companion-wellbeing-video"]);
  assert.throws(() => validateScopedRelease({ "companion-wellbeing-video": 1 }, []));
});
test("refuses unhealthy or ambiguous live inventory", () => {
  assert.throws(() => validateScopedRelease({ "companion-wellbeing-video": 1 }, [...live, ...live]));
  assert.throws(() => validateScopedRelease({ "companion-wellbeing-video": 1 }, [{ ...live[0], status: "REMOVED" }]));
});
