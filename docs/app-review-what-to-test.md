# What to Test (App Review)

## Metadata before resubmission

- **Privacy Policy URL field**: `https://app.cosmiq.quest/privacy`
- **App Description Terms of Use (EULA) line**: `Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- **Optional public terms link**: `Terms of Use: https://app.cosmiq.quest/terms`
- **App Review Notes field**:

  ```text
  Auto-renewable subscription review path:
  Sign in, open Profile -> Account -> Subscription Details, choose Monthly or Yearly, and confirm the purchase sheet.

  The purchase flow displays the subscription title, subscription length, price, unit price where applicable, Restore Purchases, Privacy Policy, Terms of Use, and Apple Standard EULA links.

  App metadata includes:
  Privacy Policy: https://app.cosmiq.quest/privacy
  Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
  ```

- **Start a subscription**: Sign in, open Profile → Account → Subscription Details, choose a plan, and tap **Subscribe** to trigger the native RevenueCat purchase sheet (e.g., cosmiq_premium_monthly). After purchase, the status should show Cosmiq Pro as active.
- **Restore a subscription**: On the same Subscription Details card (or the Go Premium card if shown), tap **Restore purchases**, wait for the loading state to finish, and confirm the success toast updates the status to Premium.
- **Manage/cancel subscription**: From Subscription Details, tap **Manage Subscription** to open RevenueCat Customer Center. Cancel or modify the plan there; re-open the screen to see the updated renewal date/status.
