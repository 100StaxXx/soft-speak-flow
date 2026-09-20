# Cosmiq / Graceward notification separation — 2026-09-19

## Confirmed cause
The live shared notification composer used Graceward templates without checking account product. Cosmiq accounts were queued the exact screenshot copy: “Release the day” / “Notice grace, name what was hard, and rest in God’s care.”

## Implemented
- Both scheduling and delivery resolve the trusted account product. Auth app metadata wins, then the existing companion/profile bindings; unbound pre-split accounts remain Cosmiq. Lookup failures never silently select a brand.
- Cosmiq receives secular companion/quest/habit/evening templates; Graceward retains its Guide and faith-based templates.
- Delivery rebuilds product-sensitive templates for previously queued reminders. It preserves user-authored tasks/habits and source-specific quote/planner notifications.
- Payload product tags cannot choose the template; the verified account product is authoritative.
- Apple push topics now use the matching bundle ID: Cosmiq `com.darrylgraham.revolution`, Graceward `com.darrylgraham.graceward`. Both Xcode projects use the same developer team. Non-dispatch callers retain the prior configuration behavior.
- Source updated in both product repositories. Existing Graceward consent/timing/expiry changes were preserved locally, not silently included in this deployment.

## Release scope
Only `notifications-enqueue-v2` and `notifications-dispatch-v2` deployed to shared project `opbfpbbqvuksuvmtmssd`, from fresh live snapshots plus this scoped patch. No calendar, authentication, subscription, app binary, database migration, or unrelated Graceward changes deployed. No test push sent, queue history deleted, or old failed notifications resent.

## Validation
- 65 focused tests pass in each product repository (22 product-isolation cases plus existing scheduling/delivery tests).
- Both notification entrypoints typecheck in the isolated deployment workspaces and product repositories.
- Live source readback matches release files.
- Both endpoints reject unauthenticated POST with HTTP 401 / missing internal key.
- Queue audit during rollout: no pending wrong-brand Cosmiq reminders; one correctly worded Graceward evening reminder. No manual queue rewrite was necessary.
- A naturally scheduled new Cosmiq row uses “Evening reflection reminder” and `product_mode=cosmiq`. That account had no device token, so this establishes scheduler correctness, not successful phone delivery.
- Physical receipt on both iOS apps remains to be confirmed. Apple key permissions for both topics are not verified by a real push in this task.
- Already displayed phone notifications cannot be recalled by this server update.

Deployment scratch: `/private/tmp/cosmiq-notification-live.3hKdoc/{enqueue,dispatch}`.
Verification scratch: `/private/tmp/cosmiq-notification-verify.806vMT/{enqueue,dispatch}`.

Apple reference: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
