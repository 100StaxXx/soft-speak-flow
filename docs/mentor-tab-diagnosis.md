# Mentor tab redirects to onboarding

## Observed behavior
- Tapping the **Mentor** tab in the bottom navigation sends users to the onboarding flow instead of staying on the mentor home screen.

## Root cause analysis
- The Mentor tab points to `/`, which renders `Index.tsx`.
- `Index.tsx` contains a guard that runs after profile/companion data load. If a mentor isn't resolved, onboarding is marked incomplete, or no companion exists, it navigates to `/onboarding`.
- This guard is triggered whenever `/` mounts, not just during initial sign-up, so any user missing a resolved mentor or companion (or explicitly marked incomplete) gets forced back to onboarding when opening the Mentor tab.

Relevant code:
- Redirect effect checks for missing mentor/companion or `onboarding_completed === false` and calls `navigate("/onboarding")`.

## Why it happens specifically on the Mentor tab
- Other tabs (Companion, Quests, Search, Profile) route to different pages and don't execute the onboarding guard.
- Because the Mentor tab is wired to `/`, the guard runs and redirects, making it look like the tab opens onboarding.

## Suggested next steps
- Limit the onboarding redirect guard so it only runs during the onboarding flow or first-run scenarios.
- Consider gating the mentor tab with a lightweight placeholder instead of a hard redirect when data is missing (e.g., prompt to pick a mentor within the tab).
