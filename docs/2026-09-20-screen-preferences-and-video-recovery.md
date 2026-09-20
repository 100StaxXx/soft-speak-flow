# Screen preferences and companion video repair

## Changes

- Replaced campaign creation CTAs with accessible 44px icon-only plus buttons; populated lists place the plus beside their heading.
- Remember Inbox expansion and mobile calendar Day/Agenda/3-Day/Month selections in device-local, account-scoped storage. Invalid or unavailable storage falls back safely; auth hydration does not overwrite stored choices.
- Preserve existing authentication recovery and calendar drag/summary changes in the working tree.
- Resume a previously access-blocked, unsubmitted wellbeing job after verified access returns; keep the single-retry cap, compare-and-swap, existing paid-job safeguards, product guard, and generation budgets.
- Recheck background video preparation after successful Apple access reconciliation. Unclassified 403 errors no longer incorrectly assert that a subscription is missing.
- Imported the live cinema worker with explicit user permission, retaining its exact dependency closure. Hatch videos now get a separate opaque ending scene made from the egg scene and approved companion references. Canonical cutouts remain unchanged. This adds one guarded image-edit request per newly prepared hatch, not extra video renders. Existing cached videos are not regenerated or overwritten.

## Live account investigation and authorized remedy

The two explicitly approved accounts had no wellbeing jobs. One had no access record; the other had an expired access record and a subscription with an expired end date. Neither had an active promo. The wellbeing processing schedule was active.

With explicit user authorization, both accounts received 14 days of temporary manual access ending October 4, 2026 at 18:41:59 UTC. Existing billing and Apple transaction records were not changed. This was not an Apple purchase or an extension of Apple's introductory-offer eligibility. Account access checks now recognize these grants; the app can prepare videos on its next fresh access check. No paid generation was manually started as part of the investigation.

## Release boundaries

These source changes are local and have not been pushed, deployed, or uploaded to TestFlight. Only the two authorized temporary access grants are live. The local hatch fix affects future preparation; existing recordings remain unchanged. Generated visual continuity still needs inspection on a newly rendered test hatch after release. Deploy only the explicitly reviewed cinema and wellbeing functions, never all shared functions or migrations.

## Validation

- Full frontend regression suite: 392 files, 2,968 tests passed.
- Focused backend suite: 18 tests passed, including valid 14-day trials, expired access denial, recovery without duplicate paid submission, and Cosmiq/Graceward isolation.
- Type checks for the app and cinema worker passed; changed frontend files passed lint.
- Production web build, function manifest, bundle budgets, and secret scan passed.
- Compared imported worker with the downloaded live source: cleanup, authentication, canonical portrait storage and later-stage endpoints are unchanged; only hatch scene preparation, its video endpoint, and its prompt version differ.
- Verified both temporary access records are active. No video jobs existed at the final account check; reopening the app or selecting Check again can initiate normal preparation. This is not a claim that finished videos were generated or visually inspected.
- Removed only the regenerable temporary build-358 DerivedData cache (977 MB); signed archive and source preserved.
