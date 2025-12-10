# What to Test (App Review)

- **Start a subscription**: Sign in, open Profile → Account → Subscription Details, choose a plan, and tap **Subscribe** to trigger the native StoreKit sheet (e.g., com.revolutions.app.premium.monthly). After purchase, the status should show Cosmiq Premium as active.
- **Restore a subscription**: On the same Subscription Details card (or the Go Premium card if shown), tap **Restore purchases**, wait for the loading state to finish, and confirm the success toast updates the status to Premium.
- **Manage/cancel in iOS**: From Subscription Details, tap **Manage in iOS Settings** to open Apple’s subscription management page. Cancel or modify the plan there; re-open the screen to see the updated renewal date/status.
